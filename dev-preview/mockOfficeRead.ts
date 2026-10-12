// preview เท่านั้น — คอลัมน์ ReadState ในหน่วยความจำ · อารีย์กับนกอ่านแชททั้งออฟฟิศถึงข้อความล่าสุดเสมอ (ไว้ดู "อ่านแล้ว")
const store = new Map<string, string>()
export async function getAllReadStates(): Promise<Map<string, string>> {
  const m = new Map(store)
  for (const e of ['aree@x', 'nok@x']) m.set(e, JSON.stringify({ c: { '': 999999 }, d: { 'me@x': 999999 } }))
  return m
}
export async function saveMyReadState(email: string, _name: string, json: string): Promise<void> { store.set(email.toLowerCase(), json) }
