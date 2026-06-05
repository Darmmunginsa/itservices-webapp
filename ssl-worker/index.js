/**
 * Cloudflare Worker — SSL Certificate Checker Proxy
 *
 * Deploy:
 *   1. ไปที่ https://dash.cloudflare.com → Workers & Pages → Create Worker
 *   2. วาง code นี้ทั้งหมด แล้ว Save & Deploy
 *   3. Copy Worker URL เช่น https://ssl-check.YOUR_NAME.workers.dev
 *   4. ใส่ใน itservices-webapp/.env.local:
 *      VITE_SSL_WORKER_URL=https://ssl-check.YOUR_NAME.workers.dev
 *
 * Usage: GET https://your-worker.workers.dev?domain=itservices.co.th
 */

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    const { searchParams } = new URL(request.url)
    let domain = searchParams.get('domain') ?? ''

    // Strip protocol and path — keep only hostname
    try { domain = new URL(domain.includes('://') ? domain : `https://${domain}`).hostname } catch { /**/ }

    if (!domain) {
      return json({ error: 'domain is required' }, 400)
    }

    try {
      const res = await fetch(`https://ssl-checker.io/api/v1/check/${domain}`, {
        headers: { 'User-Agent': 'itservices-ssl-checker/1.0' },
      })

      if (!res.ok) return json({ error: `upstream ${res.status}` }, 502)

      const data = await res.json()
      return json(data)
    } catch (e) {
      return json({ error: String(e) }, 500)
    }
  },
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
