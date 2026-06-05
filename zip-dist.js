import JSZip from 'jszip'
import fs from 'fs'
import path from 'path'

const zip = new JSZip()
const distDir = './dist'

function addFolder(zip, folderPath, zipPath) {
  const entries = fs.readdirSync(folderPath)
  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry)
    const zipEntry = zipPath ? `${zipPath}/${entry}` : entry
    if (fs.statSync(fullPath).isDirectory()) {
      addFolder(zip, fullPath, zipEntry)
    } else {
      zip.file(zipEntry, fs.readFileSync(fullPath))
    }
  }
}

addFolder(zip, distDir, '')

zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }).then(buf => {
  fs.writeFileSync('helpdesk.zip', buf)
  console.log('✅ helpdesk.zip created')
})
