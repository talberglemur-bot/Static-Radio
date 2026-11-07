export type BuiltInAd = {
  id: string
  advertiser: string
  script: string
}

/** Fictional Norwegian radio spots, read aloud in each listener's browser with a Norwegian voice. */
export const BUILT_IN_ADS: BuiltInAd[] = [
  {
    id: 'bakeri',
    advertiser: 'Solsiden Bakeri',
    script:
      'Er du sulten på noe godt? Solsiden Bakeri baker ferske kanelboller hver morgen klokka seks. To boller og en kaffe for femtini kroner. Solsiden Bakeri – smaken av en god morgen.',
  },
  {
    id: 'sykkel',
    advertiser: 'Fjelltopp Sykkel',
    script:
      'Våren er her! Hos Fjelltopp Sykkel får du full service på sykkelen din for bare fire hundre og nittini kroner. Bestill time i dag, og trill ut i sola i morgen.',
  },
  {
    id: 'stromavtale',
    advertiser: 'Nordlys Energi',
    script:
      'Lei av høye strømregninger? Nordlys Energi gir deg fastpris uten skjulte gebyrer. Bytt på to minutter. Nordlys Energi – lys i husken, ro i lommeboka.',
  },
  {
    id: 'pizza',
    advertiser: 'Pizza Bergen',
    script:
      'Fredagskos? Pizza Bergen leverer på tretti minutter, ellers er den gratis. Bruk koden RADIO og få ti prosent rabatt. Pizza Bergen – fordi fredag fortjener det.',
  },
  {
    id: 'konsert',
    advertiser: 'Sentrum Scene',
    script:
      'Denne lørdagen på Sentrum Scene: en kveld full av norsk pop og nye stjerner. Dørene åpner klokka åtte. Billetter får du på nett. Vi sees foran scenen!',
  },
  {
    id: 'kjoreskole',
    advertiser: 'Trygg Trafikkskole',
    script:
      'Skal du ta lappen? Trygg Trafikkskole har ledige kjøretimer hele uka. Rolige lærere, nye biler og gode resultater. Trygg Trafikkskole – vi får deg trygt fram.',
  },
]

export const AD_JINGLE_SEC = 2.2

/** Generous estimate of how long a spoken spot takes, so music resumes after the speech ends. */
export function estimateAdSeconds(script: string) {
  return Math.ceil(script.length / 13) + AD_JINGLE_SEC + 0.8
}

export type AdItem = { type: 'tts'; id: string } | { type: 'track'; id: number }

export function encodeAdItems(items: AdItem[]) {
  return 'ad:' + items.map((i) => `${i.type}-${i.id}`).join(',')
}

export type AdSlot = {
  type: 'tts' | 'track'
  id: string
  title: string
  script: string | null
  src: string | null
  startSec: number
  durationSec: number
}

/**
 * Lays the spots out on a shared clock (jingle first, a short gap between spots)
 * so every listener hears the same spot at the same moment, including late joiners.
 */
export function buildAdTimeline(
  items: AdItem[],
  tracks: { id: number; title: string; durationSec: number }[],
) {
  const slots: AdSlot[] = []
  let cursor = AD_JINGLE_SEC
  for (const item of items) {
    if (item.type === 'tts') {
      const ad = BUILT_IN_ADS.find((a) => a.id === item.id)
      if (!ad) continue
      const durationSec = estimateAdSeconds(ad.script) - AD_JINGLE_SEC
      slots.push({ type: 'tts', id: ad.id, title: ad.advertiser, script: ad.script, src: null, startSec: cursor, durationSec })
      cursor += durationSec + AD_GAP_SEC
    } else {
      const t = tracks.find((x) => x.id === item.id)
      if (!t) continue
      slots.push({
        type: 'track',
        id: String(t.id),
        title: t.title,
        script: null,
        src: `/api/media/track/${t.id}`,
        startSec: cursor,
        durationSec: t.durationSec,
      })
      cursor += t.durationSec + AD_GAP_SEC
    }
  }
  return { slots, totalSec: cursor }
}

export const AD_GAP_SEC = 0.6

export function decodeAdItems(kind: string): AdItem[] {
  return kind
    .slice(3)
    .split(',')
    .map((s): AdItem | null => {
      const [type, id] = [s.slice(0, s.indexOf('-')), s.slice(s.indexOf('-') + 1)]
      if (type === 'tts' && BUILT_IN_ADS.some((a) => a.id === id)) return { type, id }
      if (type === 'track' && Number.isInteger(Number(id))) return { type, id: Number(id) }
      return null
    })
    .filter((x): x is AdItem => x !== null)
}
