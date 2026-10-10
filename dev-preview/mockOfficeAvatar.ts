// preview เท่านั้น — คอลัมน์ Avatar ในหน่วยความจำ
const store = new Map<string, string>()
export async function getAllAvatars(): Promise<Map<string, string>> { return new Map(store) }
export async function saveMyAvatar(email: string, _name: string, json: string): Promise<void> { store.set(email.toLowerCase(), json) }
