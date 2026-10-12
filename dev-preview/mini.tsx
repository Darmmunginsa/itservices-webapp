import { createRoot } from 'react-dom/client'
import '../src/index.css'
import { MiniOffice } from '../src/components/team/MiniOffice'
import { DEFAULT_MAP } from '../src/utils/officeMap'
import { avatarFromSeed } from '../src/utils/officeAvatar'

// preview เท่านั้น — หน้าต่างลอยของออฟฟิศ (ขนาดเริ่มต้น 380×300)
const people = [
  { email: 'aree@x', x: 14, y: 3, name: 'อารีย์', avatar: avatarFromSeed('aree@x'), face: 'down' as const, speaking: true, muted: false },
  { email: 'nok@x', x: 19, y: 3, name: 'นก', avatar: avatarFromSeed('nok@x'), face: 'left' as const, speaking: false, muted: true },
  { email: 'boss@x', x: 13, y: 10, name: 'บอส', avatar: avatarFromSeed('boss@x'), face: 'down' as const, speaking: false, muted: false },
  { email: 'me@x', x: 33, y: 9, name: 'แบงค์', avatar: avatarFromSeed('me@x'), face: 'right' as const, speaking: false, muted: false, me: true },
]
createRoot(document.getElementById('root')!).render(
  <div style={{ height: 300 }}>
    <MiniOffice rows={DEFAULT_MAP} people={people} zoneLabel="สวน" unread={3} micOn muted={false}
      onToggleMute={() => {}} onLeaveVoice={() => {}} onBack={() => {}} screen={null} screenBy="" />
  </div>,
)
