import type { LeaderboardEntry } from '../game/types'

/**
 * Optional shared leaderboard.
 *
 * The app is a static site, so a global board needs a tiny backend. Set
 * VITE_BOARD_URL at build time (see server/README.md) to switch it on; without
 * it everything stays local and this module does nothing.
 */
const BASE = (import.meta.env.VITE_BOARD_URL as string | undefined)?.replace(/\/+$/, '')

export const globalBoardEnabled = Boolean(BASE)

export interface GlobalEntry {
  name: string
  score: number
  tier: number
  headshots: number
  at: number
}

export async function fetchGlobalBoard(): Promise<GlobalEntry[] | null> {
  if (!BASE) return null
  try {
    const response = await fetch(`${BASE}/scores`, { headers: { accept: 'application/json' } })
    if (!response.ok) return null
    const data = (await response.json()) as unknown
    if (!Array.isArray(data)) return null
    return data
      .filter((row): row is GlobalEntry => Boolean(row) && typeof (row as GlobalEntry).score === 'number')
      .slice(0, 20)
  } catch {
    return null
  }
}

export async function submitGlobal(entry: LeaderboardEntry): Promise<boolean> {
  if (!BASE) return false
  try {
    const response = await fetch(`${BASE}/scores`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: entry.name,
        score: entry.score,
        tier: entry.tier,
        headshots: entry.headshots,
        at: entry.at,
      }),
    })
    return response.ok
  } catch {
    return false
  }
}
