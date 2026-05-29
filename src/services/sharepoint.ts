import { SHAREPOINT_API } from '../config/msal'

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

export async function spGet<T>(listName: string, filter?: string, select?: string, orderby?: string, top = 500): Promise<T[]> {
  const headers = await getHeaders()
  let url = `${SHAREPOINT_API}('${listName}')/items?$top=${top}`
  if (filter) url += `&$filter=${encodeURIComponent(filter)}`
  if (select) url += `&$select=${encodeURIComponent(select)}`
  if (orderby) url += `&$orderby=${encodeURIComponent(orderby)}`

  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`SharePoint GET failed: ${res.status} ${listName}`)
  const data = await res.json()
  return data.value as T[]
}

export async function spGetById<T>(listName: string, id: number): Promise<T> {
  const headers = await getHeaders()
  const url = `${SHAREPOINT_API}('${listName}')/items(${id})`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`SharePoint GET failed: ${res.status}`)
  return res.json() as Promise<T>
}

export async function spCreate(listName: string, data: Record<string, unknown>): Promise<{ id: number }> {
  const headers = await getHeaders()
  const url = `${SHAREPOINT_API}('${listName}')/items`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`SharePoint POST failed: ${res.status}`)
  return res.json()
}

export async function spUpdate(listName: string, id: number, data: Record<string, unknown>): Promise<void> {
  const headers = await getHeaders()
  const url = `${SHAREPOINT_API}('${listName}')/items(${id})`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`SharePoint PATCH failed: ${res.status}`)
}

export async function spDelete(listName: string, id: number): Promise<void> {
  const headers = await getHeaders()
  const url = `${SHAREPOINT_API}('${listName}')/items(${id})`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { ...headers, 'IF-MATCH': '*' },
  })
  if (!res.ok) throw new Error(`SharePoint DELETE failed: ${res.status}`)
}
