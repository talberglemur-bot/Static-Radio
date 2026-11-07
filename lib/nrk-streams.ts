export type NrkStream = { id: string; name: string; src: string }

/** Public NRK live streams served from lyd.nrk.no. Only ids are stored; urls never come from user input. */
export const NRK_STREAMS: NrkStream[] = [
  { id: 'p1', name: 'NRK P1', src: 'https://lyd.nrk.no/nrk_radio_p1_ostlandssendingen_mp3_h' },
  { id: 'p1pluss', name: 'NRK P1+', src: 'https://lyd.nrk.no/nrk_radio_p1pluss_mp3_h' },
  { id: 'p2', name: 'NRK P2', src: 'https://lyd.nrk.no/nrk_radio_p2_mp3_h' },
  { id: 'p3', name: 'NRK P3', src: 'https://lyd.nrk.no/nrk_radio_p3_mp3_h' },
  { id: 'p13', name: 'NRK P13', src: 'https://lyd.nrk.no/nrk_radio_p13_mp3_h' },
  { id: 'mp3', name: 'NRK mP3', src: 'https://lyd.nrk.no/nrk_radio_mp3_mp3_h' },
  { id: 'jazz', name: 'NRK Jazz', src: 'https://lyd.nrk.no/nrk_radio_jazz_mp3_h' },
  { id: 'klassisk', name: 'NRK Klassisk', src: 'https://lyd.nrk.no/nrk_radio_klassisk_mp3_h' },
  { id: 'folkemusikk', name: 'NRK Folkemusikk', src: 'https://lyd.nrk.no/nrk_radio_folkemusikk_mp3_h' },
]
