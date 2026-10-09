import { useCallback, useEffect, useRef, useState } from 'react'
import type { OfficeMap, Pos } from '../utils/officeMap'
import { peersToConnect, volumeFor, isCaller } from '../utils/voiceProximity'
import { sendSignal, takeSignals } from '../services/voiceSignal'

// ── เสียงตามระยะในออฟฟิศ 2D — WebRTC เครื่องต่อเครื่อง ──
//
// เปิดไมค์ → ทุก 1.5 วิ: อ่านข้อความแนะนำตัว (offer/answer) · ต่อสายกับคนเปิดไมค์ที่ได้ยินกัน · วางสายคนที่เดินห่าง
// ปรับความดังตามระยะทุกรอบ · เสียงวิ่งตรงเครื่องต่อเครื่อง (ไม่ผ่าน server ใด ๆ)
//
// ข้อจำกัดที่รู้: ไม่มี TURN server — เครือข่ายที่บล็อก P2P (NAT บางแบบ, VPN บางตัว) จะต่อไม่ติด
// ภายในออฟฟิศเดียวกันต่อได้แน่ · ต่อไม่ติด 20 วิ = บอกผู้ใช้และพักคนนั้น 30 วิ

const TICK_MS = 1500
const CONNECT_TIMEOUT = 20_000
const RETRY_AFTER = 30_000
const GRACE_MS = 8_000            // ตำแหน่งคนอื่นมาช้า ~3 วิ — อย่าวางสายเร็วเกินจนสายเพิ่งต่อหลุด
const ICE_WAIT = 2500
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

export type PeerState = 'connecting' | 'connected' | 'failed'

export interface PeerView { email: string; state: PeerState; speaking: boolean; volume: number }

interface Peer {
  pc: RTCPeerConnection
  audio: HTMLAudioElement
  startedAt: number
  state: PeerState
  analyser?: AnalyserNode
  speaking: boolean
  volume: number
}

export interface VoiceOther extends Pos { email: string; mic: boolean }

interface Args {
  map: OfficeMap
  meEmail: string
  mePos: Pos | null
  others: VoiceOther[]
  onError: (msg: string) => void
  /** ไมค์เปิด/ปิด — ให้ฝั่งออฟฟิศเขียนลงตำแหน่ง (ช่อง Room) ให้คนอื่นรู้ */
  onMicChange: (on: boolean) => void
  /** สายส่วนตัว (จากแชทส่วนตัว) — มีค่า = ต่อกับคนนี้คนเดียว ไม่สนระยะ และไม่รับสายจากคนรอบตัว */
  privatePeer?: string | null
}

/** รอรวบ ICE candidate ให้ครบแล้วค่อยส่ง SDP ทีเดียว — ลดข้อความเหลือ 1 ต่อฝั่ง */
function gatherComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise(resolve => {
    const done = () => { pc.removeEventListener('icegatheringstatechange', check); resolve() }
    const check = () => { if (pc.iceGatheringState === 'complete') done() }
    pc.addEventListener('icegatheringstatechange', check)
    setTimeout(done, ICE_WAIT)   // STUN ช้า/โดนบล็อก — ส่งเท่าที่มี (host candidate พอสำหรับวงแลนเดียวกัน)
  })
}

const level = (an: AnalyserNode, buf: Uint8Array<ArrayBuffer>): number => {
  an.getByteTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v }
  return Math.sqrt(sum / buf.length)
}

