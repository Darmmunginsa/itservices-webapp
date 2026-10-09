import { createRoot } from 'react-dom/client'
import '../src/index.css'
import { Office2D } from '../src/components/team/Office2D'
import { DEFAULT_MAP } from '../src/utils/officeMap'
import { preseed } from './mockOffice'

// ออฟฟิศเต็มรูปแบบ 2 คน ยืนห้องประชุมเดียวกัน — A แชร์จอ แล้วดูว่าฝั่ง B ขยายเป็นโหมดโรงหนัง
navigator.mediaDevices.getUserMedia = async () => {
  const ac = new AudioContext(); const o = ac.createOscillator(); const d = ac.createMediaStreamDestination(); o.connect(d); o.start(); return d.stream
}
navigator.mediaDevices.getDisplayMedia = async () => {
  const c = document.createElement('canvas'); c.width = 1280; c.height = 720
  const g = c.getContext('2d')!
  let f = 0
  setInterval(() => {
    g.fillStyle = '#0f172a'; g.fillRect(0, 0, 1280, 720)
    g.fillStyle = '#38bdf8'; g.font = 'bold 64px sans-serif'; g.fillText('Ticket HD-20261009-301', 60, 140)
    g.fillStyle = '#e2e8f0'; g.font = '36px sans-serif'
    ;['ลูกค้าแจ้ง: เครื่องพิมพ์ชั้น 3 ไม่ออก', 'สถานะ: In Progress', `frame ${f++}`].forEach((t, i) => g.fillText(t, 60, 260 + i * 70))
  }, 66)
  return c.captureStream(15)
}
preseed('a@x', 'อารีย์ (A)', 13, 2)
preseed('b@x', 'บอส (B)', 14, 2)
const members = [
  { email: 'a@x', name: 'อารีย์ (A)', profileId: 1, slot: null },
  { email: 'b@x', name: 'บอส (B)', profileId: 2, slot: null },
]
createRoot(document.getElementById('root')!).render(
  <div className="p-3 space-y-6">
    <section data-who="a"><h2 className="text-xs font-bold">A (ผู้แชร์)</h2>
      <Office2D mapRows={DEFAULT_MAP} members={members} meEmail="a@x" meName="อารีย์ (A)" onZoneChange={() => {}} onError={() => {}} /></section>
    <section data-who="b"><h2 className="text-xs font-bold">B (ผู้ดู)</h2>
      <Office2D mapRows={DEFAULT_MAP} members={members} meEmail="b@x" meName="บอส (B)" onZoneChange={() => {}} onError={() => {}} /></section>
  </div>,
)
