import { describe, expect, it } from 'vitest'
import { HEADSHOT_POINTS, RoundScorer } from '../game/scoring'
import type { ShotEvent } from '../game/types'

const shot = (
  outcome: ShotEvent['outcome'],
  first = false,
  ttk = 500,
  isPenalty = false,
): ShotEvent => ({
  outcome,
  isFirstShotOnTarget: first,
  timeSinceVisibleMs: ttk,
  isPenalty,
})

describe('RoundScorer', () => {
  it('pays 100 per headshot, flat', () => {
    const scorer = new RoundScorer(1)
    for (let i = 0; i < 5; i += 1) expect(scorer.onHead(shot('head'))).toBe(HEADSHOT_POINTS)
    expect(scorer.bank).toBe(500)
    expect(scorer.streak).toBe(5)
    expect(scorer.bestStreak).toBe(5)
  })

  it('never takes points away for a body hit, only the streak', () => {
    const scorer = new RoundScorer(2)
    scorer.onHead(shot('head'))
    scorer.onHead(shot('head'))
    scorer.onBody(shot('body'))
    expect(scorer.bank).toBe(200)
    expect(scorer.streak).toBe(0)
    expect(scorer.bodyHits).toBe(1)
    expect(scorer.bestStreak).toBe(2)
  })

  it('pays nothing for clearing a penalty clone', () => {
    const scorer = new RoundScorer(1)
    scorer.onHead(shot('head'))
    scorer.onPenaltyHead(shot('head', false, 500, true))
    expect(scorer.bank).toBe(100)
    expect(scorer.headshots).toBe(1)
    expect(scorer.penaltyKills).toBe(1)
    expect(scorer.streak).toBe(1)
  })

  it('counts clone body damage as a body hit', () => {
    const scorer = new RoundScorer(1)
    scorer.onPenaltyBody(shot('body', false, 500, true))
    expect(scorer.bodyHits).toBe(1)
    expect(scorer.bank).toBe(0)
  })

  it('never penalises misses', () => {
    const scorer = new RoundScorer(1)
    scorer.onHead(shot('head'))
    scorer.onMiss(shot('miss'))
    scorer.onMiss(shot('miss'))
    expect(scorer.bank).toBe(100)
    expect(scorer.streak).toBe(1)
  })

  it('keeps penalty events out of the first-shot rate', () => {
    const scorer = new RoundScorer(1)
    scorer.onHead(shot('head', true))
    scorer.onPenaltyHead(shot('head', true, 500, true))
    const result = scorer.finish({ weapon: 'vandal', durationMs: 60_000 })
    expect(result.firstShotHsRate).toBeCloseTo(1, 5)
    expect(result.accuracy).toBeCloseTo(1, 5)
    expect(result.endReason).toBe('time')
  })

  it('reports kills per minute from real headshots only', () => {
    const scorer = new RoundScorer(1)
    scorer.onHead(shot('head'))
    scorer.onHead(shot('head'))
    scorer.onPenaltyHead(shot('head', false, 500, true))
    const result = scorer.finish({ weapon: 'vandal', durationMs: 60_000 })
    expect(result.killsPerMin).toBeCloseTo(2, 5)
    expect(result.score).toBe(200)
  })
})
