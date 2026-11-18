import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
})

import type { RoundResult } from '../game/types'
import { loadProfile, recordScore, sanitizeName } from '../storage'

const result = (score: number, at = Date.now()): RoundResult => ({
  at,
  weapon: 'vandal',
  tier: 1,
  score,
  bestStreak: 1,
  bodyHits: 0,
  headshots: score / 100,
  penaltyKills: 0,
  shots: 1,
  accuracy: 1,
  firstShotHsRate: 1,
  avgTtkMs: 100,
  killsPerMin: 1,
  durationMs: 60_000,
  endReason: 'time',
})

beforeEach(() => store.clear())

describe('local leaderboard', () => {
  it('keeps entries sorted by score', () => {
    recordScore(result(100, 1), 'A')
    recordScore(result(300, 2), 'B')
    recordScore(result(200, 3), 'C')
    const profile = loadProfile()
    expect(profile.board.map((e) => e.name)).toEqual(['B', 'C', 'A'])
  })

  it('reports the rank of the new entry', () => {
    expect(recordScore(result(100, 1), 'A').rank).toBe(1)
    expect(recordScore(result(300, 2), 'B').rank).toBe(1)
    expect(recordScore(result(50, 3), 'C').rank).toBe(3)
  })

  it('keeps only the top 20', () => {
    for (let i = 0; i < 30; i += 1) recordScore(result(i * 10, i), `P${i}`)
    expect(loadProfile().board).toHaveLength(20)
    expect(loadProfile().board[0].score).toBe(290)
  })

  it('falls back to a default name', () => {
    expect(sanitizeName('')).toBe('Player')
    expect(sanitizeName('   ')).toBe('Player')
    expect(sanitizeName('  abcdefghijklmnop  ')).toHaveLength(12)
  })
})
