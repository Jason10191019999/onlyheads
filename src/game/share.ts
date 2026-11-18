import { MAX_PER_FLOOR } from './config'
import type { Settings, Tier, WeaponId } from './types'

/**
 * Settings are encoded into the URL hash so a link reproduces the exact setup:
 * tier, per-floor counts, movement, weapon, sensitivity and daily mode.
 */
export function encodeChallenge(settings: Settings): string {
  const params = new URLSearchParams()
  params.set('t', String(settings.tier))
  params.set('g', String(settings.groundCount))
  params.set('b', String(settings.balconyCount))
  params.set('m', settings.moving ? '1' : '0')
  params.set('w', settings.weapon === 'sheriff' ? 's' : 'v')
  params.set('s', String(settings.sens))
  if (settings.daily) params.set('d', '1')
  return `#${params.toString()}`
}

export function challengeUrl(settings: Settings, origin: string, pathname: string): string {
  return `${origin}${pathname}${encodeChallenge(settings)}`
}

export function parseChallenge(hash: string): Partial<Settings> | null {
  const raw = hash.replace(/^#/, '')
  if (!raw || !raw.includes('=')) return null
  const params = new URLSearchParams(raw)
  if (!params.has('t') && !params.has('g') && !params.has('b')) return null

  const out: Partial<Settings> = {}
  const int = (key: string, min: number, max: number): number | undefined => {
    const value = params.get(key)
    if (value === null) return undefined
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return undefined
    return Math.min(max, Math.max(min, Math.round(parsed)))
  }

  const tier = int('t', 0, 2)
  if (tier !== undefined) out.tier = tier as Tier
  const ground = int('g', 0, MAX_PER_FLOOR)
  if (ground !== undefined) out.groundCount = ground
  const balcony = int('b', 0, MAX_PER_FLOOR)
  if (balcony !== undefined) out.balconyCount = balcony

  const moving = params.get('m')
  if (moving === '0' || moving === '1') out.moving = moving === '1'

  const weapon = params.get('w')
  if (weapon === 'v' || weapon === 's') out.weapon = (weapon === 's' ? 'sheriff' : 'vandal') as WeaponId

  const sens = Number(params.get('s'))
  if (Number.isFinite(sens)) out.sens = Math.min(10, Math.max(0.1, sens))

  if (params.get('d') === '1') out.daily = true
  return out
}
