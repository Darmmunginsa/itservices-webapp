import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { msalInstance } from './config/msal'
import App from './App.tsx'

msalInstance.initialize().then(async () => {
  // Detect if this window was opened as an MSAL popup (loginPopup / acquireTokenPopup).
  // In that case the URL will contain an auth code/token from Microsoft's redirect.
  // We must NOT render the full React app — just let MSAL process the response and
  // close the popup. Rendering the full app here is what caused the popup to stay
  // open and require a second user interaction.
  const hash = window.location.hash.substring(1)
  const search = window.location.search.substring(1)
  const params = new URLSearchParams(hash || search)
  const isMsalPopupRedirect =
    window.opener !== null &&
    (params.has('code') || params.has('error') || params.has('access_token') || params.has('id_token'))

  if (isMsalPopupRedirect) {
    // Process the auth response and let MSAL close the popup automatically
    await msalInstance.handleRedirectPromise().catch(() => {})
    return
  }

  // Normal app render for the main window
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
