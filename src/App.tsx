import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Calendar } from 'lucide-react'
import { MsalProvider, useIsAuthenticated, useMsal } from '@azure/msal-react'
import { EventType, InteractionRequiredAuthError } from '@azure/msal-browser'
import { msalInstance, sharepointRequest, REDIRECT_URI } from './config/msal'
import { useAppStore } from './store/useAppStore'
import { setTokenGetter } from './services/sharepoint'
import { setGraphTokenGetter } from './services/graph'
import { spGet } from './services/sharepoint'
import { resolvePages } from './services/permissions'
import { setActivityUser, logActivity } from './services/activityLog'
import { PAGES, ALWAYS_KEYS } from './config/pages'
import type { AgentProfile } from './types/common'

import { Sidebar } from './components/layout/Sidebar'
import { BottomNav } from './components/layout/BottomNav'
import { Ticker } from './components/layout/Ticker'
import { ToastContainer } from './components/common/Toast'
import { CalendarDrawer } from './components/calendar/CalendarDrawer'
import { DateTaskModal } from './components/common/DateTaskModal'
import { FloatingFocus } from './components/common/FloatingFocus'
import { TaskPlanner } from './components/common/TaskPlanner'

import Login from './pages/Login'
import Home from './pages/Home'
import Submit from './pages/Submit'
import MyWork from './pages/MyWork'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import TicketDetail from './pages/TicketDetail'
import AgentDashboard from './pages/AgentDashboard'
import Reports from './pages/Reports'
import Assets from './pages/Assets'
import Vendors from './pages/Vendors'
import Portals from './pages/Portals'
import Tracking from './pages/Tracking'
import Skills from './pages/Skills'
import Contracts from './pages/Contracts'
import Diagnostic from './pages/Diagnostic'
import Admin from './pages/Admin'
import Tools from './pages/Tools'
import ActivityLog from './pages/ActivityLog'
import OrgChart from './pages/OrgChart'
import PhishReports from './pages/PhishReports'
import References from './pages/References'
import './index.css'

// map รหัสหน้า → component (คู่กับ PAGES ใน config/pages.ts)
const PAGE_ELEMENTS: Record<string, React.ReactElement> = {
  submit: <Submit />,
  'my-work': <MyWork />,
  tracking: <Tracking />,
  projects: <Projects />,
  dashboard: <AgentDashboard />,
  reports: <Reports />,
  assets: <Assets />,
  vendors: <Vendors />,
  portals: <Portals />,
  tools: <Tools />,
  skills: <Skills />,
  contracts: <Contracts />,
  orgchart: <OrgChart />,
  references: <References />,
  admin: <Admin />,
  activity: <ActivityLog />,
  phish: <PhishReports />,
  debug: <Diagnostic />,
}

// Set active account after redirect — runs once at startup
msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
    const payload = event.payload as { account?: unknown }
    if (payload.account) {
      msalInstance.setActiveAccount(payload.account as never)
    }
  }
})