export function useOfficeVoice({ map, meEmail, mePos, others, onError, onMicChange, privatePeer = null }: Args) {
  const me = meEmail.toLowerCase()
  const [micOn, setMicOn] = useState(false)
  const [muted, setMuted] = useState(false)
  const [meSpeaking, setMeSpeaking] = useState(false)
  const [view, setView] = useState<PeerView[]>([])

  const stream = useRef<MediaStream | null>(null)
  const peers = useRef(new Map<string, Peer>())
  const failedUntil = useRef(new Map<string, number>())
  const ctx = useRef<AudioContext | null>(null)
  const myAnalyser = useRef<AnalyserNode | null>(null)
  const busy = useRef(false)
  // ค่าล่าสุดสำหรับ loop — ไม่เอาเข้า deps ไม่งั้น interval ถูกตั้งใหม่ทุก 3 วิที่ตำแหน่งคนอื่นเปลี่ยน
  const live = useRef({ map, mePos, others, onError, privatePeer })
  useEffect(() => { live.current = { map, mePos, others, onError, privatePeer } }, [map, mePos, others, onError, privatePeer])

  const publish = useCallback(() => {
    setView([...peers.current.entries()].map(([email, p]) => ({ email, state: p.state, speaking: p.speaking, volume: p.volume })))
  }, [])

  const closePeer = useCallback((email: string, notify: boolean) => {
    const p = peers.current.get(email)
    if (!p) return
    peers.current.delete(email)
    try { p.pc.close() } catch { /* ปิดซ้ำได้ */ }
    p.audio.srcObject = null
    p.audio.remove()
    if (notify) sendSignal(me, email, 'bye').catch(() => {})
  }, [me])

  const newPeer = useCallback((email: string): Peer => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const audio = document.createElement('audio')
    audio.autoplay = true
    audio.style.display = 'none'
    document.body.appendChild(audio)
    const peer: Peer = { pc, audio, startedAt: Date.now(), state: 'connecting', speaking: false, volume: 1 }
    stream.current?.getTracks().forEach(t => pc.addTrack(t, stream.current!))
    pc.ontrack = ev => {
      const s = ev.streams[0] ?? new MediaStream([ev.track])
      audio.srcObject = s
      audio.play().catch(() => { /* autoplay — ผู้ใช้กดไมค์แล้ว จึงมี gesture */ })
      if (ctx.current) {
        const an = ctx.current.createAnalyser()
        an.fftSize = 512
        ctx.current.createMediaStreamSource(s).connect(an)
        peer.analyser = an
      }
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { peer.state = 'connected'; publish() }
      if (pc.connectionState === 'failed') { peer.state = 'failed'; publish() }
    }
    peers.current.set(email, peer)
    publish()
    return peer
  }, [publish])

  const call = useCallback(async (email: string) => {
    const p = newPeer(email)
    const offer = await p.pc.createOffer({ offerToReceiveAudio: true })
    await p.pc.setLocalDescription(offer)
    await gatherComplete(p.pc)
    await sendSignal(me, email, 'offer', JSON.stringify(p.pc.localDescription))
  }, [me, newPeer])

  const answer = useCallback(async (email: string, sdp: string) => {
    closePeer(email, false)   // offer ใหม่ = อีกฝั่งเริ่มใหม่ ทิ้งสายเก่า
    const p = newPeer(email)
    await p.pc.setRemoteDescription(JSON.parse(sdp))
    const ans = await p.pc.createAnswer()
    await p.pc.setLocalDescription(ans)
    await gatherComplete(p.pc)
    await sendSignal(me, email, 'answer', JSON.stringify(p.pc.localDescription))
  }, [me, newPeer, closePeer])

  const tick = useCallback(async () => {
    if (busy.current || !stream.current) return
    busy.current = true
    try {
      const { map: m, mePos: pos, others: os, onError: err, privatePeer: priv } = live.current
      const privEmail = priv ? priv.toLowerCase() : null
      // 1. ข้อความแนะนำตัวที่ส่งถึงฉัน
      const inbox = await takeSignals(me).catch(() => null)
      if (inbox === null) err('ต่อสายเสียงไม่ได้ — ตรวจว่ามี list HD_OfficeSignal (ดู docs/Team-Status.md)')
      for (const s of inbox ?? []) {
        const from = s.FromEmail.toLowerCase()
        try {
          // อยู่ในสายส่วนตัว — ไม่รับสายจากคนอื่น ไม่งั้นคนเดินผ่านได้ยินเราไม่กี่วินาทีก่อนถูกตัด
          if (s.Title === 'offer' && privEmail && from !== privEmail) { sendSignal(me, from, 'bye').catch(() => {}); continue }
          if (s.Title === 'offer' && s.Payload) await answer(from, s.Payload)
          else if (s.Title === 'answer' && s.Payload) {
            const p = peers.current.get(from)
            if (p && p.pc.signalingState === 'have-local-offer') await p.pc.setRemoteDescription(JSON.parse(s.Payload))
          } else if (s.Title === 'bye') closePeer(from, false)
        } catch { closePeer(from, false) }
      }
      if (!pos && !privEmail) return
      // 2. ใครควรได้ยินกันตอนนี้ — สายส่วนตัว = คนเดียว ไม่สนระยะ/ไมค์ของเขา (เขากดรับแล้ว ไมค์จะเปิดเอง)
      const meP = { email: me, x: pos?.x ?? 0, y: pos?.y ?? 0 }
      const wantList = privEmail ? [privEmail] : peersToConnect(m, meP, os.filter(o => o.mic).map(o => ({ email: o.email, x: o.x, y: o.y })))
      const want = new Set(wantList)
      const now = Date.now()
      for (const email of wantList) {
        if (peers.current.has(email) || !isCaller(me, email)) continue
        if ((failedUntil.current.get(email) ?? 0) > now) continue
        call(email).catch(() => closePeer(email, false))
      }
      // 3. วางสาย / หมดเวลา / ปรับเสียง
      for (const [email, p] of [...peers.current]) {
        const age = now - p.startedAt
        if (!want.has(email) && age > GRACE_MS) { closePeer(email, true); continue }
        if ((p.state !== 'connected' && age > CONNECT_TIMEOUT) || p.state === 'failed') {
          closePeer(email, false)
          failedUntil.current.set(email, now + RETRY_AFTER)
          err(`ต่อเสียงกับ ${email.split('@')[0]} ไม่ติด — เครือข่ายอาจบล็อกการเชื่อมต่อตรง ลองโทรผ่าน Teams แทน`)
          continue
        }
        const o = os.find(x => x.email.toLowerCase() === email)
        const v = email === privEmail ? 1 : o ? volumeFor(m, meP, o) : 0
        p.volume = v
        p.audio.volume = Math.max(0, Math.min(1, v))
      }
      publish()
    } finally { busy.current = false }
  }, [me, answer, call, closePeer, publish])

  const stop = useCallback(() => {
    for (const email of [...peers.current.keys()]) closePeer(email, true)
    stream.current?.getTracks().forEach(t => t.stop())
    stream.current = null
    myAnalyser.current = null
    ctx.current?.close().catch(() => {})
    ctx.current = null
    setMicOn(false); setMuted(false); setMeSpeaking(false); publish()
    onMicChange(false)
  }, [closePeer, publish, onMicChange])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { onError('เบราว์เซอร์นี้ใช้ไมค์ไม่ได้ (ต้องเปิดผ่าน https)'); return }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      stream.current = s
      ctx.current = new AudioContext()
      const an = ctx.current.createAnalyser()
      an.fftSize = 512
      ctx.current.createMediaStreamSource(s).connect(an)
      myAnalyser.current = an
      failedUntil.current.clear()
      setMicOn(true)
      onMicChange(true)
    } catch {
      onError('เปิดไมค์ไม่ได้ — อนุญาตไมโครโฟนให้เว็บนี้ที่ไอคอนกุญแจหน้า URL')
    }
  }, [onError, onMicChange])

  const toggleMute = useCallback(() => {
    const next = !muted
    stream.current?.getAudioTracks().forEach(t => { t.enabled = !next })
    setMuted(next)
  }, [muted])

  // loop ต่อสาย
  useEffect(() => {
    if (!micOn) return
    tick()
    const t = setInterval(tick, TICK_MS)
    return () => clearInterval(t)
  }, [micOn, tick])

  // ใครกำลังพูด — วัดระดับเสียงทุก 200ms (ของเราเองด้วย ให้รู้ว่าไมค์ติด)
  useEffect(() => {
    if (!micOn) return
    const buf = new Uint8Array(new ArrayBuffer(512))
    const t = setInterval(() => {
      let changed = false
      for (const p of peers.current.values()) {
        const sp = !!p.analyser && level(p.analyser, buf) > 0.04
        if (sp !== p.speaking) { p.speaking = sp; changed = true }
      }
      if (changed) publish()
      if (myAnalyser.current) setMeSpeaking(!muted && level(myAnalyser.current, buf) > 0.04)
    }, 200)
    return () => clearInterval(t)
  }, [micOn, muted, publish])

  // ออกจากหน้า = วางสายทุกสายและคืนไมค์
  useEffect(() => () => {
    for (const p of peers.current.values()) { try { p.pc.close() } catch { /* */ } p.audio.remove() }
    peers.current.clear()
    stream.current?.getTracks().forEach(t => t.stop())
    ctx.current?.close().catch(() => {})
  }, [])

  return { micOn, muted, meSpeaking, peers: view, start, stop, toggleMute, privatePeer }
}
