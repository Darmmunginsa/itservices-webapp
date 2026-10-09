import { useEffect, useRef } from 'react'

/** แสดง MediaStream ของภาพหน้าจอ — srcObject ตั้งผ่าน ref เท่านั้น (ไม่ใช่ attribute) */
export function ScreenVideo({ stream, className = '', muted = true }: { stream: MediaStream; className?: string; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.srcObject = stream
    v.play().catch(() => { /* เล่นเองเมื่อมีภาพ */ })
    return () => { v.srcObject = null }
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />
}
