export type Tier = 0 | 1 | 2
export type WeaponId = 'vandal' | 'sheriff'
export type ShotOutcome = 'head' | 'body' | 'miss'
export type Lang = 'zh' | 'en'

export interface ShotEvent {
  outcome: ShotOutcome
  isFirstShotOnTarget: boolean
  timeSinceVisibleMs: number
  /** true when the target was a copy spawned by a body hit */
  isPenalty: boolean
}

export interface RoundResult {
  at: number
  weapon: WeaponId
  tier: Tier
  score: number
  bestStreak: number
  bodyHits: number
  headshots: number
  penaltyKills: number
  shots: number
  accuracy: number
  firstShotHsRate: number
  avgTtkMs: number
  /** mean |vertical aim error| against the target head, degrees */
  avgAimErrorDeg: number
  /** share of shots that passed below the head centre */
  lowAimShare: number
  killsPerMin: number
  durationMs: number
  /** kept for compatibility; rounds always end on the timer now */
  endReason: 'time' | 'bodyHits'
}

export interface LeaderboardEntry {
  name: string
  score: number
  tier: Tier
  weapon: WeaponId
  headshots: number
  accuracy: number
  at: number
}

export interface Settings {
  sens: number
  dpi: number
  tier: Tier
  /** custom target counts, 0..MAX_PER_FLOOR */
  groundCount: number
  balconyCount: number
  /** all targets wander in two dimensions while true */
  moving: boolean
  /** shown on the local leaderboard */
  playerName: string
  weapon: WeaponId
  volume: number
  sound: boolean
  lang: Lang
  crosshairColor: string
  crosshairShape: 'dot' | 'cross'
  /** length of one arm, px */
  crosshairSize: number
  /** distance between the dot and the arms, px */
  crosshairGap: number
  crosshairThickness: number
  /** deterministic seed for the day, so everyone gets the same spawns */
  daily: boolean
}

export interface HudState {
  status: 'idle' | 'countdown' | 'playing' | 'paused' | 'finished'
  score: number
  streak: number
  timeLeftMs: number
  countdownMs: number
  headshots: number
  bodyHits: number
  penaltyKills: number
  /** penalty targets still on the field */
  pendingPenalties: number
}
