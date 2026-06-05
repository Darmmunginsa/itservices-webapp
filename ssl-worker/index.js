/**
 * Cloudflare Worker — SSL Certificate Checker Proxy (crt.sh based)
 *
 * Deploy:
 *   1. https://dash.cloudflare.com → Workers & Pages → เปิด worker เดิม (crimson-sun-b5b8)
 *      หรือ Create Worker ใหม่
 *   2. วาง code นี้ทั้งหมด → Save & Deploy
 *   3. Worker URL ต้องตรงกับ VITE_SSL_WORKER_URL ใน .env
 *
 * Response shape (ตรงกับ frontend):
 *   { host, issuer, validTo, validFrom, daysRemaining, valid, source }
 *   หรือ { error } ถ้าหาไม่ได้
 *
 * Usage: GET https://your-worker.workers.dev?domain=itservices.co.th
 */

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors() })
    }

    const { searchParams } = new URL(request.url)
    let domain = searchParams.get('domain') ?? ''
    try { domain = new URL(domain.includes('://') ? domain : `https://${domain}`).hostname } catch { /**/ }
    if (!domain) return json({ error: 'domain is required' }, 400)

    try {
      // crt.sh flaky มาก — retry สูงสุด 3 ครั้ง (exclude=expired ทำให้ 502 จึงกรองเอง)
      const url = `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`
      let list = null, lastErr = ''
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': 'itservices-ssl-checker/2.0', 'Accept': 'application/json' },
            cf: { cacheTtl: 300, cacheEverything: true },
          })
          if (!res.ok) { lastErr = `crt.sh ตอบกลับ ${res.status}`; continue }
          const text = await res.text()
          if (text.trimStart().startsWith('<')) { lastErr = 'crt.sh ส่ง HTML (ชั่วคราว)'; continue }
          const parsed = JSON.parse(text)
          if (Array.isArray(parsed)) { list = parsed; break }
          lastErr = 'crt.sh คืนข้อมูลไม่ถูกต้อง'
        } catch (e) { lastErr = String(e) }
      }
      if (!list) return json({ error: `${lastErr} — crt.sh ไม่ตอบสนอง ลองกดตรวจใหม่อีกครั้ง` }, 502)
      if (list.length === 0) {
        return json({ error: `ไม่พบ Certificate ของ ${domain} ใน CT log (อาจอยู่หลัง WAF/ภายในองค์กร — กรุณากรอกวันหมดอายุเอง)` }, 404)
      }

      const dl = domain.toLowerCase()
      // match: ชื่อโดเมนตรง หรือ wildcard ครอบ
      const matches = list.filter(e => {
        const names = String(e.name_value ?? '').toLowerCase().split(/\s+/)
        return names.some(n => n === dl || (n.startsWith('*.') && dl.endsWith(n.slice(1))))
      })
      const pool = matches.length ? matches : list

      // เลือกใบที่หมดอายุช้าสุด = ใบล่าสุดที่ยัง valid
      const best = pool.reduce((a, b) => (toDate(b.not_after) > toDate(a.not_after) ? b : a))

      const validTo = isoZ(best.not_after)
      const validFrom = isoZ(best.not_before)
      const daysRemaining = Math.floor((toDate(best.not_after) - Date.now()) / 86400000)

      return json({
        host: domain,
        issuer: best.issuer_name ?? '-',
        validFrom,
        validTo,
        daysRemaining,
        valid: daysRemaining >= 0,
        source: 'crt.sh',
      })
    } catch (e) {
      return json({ error: String(e) }, 500)
    }
  },
}

function toDate(s) { return new Date(`${s}Z`).getTime() }
function isoZ(s) { return s ? new Date(`${s}Z`).toISOString() : null }

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
}
