import { useMsal } from '@azure/msal-react'
import { useCallback } from 'react'
import { loginRequest } from '../config/msal'

export function useAuth() {
  const { instance, accounts } = useMsal()

  const login = useCallback(async () => {
    try {
      await instance.loginPopup(loginRequest)
    } catch (e) {
      console.error('Login failed', e)
      throw e
    }
  }, [instance])

  const logout = useCallback(async () => {
    await instance.logoutPopup({ postLogoutRedirectUri: window.location.origin })
  }, [instance])

  const getToken = useCallback(async (): Promise<string> => {
    const account = accounts[0]
    if (!account) throw new Error('Not authenticated')
    const result = await instance.acquireTokenSilent({
      ...loginRequest,
      account,
    })
    return result.accessToken
  }, [instance, accounts])

  return {
    account: accounts[0] ?? null,
    isAuthenticated: accounts.length > 0,
    login,
    logout,
    getToken,
  }
}
