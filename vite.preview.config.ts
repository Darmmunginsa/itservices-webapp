// preview ชั่วคราวของ Office2D โดยไม่ต้อง login SharePoint — ไม่ใช้ใน build จริง
import { defineConfig, mergeConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import base from './vite.config'

const abs = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default mergeConfig(base, defineConfig({
  resolve: {
    alias: [
      { find: /^(.*)\/services\/office$/, replacement: abs('./dev-preview/mockOffice.ts') },
      { find: /^(.*)\/services\/sharepoint$/, replacement: abs('./dev-preview/mockSharepoint.ts') },
      { find: /^(.*)\/services\/voiceSignal$/, replacement: abs('./dev-preview/mockVoiceSignal.ts') },
      { find: /^(.*)\/services\/officeDM$/, replacement: abs('./dev-preview/mockOfficeDM.ts') },
      { find: /^(.*)\/services\/officeDecor$/, replacement: abs('./dev-preview/mockOfficeDecor.ts') },
      { find: /^(.*)\/services\/officeAvatar$/, replacement: abs('./dev-preview/mockOfficeAvatar.ts') },
    ],
  },
  server: { port: 5179 },
}))
