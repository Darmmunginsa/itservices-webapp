import { SHAREPOINT_API, SHAREPOINT_URL } from '../config/msal'

const SP_HOST = SHAREPOINT_URL.replace(/\/sites\/.*/, '')

let _getToken: (() => Promise<string>) | null = null

export function setTokenGetter(fn: () => Promise<string>) {
  _getToken = fn
}

async function getHeaders(): Promise<HeadersInit> {
  if (!_getToken) throw new Error('Token getter not initialized')
  const token = await _getToken()
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json;odata=nometadata',
    'Content-Type': 'application/json',
  }
}

// Fetch list items from ANY site under the same SharePoint host (same token works).
// siteRelativeUrl e.g. '/sites/SalesQuotation'
export async function spGetFromSite<T>(siteRelativeUrl: string, listName: string, select?: string, top = 999): Promise<T[]> {
  const headers = await getHeaders()
  let url = `${SP_HOST}${siteRelativeUrl}/_api/web/lists/getbytitle('${listName}')/items?$top=${top}`
  if (select) url += `&$select=${encodeURIComponent(select)}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`SP cross-site GET failed: ${res.status} ${listName}`)
  const data = await res.json()
  const items = (data.value || []) as Array<Record<string, unknown>>
  return items.map(item => ({ ...item, id: (item['ID'] ?? item['Id']) as number })) as T[]
}

export async function spGet<T>(listName: string, filter?: string, select?: string, orderby?: string, top = 500, expand?: string): Promise<T[]> {
  const headers = await getHeaders()
  let url = `${SHAREPOINT_API}('${listName}')/items?$top=${top}`
  if (filter) url += `&$filter=${encodeURIComponent(filter)}`
  if (select) url += `&$select=${encodeURIComponent(select)}`
  if (orderby) url += `&$orderby=${encodeURIComponent(orderby)}`
  if (expand) url += `&$expand=${encodeURIComponent(expand)}`

  const res = await fetch(url, { headers })
  if (!res.ok) {
    let body = ''
    try { body = await res.text() } catch { /* ignore */ }
    console.error(`[SP] GET ${listName} → HTTP ${res.status}`, body)
    throw new Error(`SharePoint GET failed: ${res.status} ${listName}`)
  }
  const data = await res.json()
  // SharePoint REST API returns item ID as uppercase "ID".
  // Normalise to lowercase "id" so all TypeScript interfaces work correctly.
  const items = data.value as Array<Record<string, unknown>>
  return items.map(item => ({ ...item, id: (item['ID'] ?? item['Id']) as number })) as T[]
}

export async function spGetById<T>(listName: string, id: number): Promise<T> {
  const headers = await getHeaders()
  const url = `${SHAREPOINT_API}('${listName}')/items(${id})`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    let body = ''; try { body = await res.text() } catch { /* ignore */ }
    console.error(`[SP] GET ${listName}(${id}) → HTTP ${res.status}`, body)
    throw new Error(`SharePoint GET failed: ${res.status}`)
  }
  const item = await res.json() as Record<string, unknown>
  return { ...item, id: (item['ID'] ?? item['Id']) as number } as T
}

export async function spCreate(listName: string, data: Record<string, unknown>): Promise<{ id: number }> {
  const headers = await getHeaders()
  const url = `${SHAREPOINT_API}('${listName}')/items`
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) })
  if (!res.ok) {
    let body = ''; try { body = await res.text() } catch { /* ignore */ }
    console.error(`[SP] POST ${listName} → HTTP ${res.status}`, body)
    throw new Error(`SharePoint POST failed: ${res.status} ${listName}`)
  }
  const item = await res.json() as Record<string, unknown>
  return { ...item, id: (item['ID'] ?? item['Id']) as number } as { id: number }
}

export async function spUpdate(listName: string, id: number, data: Record<string, unknown>): Promise<void> {
  const headers = await getHeaders()
  const url = `${SHAREPOINT_API}('${listName}')/items(${id})`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    let body = ''; try { body = await res.text() } catch { /* ignore */ }
    console.error(`[SP] PATCH ${listName}(${id}) → HTTP ${res.status}`, body)
    throw new Error(`SharePoint PATCH failed: ${res.status} ${listName}`)
  }
}

export async function spDelete(listName: string, id: number): Promise<void> {
  const headers = await getHeaders()
  const url = `${SHAREPOINT_API}('${listName}')/items(${id})`
  const res = await fetch(url, { method: 'DELETE', headers: { ...headers, 'IF-MATCH': '*' } })
  if (!res.ok) {
    console.error(`[SP] DELETE ${listName}(${id}) → HTTP ${res.status}`)
    throw new Error(`SharePoint DELETE failed: ${res.status} ${listName}`)
  }
}

export async function spGetAttachments(
  listName: string,
  itemId: number,
): Promise<Array<{ FileName: string; ServerRelativeUrl: string }>> {
  const headers = await getHeaders()
  const url = `${SHAREPOINT_API}('${listName}')/items(${itemId})/AttachmentFiles`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    let body = ''; try { body = await res.text() } catch { /* ignore */ }
    console.error(`[SP] GET attachments ${listName}(${itemId}) → HTTP ${res.status}`, body)
    throw new Error(`SharePoint GET attachments failed: ${res.status}`)
  }
  const data = await res.json()
  return (data.value ?? []) as Array<{ FileName: string; ServerRelativeUrl: string }>
}

export async function spUploadAttachment(listName: string, itemId: number, file: File): Promise<void> {
  if (!_getToken) throw new Error('Token getter not initialized')
  const token = await _getToken()
  const url = `${SHAREPOINT_API}('${listName}')/items(${itemId})/AttachmentFiles/add(FileName='${file.name}')`
  const buffer = await file.arrayBuffer()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json;odata=nometadata',
    },
    body: buffer,
  })
  if (!res.ok) {
    let body = ''; try { body = await res.text() } catch { /* ignore */ }
    console.error(`[SP] UPLOAD attachment ${listName}(${itemId}) → HTTP ${res.status}`, body)
    throw new Error(`SharePoint attachment upload failed: ${res.status}`)
  }
}

export async function spDeleteAttachment(listName: string, itemId: number, fileName: string): Promise<void> {
  const headers = await getHeaders()
  const url = `${SHAREPOINT_API}('${listName}')/items(${itemId})/AttachmentFiles('${encodeURIComponent(fileName)}')`
  const res = await fetch(url, { method: 'POST', headers: { ...headers, 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' } })
  if (!res.ok) {
    let body = ''; try { body = await res.text() } catch { /* ignore */ }
    console.error(`[SP] DELETE attachment ${listName}(${itemId})/${fileName} → HTTP ${res.status}`, body)
    throw new Error(`SharePoint attachment delete failed: ${res.status}`)
  }
}

export function spAttachmentUrl(serverRelativeUrl: string): string {
  return `${SP_HOST}${serverRelativeUrl}`
}
