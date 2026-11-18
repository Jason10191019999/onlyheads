import { describe, expect, it } from 'vitest'
import { RoundScorer } from '../game/scoring'

describe('aim error stats', () => {
  it('averages the absolute vertical error', () => {
    const scorer = new RoundScorer(1)
    scorer.recordAim(0.4)
    scorer.recordAim(-0.2)
    const result = scorer.finish({ weapon: 'vandal', durationMs: 60_000 })
    expect(result.avgAimErrorDeg).toBeCloseTo(0.3, 5)
  })

  it('counts shots that passed below the head', () => {
    const scorer = new RoundScorer(1)
    scorer.recordAim(0.4)
    scorer.recordAim(0.1)
    scorer.recordAim(-0.3)
    scorer.recordAim(-0.05)
    const result = scorer.finish({ weapon: 'vandal', durationMs: 60_000 })
    expect(result.lowAimShare).toBeCloseTo(0.5, 5)
  })

  it('reports zero when nothing was measured', () => {
    const result = new RoundScorer(1).finish({ weapon: 'vandal', durationMs: 60_000 })
    expect(result.avgAimErrorDeg).toBe(0)
    expect(result.lowAimShare).toBe(0)
  })
})