function AppContent() {
  const isAuthenticated = useIsAuthenticated()
  const { instance, accounts } = useMsal()
  const { user, setUser, isDarkMode, allowedPages, setPermissions } = useAppStore()
  const [calendarOpen, setCalendarOpen] = useState(false)

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [isDarkMode])

  useEffect(() => {
    if (!isAuthenticated || !accounts[0]) return

    const account = accounts[0]
    const email = account.username
    const spReq = { ...sharepointRequest, account, redirectUri: REDIRECT_URI }

    // SP token getter — silent only; redirect fallback triggers page navigation
    const getSpToken = async (): Promise<string> => {
      try {
        const result = await instance.acquireTokenSilent(spReq)
        return result.accessToken
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          await instance.acquireTokenRedirect(spReq)
        }
        throw e
      }
    }

    // Graph token getter — silent only
    const getGraphToken = async (): Promise<string> => {
      try {
        const result = await instance.acquireTokenSilent({
          scopes: ['User.Read', 'Calendars.ReadWrite', 'Mail.Send'],
          account,
          redirectUri: REDIRECT_URI,
        })
        return result.accessToken
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          await instance.acquireTokenRedirect({
            scopes: ['User.Read', 'Calendars.ReadWrite', 'Mail.Send'],
            account,
            redirectUri: REDIRECT_URI,
          })
        }
        throw e
      }
    }

    setTokenGetter(getSpToken)
    setGraphTokenGetter(getGraphToken)

    // SP consent is already handled inside login() — here we only need
    // acquireTokenSilent (no popup). Load profile immediately after.
    getSpToken()
      .catch(() => null)
      .then(() => spGet<AgentProfile>('HD_AgentProfiles', `EmailText eq '${email}'`).catch(() => [] as AgentProfile[]))
      .then(profiles => {
        const profile = (profiles as AgentProfile[])[0]
        setUser({
          id: account.localAccountId,
          displayName: account.name ?? email,
          email,
          role: profile?.Role ?? 'EndUser',
          agentProfile: profile,
        })
      })
      .catch(() => {
        setUser({
          id: account.localAccountId,
          displayName: account.name ?? email,
          email,
          role: 'EndUser',
        })
      })
  }, [isAuthenticated, accounts, instance, setUser])

  // ผูกผู้ใช้เข้ากับ activity log + บันทึกการเข้าใช้งาน (ครั้งเดียวต่อ session)
  useEffect(() => {
    if (!user?.email) return
    setActivityUser({ email: user.email, name: user.displayName })
    const k = `activityLoginLogged_${user.email}`
    if (!sessionStorage.getItem(k)) {
      sessionStorage.setItem(k, '1')
      logActivity({ action: 'login', listName: 'Session', itemTitle: user.displayName, note: `เข้าใช้งานระบบ (role: ${user.role})` })
    }
  }, [user?.email, user?.displayName, user?.role])

  // โหลดสิทธิ์การเข้าถึงหน้า (กำหนดรายคนโดย Admin ใน HD_PagePermissions)
  useEffect(() => {
    if (!user?.email) return
    resolvePages(user.email, user.role)
      .then(r => setPermissions(r.pages, r.source))
      .catch(() => setPermissions(new Set(ALWAYS_KEYS), 'none'))
  }, [user?.email, user?.role, setPermissions])

  if (!isAuthenticated) return <Login />

  if (!user || !allowedPages) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950" style={{ background: 'var(--app-bg)' }}>
      <Sidebar />
      <div className="flex-1 md:ml-56 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <Ticker />
        <main className="flex-1 pb-16 md:pb-0">
          <Routes>
            {/* หน้าหลัก — เข้าได้เสมอ (เป็นที่ลงจอดเมื่อไม่มีสิทธิ์หน้าอื่น) */}
            <Route path="/" element={<Home />} />
            {/* หน้ารายละเอียด — ไม่ผูกกับสิทธิ์หน้า (มีการคุมสิทธิ์ในตัวเอง) */}
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            {/* หน้าที่คุมด้วยสิทธิ์รายคน — สร้างจาก PAGES registry */}
            {PAGES.filter(p => !p.always).map(p => (
              <Route key={p.key} path={p.path}
                element={allowedPages.has(p.key) ? PAGE_ELEMENTS[p.key] : <Navigate to="/" replace />} />
            ))}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <BottomNav />
        <div className="no-print">
          <ToastContainer />
          <DateTaskModal />
          <FloatingFocus />
          <TaskPlanner />
        </div>

        {/* Floating calendar toggle — above BottomNav on mobile, bottom-right on desktop */}
        {!calendarOpen && (
          <button
            onClick={() => setCalendarOpen(true)}
            className="no-print fixed bottom-[4.75rem] right-3 md:bottom-4 md:right-4 z-40 flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full px-3.5 py-2 shadow-lg hover:shadow-xl transition-shadow text-sm font-medium text-gray-700 dark:text-gray-300"
            title="เปิดปฏิทิน"
          >
            <Calendar size={15} className="text-primary-600" />
            <span className="hidden sm:inline">ปฏิทิน</span>
          </button>
        )}
        <div className="no-print"><CalendarDrawer open={calendarOpen} onClose={() => setCalendarOpen(false)} /></div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </MsalProvider>
  )
}
