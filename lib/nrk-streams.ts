export type NrkStream = { id: string; name: string; src: string }

// radio.nrk.no/direkte/<slug> page slugs whose audio stream doesn't follow the nrk_radio_<slug>_mp3_h pattern.
const DIREKTE_OVERRIDES: Record<string, string> = {
  p1: 'nrk_radio_p1_ostlandssendingen_mp3_h',
}

/**
 * Turns what staff paste into a playable stream URL.
 * Accepts NRK pages like https://radio.nrk.no/direkte/p3 or https://lyd.nrk.no/kanal/p3,
 * plus any direct https audio stream. Returns null when it isn't a usable URL.
 */
export function normalizeStreamUrl(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null

  const host = url.hostname.toLowerCase()
  if (host === 'radio.nrk.no' || host === 'lyd.nrk.no' || host === 'www.nrk.no' || host === 'nrk.no') {
    const parts = url.pathname.split('/').filter(Boolean)
    const marker = parts.findIndex((p) => p === 'direkte' || p === 'kanal')
    const slug = marker >= 0 ? parts[marker + 1] : null
    if (slug && /^[a-z0-9_]+$/i.test(slug)) {
      const key = slug.toLowerCase()
      return `https://lyd.nrk.no/${DIREKTE_OVERRIDES[key] ?? `nrk_radio_${key}_mp3_h`}`
    }
  }
  return url.toString().slice(0, 500)
}

export function guessStreamName(input: string): string {
  try {
    const url = new URL(input.trim())
    const parts = url.pathname.split('/').filter(Boolean)
    const marker = parts.findIndex((p) => p === 'direkte' || p === 'kanal')
    const slug = marker >= 0 ? parts[marker + 1] : null
    if (slug && url.hostname.endsWith('nrk.no')) return `NRK ${slug.toUpperCase()}`
    return url.hostname.replace(/^www\./, '')
  } catch {
    return 'Ny kanal'
  }
}
