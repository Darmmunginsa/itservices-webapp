// หน้าตาของแต่ละช่องบนแผนที่ — ใช้ร่วมกันระหว่างออฟฟิศ 2D และตัวแก้ผังใน Admin จะได้เห็นเหมือนกัน
export const TILE_STYLE: Record<string, { cls: string; emoji?: string }> = {
  '#': { cls: 'bg-slate-700 dark:bg-slate-800' },
  '.': { cls: 'bg-amber-100/70 dark:bg-amber-950/30' },
  M:   { cls: 'bg-orange-200/60 dark:bg-orange-900/30' },
  F:   { cls: 'bg-rose-200/60 dark:bg-rose-900/30' },
  C:   { cls: 'bg-cyan-200/60 dark:bg-cyan-900/30' },
  S:   { cls: 'bg-violet-200/60 dark:bg-violet-900/30' },
  E:   { cls: 'bg-violet-300/70 dark:bg-violet-800/40', emoji: '🚪' },
  d:   { cls: 'bg-amber-300/70 dark:bg-amber-800/40', emoji: '🖥️' },
  T:   { cls: 'bg-orange-300/80 dark:bg-orange-800/50' },
  P:   { cls: 'bg-amber-100/70 dark:bg-amber-950/30', emoji: '🪴' },
  K:   { cls: 'bg-cyan-200/60 dark:bg-cyan-900/30', emoji: '☕' },
  W:   { cls: 'bg-orange-200/60 dark:bg-orange-900/30', emoji: '📋' },
}

