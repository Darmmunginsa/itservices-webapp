import {
  Home, Send, ClipboardList, FolderOpen, BarChart2, PieChart,
  Monitor, Briefcase, Globe, Notebook, BookOpen, Library, FileText, ClipboardCheck, Newspaper, Pin, Settings, Bug, Activity, Users, ShieldAlert,
} from 'lucide-react'
import type { Role } from '../types/common'

// ── ทะเบียนหน้าทั้งหมดของแอป (single source of truth) ──
// route guard / sidebar / bottom nav อ่านจากไฟล์นี้ที่เดียว
// สิทธิ์จริงกำหนดรายคนใน SharePoint list 'HD_PagePermissions' (ดู services/permissions.ts)
// defaultRoles ใช้เฉพาะกรณี fallback (ลิสต์ยังไม่ถูกสร้าง / โหลดไม่ได้) เพื่อไม่ให้ระบบล็อกทุกคน
export interface PageDef {
  key: string                 // รหัสหน้า — ใช้เก็บใน AllowedPages
  path: string
  labelKey: string            // i18n key
  icon: typeof Home
  group: 'main' | 'work' | 'resources' | 'system'
  always?: boolean            // เข้าได้เสมอ ไม่ต้องมีสิทธิ์ (กันผู้ใช้ไม่มีหน้าให้ลง = redirect วนลูป)
  defaultRoles?: Role[]       // ใช้ตอน fallback เท่านั้น
  /** หน้านี้มีช่อง "แก้ไขได้" ให้ Admin ติ๊กรายคน — ข้อความบอกว่าติ๊กแล้วทำอะไรได้เพิ่ม
   *  (ไม่มี = หน้านั้นไม่มีอะไรให้ปลดล็อก เช่น ดูอย่างเดียว หรือคุมด้วยความเป็นเจ้าของอยู่แล้ว) */
  edit?: string
}

const ALL: Role[] = ['EndUser', 'Agent', 'Supervisor', 'Boss', 'Admin']
const AGENT_UP: Role[] = ['Agent', 'Supervisor', 'Boss', 'Admin']
const SUP_UP: Role[] = ['Supervisor', 'Boss', 'Admin']

export const PAGES: PageDef[] = [
  { key: 'home',      path: '/',          labelKey: 'nav.home',       icon: Home,          group: 'main',      always: true },
  { key: 'submit',    path: '/submit',    labelKey: 'nav.submit',     icon: Send,          group: 'main',      defaultRoles: ALL },
  { key: 'my-work',   path: '/my-work',   labelKey: 'nav.myWork',     icon: ClipboardList, group: 'main',      defaultRoles: ALL },
  { key: 'tracking',  path: '/tracking',  labelKey: 'nav.tracking',   icon: Pin,           group: 'main',      defaultRoles: ALL },

  { key: 'projects',  path: '/projects',  labelKey: 'nav.projects',   icon: FolderOpen,    group: 'work',      defaultRoles: ALL, edit: 'สร้างโครงการใหม่ได้' },
  { key: 'dashboard', path: '/dashboard', labelKey: 'nav.dashboard',  icon: BarChart2,     group: 'work',      defaultRoles: AGENT_UP, edit: 'มอบหมาย / รับงานแทนทีมได้' },
  { key: 'reports',   path: '/reports',   labelKey: 'nav.reports',    icon: PieChart,      group: 'work',      defaultRoles: AGENT_UP },

  { key: 'assets',    path: '/assets',    labelKey: 'nav.assets',     icon: Monitor,       group: 'resources', defaultRoles: ALL, edit: 'เพิ่ม / แก้ / ลบทรัพย์สินและอะไหล่ได้' },
  { key: 'vendors',   path: '/vendors',   labelKey: 'nav.vendors',    icon: Briefcase,     group: 'resources', defaultRoles: ALL, edit: 'เพิ่ม / แก้ Vendor Contracts ได้' },
  { key: 'portals',   path: '/portals',   labelKey: 'nav.portals',    icon: Globe,         group: 'resources', defaultRoles: AGENT_UP, edit: 'เพิ่ม / แก้ Portals และไฟล์แนบได้' },
  { key: 'tools',     path: '/tools',     labelKey: 'nav.tools',      icon: Notebook,      group: 'resources', defaultRoles: ALL },
  { key: 'skills',    path: '/skills',    labelKey: 'nav.skills',     icon: BookOpen,      group: 'resources', defaultRoles: ALL },
  { key: 'contracts', path: '/contracts', labelKey: 'nav.contacts',   icon: FileText,      group: 'resources', defaultRoles: ALL, edit: 'เพิ่ม / แก้ข้อมูลลูกค้าได้' },
  { key: 'pm-report',  path: '/pm-report',  labelKey: 'nav.pmReport',   icon: ClipboardCheck, group: 'work',      defaultRoles: AGENT_UP, edit: 'จัดการเทมเพลตรายงาน PM ได้' },
  { key: 'knowledge',  path: '/knowledge',  labelKey: 'nav.knowledge',  icon: Newspaper,     group: 'resources', defaultRoles: AGENT_UP, edit: 'เขียน / แก้บทความได้ (เผยแพร่ยังตาม role)' },
  { key: 'references', path: '/references', labelKey: 'nav.references', icon: Library,      group: 'resources', defaultRoles: ALL, edit: 'เพิ่ม / แก้แหล่งอ้างอิงได้ (ลบยังตาม role)' },
  { key: 'orgchart',  path: '/orgchart',  labelKey: 'nav.orgchart',   icon: Users,         group: 'resources', defaultRoles: ALL, edit: 'เปลี่ยนรูปให้คนอื่นได้' },
  { key: 'phish',     path: '/phish',     labelKey: 'nav.phish',      icon: ShieldAlert,   group: 'resources', defaultRoles: AGENT_UP, edit: 'จัดการรายงาน Phishing ได้' },

  { key: 'admin',     path: '/admin',     labelKey: 'nav.admin',      icon: Settings,      group: 'system',    defaultRoles: SUP_UP },
  { key: 'activity',  path: '/activity',  labelKey: 'nav.activity',   icon: Activity,      group: 'system',    defaultRoles: ['Boss', 'Admin'] },
  { key: 'debug',     path: '/debug',     labelKey: 'nav.diagnostic', icon: Bug,           group: 'system',    defaultRoles: ['Boss', 'Admin'] },
]

export const PAGE_BY_KEY = new Map(PAGES.map(p => [p.key, p]))

// หน้าที่เข้าได้เสมอ (ไม่นับเป็นสิทธิ์)
export const ALWAYS_KEYS = PAGES.filter(p => p.always).map(p => p.key)

export const GROUP_TITLE: Record<PageDef['group'], string> = {
  main: 'group.main', work: 'group.work', resources: 'group.resources', system: 'group.system',
}
