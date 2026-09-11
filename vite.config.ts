import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// เลขเวอร์ชันที่โชว์มุมล่างซ้าย — มาจาก package.json + วันที่ build + commit
// ให้คนบอกได้ว่าใช้ตัวไหนอยู่ตอนแจ้งปัญหา ("ตัวที่ deploy เมื่อไหร่" ตอบไม่ได้ถ้าไม่มีตรงนี้)
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const gitSha = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return '' } })()
const buildDate = new Date().toISOString().slice(0, 10)

export default defineConfig({
  plugins: [react()],
  base: '/helpdesk/',
  define: {
    global: 'globalThis',
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(buildDate),
    __GIT_SHA__: JSON.stringify(gitSha),
  },
  server: {
    port: 5173,
  },
})
