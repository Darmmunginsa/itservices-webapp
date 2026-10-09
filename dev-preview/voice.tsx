import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import { useOfficeVoice } from '../src/hooks/useOfficeVoice'
import { parseMap, DEFAULT_MAP } from '../src/utils/officeMap'
import { ScreenVideo } from '../src/components/team/ScreenVideo'

// ทดสอบเสียงจริงในหน้าเดียว: 2 คนยืนติดกัน ไมค์เป็นเสียงสังเคราะห์ (ไม่ต้องใช้ไมค์จริง)
// ผ่าน = ทั้งคู่ "connected" และแต่ละฝั่งตรวจเจอเสียงอีกฝั่ง (speaking)
const tone = (hz: number) => {
  const ac = new AudioContext()
  const osc = ac.createOscillator(); osc.frequency.value = hz
  const gain = ac.createGain(); gain.gain.value = 0.5
  const dst = ac.createMediaStreamDestination()
  osc.connect(gain).connect(dst); osc.start()
  return dst.stream
}
let n = 0
navigator.mediaDevices.getUserMedia = async () => tone(n++ === 0 ? 440 : 660)
// "หน้าจอ" สังเคราะห์ — canvas ที่วาดเปลี่ยนตลอด ให้มีเฟรมวิ่งจริง
navigator.mediaDevices.getDisplayMedia = async () => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 360
  const g = c.getContext('2d')!
  let f = 0
  setInterval(() => { g.fillStyle = `hsl(${f++ % 360} 70% 50%)`; g.fillRect(0, 0, 640, 360); g.fillStyle = '#fff'; g.font = '40px sans-serif'; g.fillText(`frame ${f}`, 40, 200) }, 66)
  return c.captureStream(15)
}

const map = parseMap(DEFAULT_MAP)

function Person({ email, x, y, otherEmail, ox, oy }: { email: string; x: number; y: number; otherEmail: string; ox: number; oy: number }) {
  const [errs, setErrs] = useState<string[]>([])
  const [mic, setMic] = useState(false)
  const others = useMemo(() => [{ email: otherEmail, x: ox, y: oy, mic: true }], [otherEmail, ox, oy])
  const v = useOfficeVoice({ map, meEmail: email, mePos: { x, y }, others, onError: e => setErrs(l => [...l, e]), onMicChange: setMic })
  return (
    <div className="border rounded p-2 text-xs space-y-1" data-person={email}>
      <b>{email}</b> mic={String(mic)} micOn={String(v.micOn)} meSpeaking={String(v.meSpeaking)}
      <button className="ml-2 px-2 border rounded" onClick={v.start}>start</button>
      <button className="ml-2 px-2 border rounded" onClick={v.startShare}>share</button>
      <button className="ml-2 px-2 border rounded" onClick={v.stopShare}>unshare</button>
      <span data-sharing>{String(v.sharing)}</span>
      {v.peers.filter(p => p.screen).map(p => <ScreenVideo key={p.email} stream={p.screen!} className="w-48 border" />)}
      <pre data-peers>{JSON.stringify(v.peers.map(p => ({ ...p, screen: !!p.screen })))}</pre>
      <pre className="text-red-600">{errs.join('\n')}</pre>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <div className="p-4 space-y-2">
    <Person email="a@x" x={1} y={1} otherEmail="b@x" ox={2} oy={1} />
    <Person email="b@x" x={2} y={1} otherEmail="a@x" ox={1} oy={1} />
  </div>,
)
