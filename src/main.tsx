import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { msalInstance } from './config/msal'

// ตั้ง data-fx ตั้งแต่ก่อน React ขึ้น — ไฟที่แถวงานเลยกำหนดจะได้ติดตั้งแต่เฟรมแรก
// ไม่ต้องรอให้ Celebration mount (ซึ่งอยู่หลังล็อกอิน)
{
  const m = localStorage.getItem('celebrationFx') ?? 'always'
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  document.documentElement.dataset.fx =
    m === 'always' ? 'on' : m === 'off' ? 'off' : (reduced ? 'off' : 'on')
}
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
