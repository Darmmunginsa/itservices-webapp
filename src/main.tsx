import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { msalInstance } from './config/msal'
import App from './App.tsx'

// Await MSAL initialization before mounting React so that
// useIsAuthenticated() immediately reflects cached tokens from localStorage.
// Without this, the app flickers to the Login page on every reload
// even when the user is already authenticated.
msalInstance.initialize().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
