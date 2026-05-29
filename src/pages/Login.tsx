import { Shield } from 'lucide-react'
import { Button } from '../components/common/Button'
import { useAuth } from '../hooks/useAuth'
import { useState } from 'react'

export default function Login() {
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    setLoading(true)
    setError('')
    try {
      await login()
    } catch (e) {
      setError('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-sm text-center">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">iT Services Helpdesk</h1>
          <p className="text-sm text-gray-500 mb-8">เข้าสู่ระบบด้วย Microsoft Account</p>
          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
              {error}
            </div>
          )}
          <Button onClick={handleLogin} disabled={loading} className="w-full justify-center" size="lg">
            {loading ? 'กำลังเข้าสู่ระบบ...' : '🔑 Sign in with Microsoft'}
          </Button>
          <p className="mt-6 text-xs text-gray-400">
            ระบบนี้ใช้ Microsoft Azure AD Authentication<br />
            ข้อมูลของคุณถูกจัดเก็บใน SharePoint
          </p>
        </div>
      </div>
    </div>
  )
}
