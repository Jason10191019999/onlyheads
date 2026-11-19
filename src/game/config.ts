import type { Tier, WeaponId } from './types'

/** Player */
export const PLAYER_EYE = 1.65
export const PLAYER_Z = 6
export const PLAYER_SPEED = 6.75
export const PLAYER_WALK_SPEED = 3.375
export const PLAYER_MIN_X = -11
export const PLAYER_MAX_X = 11
export const PLAYER_MIN_Z = -11
export const PLAYER_MAX_Z = 14
export const FOV = 103
/** Jump: ~0.75 m high, ~0.6 s in the air, close to Valorant's hop. */
export const JUMP_SPEED = 5.2
export const GRAVITY = 18

/** Dummy */
export const HEAD_CENTER_Y = 1.65
export const HEAD_RADIUS = 0.13
export const BALCONY_Y = 3.0
export const RAIL_HEIGHT = 0.7
export const RAIL_TOP = BALCONY_Y + RAIL_HEIGHT
export const BALCONY_HEAD_Y = BALCONY_Y + HEAD_CENTER_Y

/** Timing */
export const ROUND_MS = 60_000
export const COUNTDOWN_MS = 3_000
/** Body hits it takes to clear a penalty clone. Headshots always kill in one. */
export const CLONE_BODY_HITS = 4
export const RESPAWN_MS = 600
export const BROKEN_MS = 600
export const WALK_OUT_MS = 350

/** Randomisation so the range never looks like a grid */
export const SPAWN_JITTER_X = 0.5
export const SPAWN_JITTER_Z = 0.4
export const MIN_TARGET_GAP = 1.0

export interface WeaponConfig {
  id: WeaponId
  fireRate: number
  automatic: boolean
}

export const WEAPONS: Record<WeaponId, WeaponConfig> = {
  vandal: { id: 'vandal', fireRate: 9.75, automatic: true },
  sheriff: { id: 'sheriff', fireRate: 4, automatic: false },
}

export interface TierConfig {
  id: Tier
  key: 'casual' | 'standard' | 'hardcore'
  /** targets alive on the ground floor and on the balcony */
  ground: number
  balcony: number
}

export const TIERS: TierConfig[] = [
  { id: 0, key: 'casual', ground: 3, balcony: 3 },
  { id: 1, key: 'standard', ground: 5, balcony: 5 },
  { id: 2, key: 'hardcore', ground: 7, balcony: 7 },
]

export function tierConfig(tier: Tier): TierConfig {
  return TIERS[tier]
}

export interface Pillar {
  x: number
  w: number
  h: number
}

/** Deliberately uneven: widths, heights and spacing all differ. */
export const PILLARS: Pillar[] = [
  { x: -11.6, w: 1.1, h: 2.2 },
  { x: -8.0, w: 1.7, h: 1.8 },
  { x: -4.3, w: 1.2, h: 2.4 },
  { x: 0.2, w: 2.0, h: 1.9 },
  { x: 4.5, w: 1.3, h: 2.1 },
  { x: 8.2, w: 1.6, h: 1.7 },
  { x: 11.6, w: 1.15, h: 2.3 },
]

export const PILLAR_Z = -6.9
export const BALCONY_Z = -7.4

export type BalconySpot = 'left' | 'right' | 'top' | 'front'

export interface Slot {
  id: number
  floor: 0 | 1
  x: number
  z: number
  /** feet height in world space (0 on the ground floor, 3.0 on the balcony, higher on a pillar top) */
  baseY: number
  distance: number
  /** balcony dummies start behind this pillar x and walk out */
  hiddenX: number | null
}

function slot(
  id: number,
  floor: 0 | 1,
  x: number,
  z: number,
  baseY = 0,
  hiddenX: number | null = null,
): Slot {
  const headY = baseY + HEAD_CENTER_Y
  const distance = Math.hypot(x, z - PLAYER_Z, headY - PLAYER_EYE)
  return { id, floor, x, z, baseY, distance, hiddenX }
}

export const GROUND_SLOTS: Slot[] = [
  ...[-9, -6, -3, 0, 3, 6, 9].map((x, i) => slot(i, 0, x, -3)),
  ...[-9, -5.4, -1.8, 1.8, 5.4, 9].map((x, i) => slot(100 + i, 0, x, -9)),
]

/**
 * Balcony spots are spaced so every one of them has room to split into two
 * dummies (+-0.55 m on each side). That rules out the crowded spots hugging a
 * pillar, so the balcony uses two rows instead:
 *   - one dummy standing on top of each pillar
 *   - one dummy in the gap between each pair of pillars
 * Every x is at least 3.4 m from its neighbour, which leaves 1.1 m between the
 * two halves of neighbouring splits.
 */
const GAP_SLOTS = PILLARS.slice(0, -1).map((p, i) => (p.x + PILLARS[i + 1].x) / 2)

export const BALCONY_SLOTS: Slot[] = [
  ...PILLARS.map((p, i) => slot(200 + i, 1, p.x, PILLAR_Z, BALCONY_Y + p.h)),
  ...GAP_SLOTS.map((x, i) => slot(300 + i, 1, x, BALCONY_Z, BALCONY_Y)),
]

export const SLOTS: Slot[] = [...GROUND_SLOTS, ...BALCONY_SLOTS]

/** Hard cap on how many dummies can stand on one floor. */
export const MAX_PER_FLOOR = Math.min(GROUND_SLOTS.length, BALCONY_SLOTS.length)


