export const SPEEDS = [
  { value: 0.5, label: 'Supertreg' },
  { value: 0.75, label: 'Slowed' },
  { value: 0.9, label: 'Litt treg' },
  { value: 1, label: 'Normal' },
  { value: 1.15, label: 'Sped up' },
  { value: 1.3, label: 'Nightcore' },
] as const

export const FILTERS = [
  { id: 'none', label: 'Ingen', hint: 'Ren lyd' },
  { id: 'lofi', label: 'Lo-fi', hint: 'Varm og dempet' },
  { id: 'underwater', label: 'Under vann', hint: 'Bare bassen slipper gjennom' },
  { id: 'phone', label: 'Telefon', hint: 'Tynn som en gammel høyttaler' },
  { id: 'bass', label: 'Bass boost', hint: 'Mer trykk i bunnen' },
  { id: 'echo', label: 'Ekko', hint: 'Stor sal med etterklang' },
  { id: 'spin', label: '8D', hint: 'Lyden sirkler rundt hodet' },
] as const

export type FxFilter = (typeof FILTERS)[number]['id']

export function clampSpeed(v: unknown) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 1
  return Math.min(2, Math.max(0.5, Math.round(n * 100) / 100))
}

export function toFilter(v: unknown): FxFilter {
  return FILTERS.some((f) => f.id === v) ? (v as FxFilter) : 'none'
}

export function fxLabel(speed: number, filter: string) {
  const parts: string[] = []
  if (speed !== 1) parts.push(SPEEDS.find((s) => s.value === speed)?.label ?? `${speed}×`)
  const f = FILTERS.find((x) => x.id === filter)
  if (f && f.id !== 'none') parts.push(f.label)
  return parts.join(' · ')
}
