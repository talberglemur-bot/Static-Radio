const ART: Record<string, string> = {
  main: '/channels/main.png',
  chill: '/channels/chill.png',
  hype: '/channels/hype.png',
}

export function channelArt(slug: string) {
  return ART[slug] ?? null
}
