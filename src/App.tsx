import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MsalProvider, useIsAuthenticated, useMsal } from '@azure/msal-react'
import { PublicClientApplication, EventType } from '@azure/msal-browser'
import { msalConfig, sharepointRequest, REDIRECT_URI } from './config/msal'
import { useAppStore } from './store/useAppStore'
import { setTokenGetter } from './services/sharepoint'
import { setGraphTokenGetter } from './services/graph'
import { spGet } from './services/sharepoint'
import type { AgentProfile, UserProfile } from './types/common'

import { Sidebar } from './components/layout/Sidebar'
import { BottomNav } from './components/layout/BottomNav'
import { Ticker } from './components/layout/Ticker'
import { ToastContainer } from './components/common/Toast'

import Login from './pages/Login'
import Home from './pages/Home'
import Submit from './pages/Submit'
import MyWork from './pages/MyWork'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import TicketDetail from './pages/TicketDetail'
import AgentDashboard from './pages/AgentDashboard'
import Assets from './pages/Assets'
import Tracking from './pages/Tracking'
import Skills from './pages/Skills'
import Contracts from './pages/Contracts'
import './index.css'

const msalInstance = new PublicClientApplication(msalConfig)

// Handle redirect response (fallback จาก loginRedirect)
msalInstance.initialize().then(() => {
  msalInstance.handleRedirectPromise().catch(() => {})

  // Set active account หลัง redirect กลับมา
  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as { account?: unknown }
      if (payload.account) {
        msalInstance.setActiveAccount(payload.account as never)
      }
    }
  })
})

function AppContent() {
  const isAuthenticated = useIsAuthenticated()
  const { instance, accounts } = useMsal()
  const { user, setUser, isDarkMode } = useAppStore()

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [isDarkMode])

  useEffect(() => {
    if (!isAuthenticated || !accounts[0]) return

    // Token for SharePoint REST API (ต้องใช้ SharePoint resource scope)
    const getSpToken = async () => {
      const result = await instance.acquireTokenSilent({
        ...sharepointRequest,
        account: accounts[0],
        redirectUri: REDIRECT_URI,
      })
      return result.accessToken
    }

    // Token for Microsoft Graph (User.Read, Calendars.ReadWrite)
    const getGraphToken = async () => {
      const result = await instance.acquireTokenSilent({
        scopes: ['User.Read', 'Calendars.ReadWrite'],
        account: accounts[0],
        redirectUri: REDIRECT_URI,
      })
      return result.accessToken
    }

    setTokenGetter(getSpToken)
    setGraphTokenGetter(getGraphToken)

    const account = accounts[0]
    const email = account.username

    spGet<AgentProfile>('HD_AgentProfiles', `AgentEmail eq '${email}'`)
      .then(profiles => {
        const profile = profiles[0]
        const userProfile: UserProfile = {
          id: account.localAccountId,
          displayName: account.name ?? email,
          email,
          role: profile?.Role ?? 'EndUser',
          agentProfile: profile,
        }
        setUser(userProfile)
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

  if (!isAuthenticated) return <Login />

  if (!user) {
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
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <div className="flex-1 md:ml-56 flex flex-col min-h-screen">
        <Ticker />
        <main className="flex-1 pb-16 md:pb-0">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/submit" element={<Submit />} />
            <Route path="/my-work" element={<MyWork />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/dashboard" element={<AgentDashboard />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/tracking" element={user.role === 'Boss' || user.role === 'Admin' ? <Tracking /> : <Navigate to="/" />} />
            <Route path="/skills" element={<Skills />} />
            <Route path="/contracts" element={user.role === 'Admin' ? <Contracts /> : <Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <BottomNav />
        <ToastContainer />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <BrowserRouter basename={import.meta.env.BASE_URL ?? '/'}>
        <AppContent />
      </BrowserRouter>
    </MsalProvider>
  )
}
