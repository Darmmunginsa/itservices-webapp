// คลังความรู้สาธารณะ — เขียนใน Helpdesk แล้ว "สร้างเว็บ" ออกมาเป็นไฟล์ static
//
// ทำไมต้อง static: คนนอกไม่มี token ของ M365 จึงอ่าน SharePoint ไม่ได้เลย
// การทำเว็บอีกตัวที่ต่อฐานข้อมูลแทนก็ต้องมี server + ทางเข้าข้อมูลที่เปิดสาธารณะ
// ซึ่งเป็นของที่ต้องดูแลและเป็นความเสี่ยงเพิ่ม — export เป็น HTML ล้วนจบกว่า
//
// ไฟล์นี้เป็น pure ทั้งหมด: ประกอบ HTML เป็น string ให้ทดสอบได้จริง
import { parseSections, parseInline } from './richNote'

export interface KbArticle {
  id: number
  Title: string
  ArticleCode?: string     // รหัสบทความ เช่น ITS000123 — ใช้ในชื่อไฟล์และให้อ้างอิงได้
  Summary?: string         // "Details" — อาการ/ปัญหา
  Resolution?: string      // วิธีแก้ (รูปแบบโน้ตเดียวกับที่ใช้ทั้งแอป)
  Cause?: string           // สาเหตุ
  Tags?: string
  ArticleStatus?: string   // Draft | Published
  Product?: string
  Created?: string
  Modified?: string
  Author?: { Title: string }
  AttachmentFiles?: { FileName: string }[]
}

export const isPublished = (a: KbArticle): boolean => (a.ArticleStatus ?? '') === 'Published'

