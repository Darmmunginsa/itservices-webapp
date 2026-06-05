/**
 * Cloudflare Worker — SSL Certificate Checker Proxy
 *
 * แหล่งข้อมูล (Certificate Transparency logs):
 *   1. Cert Spotter (SSLMate)  — เสถียร เป็นหลัก
 *   2. crt.sh                  — fallback (flaky) retry 2 ครั้ง
 *
 * Deploy:
 *   Cloudflare Dashboard → Workers & Pages → crimson-sun-b5b8 → Edit code
 *   → วางทั้งไฟล์ → Save and Deploy
 *
 * Response (ตรงกับ frontend):
 *   { host, issuer, validFrom, validTo, daysRemaining, valid, source }
 *   หรือ { error }
 *
 * Usage: GET https://your-worker.workers.dev?domain=itservices.co.th
 */

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() })

    const { searchParams } = new URL(request.url)
    let domain = searchParams.get('domain') ?? ''
    try { domain = new URL(domain.includes('://') ? domain : `https://${domain}`).hostname } catch { /**/ }
    if (!domain) return json({ error: 'domain is required' }, 400)

    // 1) Cert Spotter (เสถียร)
    try {
      const r = await fetch(
        `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=false&expand=issuer`,
        { headers: { 'User-Agent': 'itservices-ssl-checker/3.0' }, cf: { cacheTtl: 300, cacheEverything: true } },
      )
      if (r.ok) {
        const arr = await r.json()
        if (Array.isArray(arr) && arr.length > 0) {
          const best = arr.reduce((a, b) => (toDate(b.not_after) > toDate(a.not_after) ? b : a))
          return result(domain, best.issuer?.name ?? best.issuer?.friendly_name ?? '-', best.not_before, best.not_after, 'certspotter')
        }
        // arr ว่าง = ไม่มีใน CT log → ลอง crt.sh ต่อ
      }
    } catch { /* ลอง fallback */ }

    // 2) crt.sh (fallback, flaky → retry)
    const url = `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'itservices-ssl-checker/3.0', 'Accept': 'application/json' },
          cf: { cacheTtl: 300, cacheEverything: true },
        })
        if (!res.ok) continue
        const text = await res.text()
        if (text.trimStart().startsWith('<')) continue
        const list = JSON.parse(text)
        if (Array.isArray(list) && list.length > 0) {
          const dl = domain.toLowerCase()
          const matches = list.filter(e => String(e.name_value ?? '').toLowerCase().split(/\s+/)
            .some(n => n === dl || (n.startsWith('*.') && dl.endsWith(n.slice(1)))))
          const pool = matches.length ? matches : list
          const best = pool.reduce((a, b) => (toDate(b.not_after) > toDate(a.not_after) ? b : a))
          return result(domain, best.issuer_name ?? '-', best.not_before, best.not_after, 'crt.sh')
        }
      } catch { /* retry */ }
    }

    return json({
      error: `ไม่พบ Certificate ของ ${domain} ใน CT log — อาจอยู่หลัง WAF/ภายในองค์กร หรือ CT service ขัดข้องชั่วคราว กรุณากรอกวันหมดอายุเอง`,
    }, 404)
  },
}

function result(host, issuer, notBefore, notAfter, source) {
  const daysRemaining = Math.floor((toDate(notAfter) - Date.now()) / 86400000)
  return json({
    host,
    issuer,
    validFrom: isoZ(notBefore),
    validTo: isoZ(notAfter),
    daysRemaining,
    valid: daysRemaining >= 0,
    source,
  })
}

function toDate(s) { return new Date(/[zZ]$/.test(s) ? s : `${s}Z`).getTime() }
function isoZ(s) { return s ? new Date(/[zZ]$/.test(s) ? s : `${s}Z`).toISOString() : null }

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors() } })
}
