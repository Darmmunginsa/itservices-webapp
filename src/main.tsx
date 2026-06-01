import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { msalInstance } from './config/msal'
import App from './App.tsx'

msalInstance.initialize().then(() => {
  // With loginRedirect flow, handle the auth redirect before rendering.
  // MsalProvider handles this internally, but calling it here ensures
  // the redirect promise is settled before React mounts.
  msalInstance.handleRedirectPromise().catch(() => {}).finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
})
