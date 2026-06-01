import { useMsal } from '@azure/msal-react'
import { useCallback } from 'react'
import { loginRequest, REDIRECT_URI } from '../config/msal'
import { InteractionRequiredAuthError } from '@azure/msal-browser'

export function useAuth() {
  const { instance, accounts } = useMsal()

  const login = useCallback(async () => {
    // Use redirect instead of popup — eliminates popup isolation issues
    // (Edge opens popups as InPrivate windows with separate localStorage,
    // causing MSAL popup state mismatch and the window staying open).
    await instance.loginRedirect({
      ...loginRequest,
      redirectUri: REDIRECT_URI,
    })
  }, [instance])

  const logout = useCallback(async () => {
    await instance.logoutRedirect({ postLogoutRedirectUri: REDIRECT_URI })
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
        // Fallback: redirect for re-consent (rare, silent should cover normal use)
        await instance.acquireTokenRedirect({
          ...loginRequest,
          account,
          redirectUri: REDIRECT_URI,
        })
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
