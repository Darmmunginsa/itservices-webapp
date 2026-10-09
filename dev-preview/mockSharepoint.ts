// preview เท่านั้น — PersonPhoto เรียกตัวนี้เฉพาะเมื่อมีชื่อไฟล์รูป (ไม่มี = อวาตาร์ตัวอักษร)
export async function spAttachmentBlobUrl(): Promise<string> { throw new Error('mock') }
export async function spGet<T>(): Promise<T[]> { return [] }
export async function spCreate(): Promise<{ id: number }> { return { id: 1 } }
export async function spUpdate(): Promise<void> {}
export async function spDelete(): Promise<void> {}
export async function spAttachmentBlob(): Promise<{ url: string; type: string }> { throw new Error('mock') }
