export const BUILT_IN_SFX = [
  { kind: 'airhorn', label: 'Lufthorn' },
  { kind: 'siren', label: 'Sirene' },
  { kind: 'laser', label: 'Laser' },
  { kind: 'rewind', label: 'Spol tilbake' },
  { kind: 'drop', label: 'Bassdropp' },
  { kind: 'drumroll', label: 'Trommevirvel' },
  { kind: 'applause', label: 'Publikum' },
  { kind: 'chime', label: 'Kanaljingle' },
] as const

export type BuiltInSfxKind = (typeof BUILT_IN_SFX)[number]['kind']

export const REACTIONS = ['heart', 'fire', 'zap'] as const
export type Reaction = (typeof REACTIONS)[number]