/** หนีอักขระพิเศษก่อนใส่ลง HTML — เนื้อหามาจากผู้ใช้ และไฟล์นี้ถูกเผยแพร่ต่อสาธารณะ */
export function esc(raw: string): string {
  return (raw ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/**
 * ชื่อไฟล์/ลิงก์ของบทความ — ต้องคงที่ ไม่เปลี่ยนตามการแก้ชื่อเรื่อง
 * เพราะลิงก์ที่ส่งให้ลูกค้าไปแล้วต้องใช้ได้ตลอด จึงยึดรหัสบทความเป็นหลัก
 */
export function articleSlug(a: KbArticle): string {
  const code = (a.ArticleCode ?? '').trim().replace(/[^A-Za-z0-9_-]+/g, '')
  return (code || `article-${a.id}`).toLowerCase()
}
export const articleFile = (a: KbArticle): string => `${articleSlug(a)}.html`

/** ชื่อไฟล์รูปในเว็บที่ export — แยกโฟลเดอร์ต่อบทความ กันชื่อชนกันข้ามบทความ */
export const assetPath = (a: KbArticle, fileName: string): string =>
  `assets/${articleSlug(a)}/${fileName.replace(/[^A-Za-z0-9._-]+/g, '_')}`

export const tagList = (a: KbArticle): string[] =>
  (a.Tags ?? '').split(',').map(t => t.trim()).filter(Boolean)

/** วันที่แบบอ่านง่าย — ใช้ ISO ตรง ๆ กันเรื่อง locale ของเครื่องคนอ่าน */
export const shortDate = (iso?: string): string => (iso ?? '').slice(0, 10)

// ── แปลงเนื้อหาโน้ตเป็น HTML ──────────────────────────────────────────────
// ใช้ไวยากรณ์เดียวกับทั้งแอป: "## หัวข้อ", "- รายการ", URL, [[ไฟล์แนบ]]

function inlineHtml(text: string, a: KbArticle, files: Set<string>): string {
  return parseInline(text).map(seg => {
    if (seg.type === 'link') {
      return `<a href="${esc(seg.href)}" target="_blank" rel="noopener noreferrer">${esc(seg.text)}</a>`
    }
    if (seg.type === 'file') {
      const real = [...files].find(f => f.toLowerCase() === seg.name.toLowerCase())
      // อ้างถึงไฟล์ที่ไม่ได้แนบ — ไม่ต้องโชว์คำเตือนภายในให้คนนอกเห็น ตัดทิ้งเงียบ ๆ
      if (!real) return ''
      const src = assetPath(a, real)
      return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(real)
        ? `<figure><img src="${esc(src)}" alt="${esc(seg.name)}" loading="lazy"></figure>`
        : `<p><a class="file" href="${esc(src)}" download>${esc(real)}</a></p>`
    }
    return esc(seg.text)
  }).join('')
}

function bodyHtml(text: string, a: KbArticle, files: Set<string>): string {
  const out: string[] = []
  let bullets: string[] = []
  const flush = () => {
    if (bullets.length) { out.push(`<ul>${bullets.map(b => `<li>${b}</li>`).join('')}</ul>`); bullets = [] }
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*[-•]\s+(.*)$/)
    if (m) { bullets.push(inlineHtml(m[1], a, files)); continue }
    flush()
    if (!line.trim()) continue
    const html = inlineHtml(line, a, files)
    // บรรทัดที่เหลือแต่ token ของไฟล์ที่ไม่ได้แนบ จะกลายเป็นว่าง — อย่าปล่อย <p></p> ขึ้นเว็บ
    if (html.trim()) out.push(html.startsWith('<figure') || html.startsWith('<p') ? html : `<p>${html}</p>`)
  }
  flush()
  return out.join('')
}

export function noteHtml(raw: string | undefined, a: KbArticle, files: Set<string>): string {
  const sections = parseSections(raw)
  if (sections.length === 0) return ''
  return sections.map(s =>
    (s.heading ? `<h3>${esc(s.heading)}</h3>` : '') + bodyHtml(s.body, a, files)
  ).join('')
}

// ── หน้าเว็บ ─────────────────────────────────────────────────────────────

export interface SiteMeta {
  siteTitle: string
  org: string
  contact: string        // อีเมล/ลิงก์ให้ติดต่อกลับ
  homeUrl: string        // ลิงก์กลับเว็บบริษัท
}

const CSS = `
:root{--fg:#1a1a1a;--muted:#666;--line:#e2e2e2;--brand:#0F4C81;--bg:#fff;--card:#fafafa}
@media (prefers-color-scheme:dark){:root{--fg:#e8e8e8;--muted:#9aa0a6;--line:#333;--bg:#151515;--card:#1e1e1e}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
  font-family:"Segoe UI",-apple-system,"Noto Sans Thai",sans-serif;line-height:1.65;font-size:15px}
header{border-bottom:1px solid var(--line);padding:14px 20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
header a.brand{font-weight:700;color:var(--brand);text-decoration:none;font-size:17px}
header .sp{margin-left:auto}
main{max-width:900px;margin:0 auto;padding:24px 20px 60px}
h1{font-size:24px;line-height:1.35;margin:0 0 14px}
h2{font-size:17px;margin:26px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--line)}
h3{font-size:15px;margin:18px 0 6px}
p{margin:8px 0}
ul{margin:8px 0;padding-left:22px}
a{color:var(--brand)}
img{max-width:100%;height:auto;border:1px solid var(--line);border-radius:6px}
figure{margin:12px 0}
.meta{display:flex;flex-wrap:wrap;gap:8px 18px;color:var(--muted);font-size:13px;margin-bottom:22px}
.tag{display:inline-block;background:var(--card);border:1px solid var(--line);border-radius:99px;
  padding:2px 10px;font-size:12px;color:var(--muted);text-decoration:none}
.card{display:block;border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:10px;
  text-decoration:none;color:inherit;background:var(--card)}
.card:hover{border-color:var(--brand)}
.card h2{border:0;margin:0 0 4px;font-size:16px;color:var(--brand)}
.card p{margin:0;color:var(--muted);font-size:13px}
.search{width:100%;padding:11px 14px;font-size:15px;border:1px solid var(--line);border-radius:8px;
  background:var(--bg);color:var(--fg);margin-bottom:18px}
footer{border-top:1px solid var(--line);padding:18px 20px;color:var(--muted);font-size:12px;text-align:center}
.file{display:inline-block;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:6px 12px;font-size:13px}
.empty{color:var(--muted);text-align:center;padding:40px 0}
`.trim()

const shell = (title: string, m: SiteMeta, body: string, depth = 0): string => {
  const up = depth ? '../'.repeat(depth) : ''
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${up}style.css">
</head>
<body>
<header>
  <a class="brand" href="${up}index.html">${esc(m.siteTitle)}</a>
  <span class="sp"></span>
  ${m.homeUrl ? `<a href="${esc(m.homeUrl)}">${esc(m.org)}</a>` : ''}
</header>
<main>
${body}
</main>
<footer>
  ${esc(m.org)}${m.contact ? ` · <a href="mailto:${esc(m.contact)}">${esc(m.contact)}</a>` : ''}
</footer>
</body>
</html>`
}

/** หน้าบทความ 1 หน้า */
export function articleHtml(a: KbArticle, m: SiteMeta): string {
  const files = new Set((a.AttachmentFiles ?? []).map(f => f.FileName))
  const tags = tagList(a)
  const body = `
<h1>${esc(a.Title)}</h1>
<div class="meta">
  ${a.ArticleCode ? `<span>รหัสบทความ: ${esc(a.ArticleCode)}</span>` : ''}
  ${a.Product ? `<span>ผลิตภัณฑ์: ${esc(a.Product)}</span>` : ''}
  ${a.Modified ? `<span>อัปเดต: ${esc(shortDate(a.Modified))}</span>` : ''}
  ${a.Created ? `<span>เผยแพร่: ${esc(shortDate(a.Created))}</span>` : ''}
</div>
${tags.length ? `<p>${tags.map(t => `<span class="tag">${esc(t)}</span>`).join(' ')}</p>` : ''}
${a.Summary ? `<h2>อาการ / รายละเอียด</h2>${noteHtml(a.Summary, a, files)}` : ''}
${a.Resolution ? `<h2>วิธีแก้ไข</h2>${noteHtml(a.Resolution, a, files)}` : ''}
${a.Cause ? `<h2>สาเหตุ</h2>${noteHtml(a.Cause, a, files)}` : ''}
`.trim()
  return shell(`${a.Title} — ${m.siteTitle}`, m, body, 0)
}

/** หน้ารวม + ค้นหาฝั่งผู้อ่าน (ไม่มี server จึงค้นจาก JSON ที่แนบไปด้วย) */
export function indexHtml(list: KbArticle[], m: SiteMeta): string {
  const cards = list.map(a => `
<a class="card" href="${esc(articleFile(a))}">
  <h2>${esc(a.Title)}</h2>
  <p>${esc((a.Summary ?? '').replace(/[#\-*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160))}</p>
</a>`).join('')

  const body = `
<h1>${esc(m.siteTitle)}</h1>
<input class="search" id="q" type="search" placeholder="ค้นหาบทความ..." autocomplete="off">
<div id="list">${cards}</div>
<p class="empty" id="none" style="display:none">ไม่พบบทความที่ค้นหา</p>
<script>
(function(){
  var q=document.getElementById('q'),list=document.getElementById('list'),none=document.getElementById('none');
  var cards=[].slice.call(list.children), idx=[];
  fetch('search.json').then(function(r){return r.json()}).then(function(d){idx=d}).catch(function(){});
  q.addEventListener('input',function(){
    var s=q.value.trim().toLowerCase();
    if(!s){cards.forEach(function(c){c.style.display=''});none.style.display='none';return}
    var hit={};
    idx.forEach(function(a){ if(a.t.indexOf(s)>-1) hit[a.f]=1 });
    var shown=0;
    cards.forEach(function(c){
      var ok=hit[c.getAttribute('href')]?1:0;
      c.style.display=ok?'':'none'; shown+=ok;
    });
    none.style.display=shown?'none':'block';
  });
})();
</script>`.trim()
  return shell(m.siteTitle, m, body, 0)
}

/** ข้อมูลสำหรับช่องค้นหา — ทุกอย่างเป็นตัวพิมพ์เล็กไว้แล้ว ฝั่งผู้อ่านจะได้ไม่ต้องแปลงซ้ำ */
export function searchIndex(list: KbArticle[]): { f: string; t: string }[] {
  return list.map(a => ({
    f: articleFile(a),
    t: [a.Title, a.ArticleCode, a.Product, a.Tags, a.Summary, a.Resolution, a.Cause]
      .filter(Boolean).join(' ').toLowerCase(),
  }))
}

export const siteCss = (): string => CSS

/** สิ่งที่ยังขาดก่อนเผยแพร่ — บอกก่อน ไม่ปล่อยให้ขึ้นเว็บแล้วค่อยรู้ */
export function articleIssues(a: KbArticle): string[] {
  const out: string[] = []
  if (!(a.Title ?? '').trim()) out.push('ยังไม่มีชื่อเรื่อง')
  if (!(a.ArticleCode ?? '').trim()) out.push('ยังไม่มีรหัสบทความ (ลิงก์จะใช้เลข id แทน)')
  if (!(a.Summary ?? '').trim()) out.push('ยังไม่มีรายละเอียดอาการ')
  if (!(a.Resolution ?? '').trim()) out.push('ยังไม่มีวิธีแก้ไข')
  return out
}
