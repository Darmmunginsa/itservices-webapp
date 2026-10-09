// preview เท่านั้น — กล่องข้อความแนะนำตัวในหน่วยความจำ (แทน HD_OfficeSignal)
export const SIGNAL_LIST = 'HD_OfficeSignal'
export type SignalKind = 'offer' | 'answer' | 'bye' | 'reoffer' | 'reanswer'
export interface SignalRow { id: number; Title: string; FromEmail: string; ToEmail: string; Payload?: string; Created: string }

let box: SignalRow[] = []
let nextId = 1
export const sent: string[] = []

export async function sendSignal(from: string, to: string, kind: SignalKind, payload?: string): Promise<{ id: number }> {
  const id = nextId++
  box.push({ id, Title: kind, FromEmail: from.toLowerCase(), ToEmail: to.toLowerCase(), Payload: payload, Created: new Date().toISOString() })
  sent.push(`${from}→${to}:${kind}`)
  ;(window as unknown as { __signals: string[] }).__signals = sent
  return { id }
}

export async function takeSignals(me: string): Promise<SignalRow[]> {
  const mine = box.filter(r => r.ToEmail === me.toLowerCase())
  box = box.filter(r => r.ToEmail !== me.toLowerCase())
  return mine
}
