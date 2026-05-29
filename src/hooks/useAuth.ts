import { useMsal } from '@azure/msal-react'
import { useCallback } from 'react'
import { loginRequest, REDIRECT_URI } from '../config/msal'
import { InteractionRequiredAuthError } from '@azure/msal-browser'

export function useAuth() {
  const { instance, accounts } = useMsal()

  const login = useCallback(async () => {
    try {
      await instance.loginPopup({ ...loginRequest, redirectUri: REDIRECT_URI })
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? ''
      if (
        msg.includes('popup_window_error') ||
        msg.includes('empty_window_error') ||
        msg.includes('timed_out')
      ) {
        await instance.loginRedirect({ ...loginRequest, redirectUri: REDIRECT_URI })
      } else {
        throw e
      }
    }
  }, [instance])

  const logout = useCallback(async () => {
    try {
      await instance.logoutPopup({ postLogoutRedirectUri: REDIRECT_URI })
    } catch {
      await instance.logoutRedirect({ postLogoutRedirectUri: REDIRECT_URI })
    }
  }, [instance])

  const getToken = useCallback(async (): Promise<string> => {
    const account = accounts[0]
    if (!account) throw new Error('Not authenticated')
    try {
      const result = await instance.acquireTokenSilent({
        ...loginRequest,
        account,
        redirectUri: REDIRECT_URI,
      })
      return result.accessToken
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        const result = await instance.acquireTokenPopup({
          ...loginRequest,
          account,
          redirectUri: REDIRECT_URI,
        })
        return result.accessToken
      }
      throw e
    }
  }, [instance, accounts])

  return {
    account: accounts[0] ?? null,
    isAuthenticated: accounts.length > 0,
    login,
    logout,
    getToken,
  }
}
