import { describe, expect, it } from 'vitest'
import { rayCapsule, rayEllipsoid, raySphere } from '../game/hitbox'
import { cmPer360, countsPer360, eDPI, radPerCount } from '../game/sensitivity'
import { BALCONY_SLOTS, GROUND_SLOTS, PLAYER_SPEED, PLAYER_WALK_SPEED, SLOTS, type Slot } from '../game/config'
import { Dummy } from '../engine/dummy'
import { spreadDegrees } from '../game/spread'
import { recoilClimb, recoilKick } from '../game/recoil'

describe('hit testing', () => {
  it('hits a sphere dead centre', () => {
    const t = raySphere({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: -5 }, 0.13)
    expect(t).toBeCloseTo(4.87, 5)
  })

  it('misses a sphere beside the ray', () => {
    const t = raySphere({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: -5 }, 0.13)
    expect(t).toBeNull()
  })

  it('hits a vertical capsule from the front', () => {
    const t = rayCapsule(
      { x: 0, y: 1.2, z: 0 },
      { x: 0, y: 0, z: -1 },
      { x: 0, y: 0.9, z: -4 },
      { x: 0, y: 1.5, z: -4 },
      0.2,
    )
    expect(t).toBeCloseTo(3.8, 5)
  })

  it('misses a capsule beside the ray', () => {
    const t = rayCapsule(
      { x: 0, y: 1.2, z: 0 },
      { x: 0, y: 0, z: -1 },
      { x: 0.6, y: 0.9, z: -4 },
      { x: 0.6, y: 1.5, z: -4 },
      0.2,
    )
    expect(t).toBeNull()
  })
})


describe('ellipsoid head hitbox', () => {
  const head = { x: 0, y: 1.65, z: -5 }
  const rx = 0.13 * 0.9
  const ry = 0.13 * 1.14
  const rz = 0.13

  it('hits from the front at the radius depth', () => {
    const t = rayEllipsoid({ x: 0, y: 1.65, z: 0 }, { x: 0, y: 0, z: -1 }, head, rx, ry, rz)
    expect(t).toBeCloseTo(5 - rz, 5)
  })

  it('is taller than it is wide', () => {
    const top = rayEllipsoid({ x: 0, y: 3, z: -5 }, { x: 0, y: -1, z: 0 }, head, rx, ry, rz)
    const side = rayEllipsoid({ x: 3, y: 1.65, z: -5 }, { x: -1, y: 0, z: 0 }, head, rx, ry, rz)
    expect(top).toBeCloseTo(3 - (1.65 + ry), 5)
    expect(side).toBeCloseTo(3 - rx, 5)
    expect(ry).toBeGreaterThan(rx)
  })

  it('misses just outside the narrow axis', () => {
    const t = rayEllipsoid({ x: rx + 0.01, y: 1.65, z: 0 }, { x: 0, y: 0, z: -1 }, head, rx, ry, rz)
    expect(t).toBeNull()
  })
})

describe('sensitivity', () => {
  it('maps 0.4 sens at 800 dpi to ~40.8cm per 360', () => {
    expect(cmPer360(0.4, 800)).toBeCloseTo(40.81, 1)
  })

  it('matches Valorant counts per 360', () => {
    // 360 / (0.07 * 0.4) = 12857.14 counts
    expect(countsPer360(0.4)).toBeCloseTo(12857.14, 1)
  })

  it('converts to radians per count', () => {
    // 0.07Â° * 0.4 = 0.028Â° = 0.0004887 rad
    expect(radPerCount(0.4)).toBeCloseTo(0.0004887, 6)
  })

  it('reports eDPI', () => {
    expect(eDPI(0.4, 800)).toBe(320)
  })
})

describe('range layout', () => {
  it('has 13 ground and 13 balcony slots', () => {
    expect(GROUND_SLOTS).toHaveLength(13)
    expect(BALCONY_SLOTS).toHaveLength(13)
    expect(SLOTS).toHaveLength(26)
  })

  it('keeps ground slots in the 8â€“19m band', () => {
    for (const slot of GROUND_SLOTS) {
      expect(slot.distance).toBeGreaterThan(8)
      expect(slot.distance).toBeLessThan(19)
    }
  })

  it('puts balcony slots above the ground floor', () => {
    for (const slot of BALCONY_SLOTS) {
      expect(slot.floor).toBe(1)
      expect(slot.baseY).toBeGreaterThanOrEqual(3)
    }
  })

  it('puts some balcony dummies on the pillars and some in the gaps', () => {
    expect(BALCONY_SLOTS.some((s) => s.baseY > 3.5)).toBe(true)
    expect(BALCONY_SLOTS.some((s) => Math.abs(s.baseY - 3) < 0.01)).toBe(true)
  })

  it('leaves room for every target to split in two', () => {
    for (const a of SLOTS) {
      for (const b of SLOTS) {
        if (a === b || a.floor !== b.floor) continue
        if (Math.abs(a.baseY - b.baseY) > 1.5) continue
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(2.1)
      }
    }
  })
})

describe('movement parity', () => {
  it('uses Valorant agent run speed', () => {
    expect(PLAYER_SPEED).toBeCloseTo(6.75, 5)
  })

  it('halves speed while walking', () => {
    expect(PLAYER_WALK_SPEED).toBeCloseTo(3.375, 5)
  })
})

describe('movement spread', () => {
  it('is perfectly accurate while standing still', () => {
    expect(spreadDegrees(0)).toBe(0)
  })

  it('reaches the full cone at run speed', () => {
    expect(spreadDegrees(PLAYER_SPEED)).toBeCloseTo(2.6, 5)
  })

  it('sits around one degree while walking', () => {
    const walk = spreadDegrees(PLAYER_WALK_SPEED)
    expect(walk).toBeGreaterThan(0.9)
    expect(walk).toBeLessThan(1.3)
  })

  it('grows faster than linearly with speed', () => {
    const half = spreadDegrees(PLAYER_SPEED / 2)
    expect(half).toBeLessThan(spreadDegrees(PLAYER_SPEED) / 2)
  })
})

describe('vandal recoil', () => {
  it('climbs hardest on the first shots', () => {
    const first = recoilKick(0, 0.5)
    const late = recoilKick(12, 0.5)
    expect(first.pitch).toBeCloseTo(0.55, 5)
    expect(late.pitch).toBeLessThan(0.1)
  })

  it('accumulates roughly 2.5 degrees over five bullets', () => {
    expect(recoilClimb(5)).toBeCloseTo(2.45, 2)
  })

  it('sways left and right after the climb', () => {
    const yaws = [5, 6, 7, 8, 9].map((i) => recoilKick(i, 0.5).yaw)
    expect(yaws.some((y) => y > 0)).toBe(true)
    expect(yaws.some((y) => y < 0)).toBe(true)
  })

  it('keeps sways inside a sane cone', () => {
    for (let i = 0; i < 20; i += 1) {
      const kick = recoilKick(i, Math.random())
      expect(Math.abs(kick.yaw)).toBeLessThan(0.5)
      expect(kick.pitch).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('hit regions', () => {
  const slot: Slot = { id: 1, floor: 0, x: 0, z: -5, baseY: 0, distance: 0, hiddenX: null }
  const forward = { x: 0, y: 0, z: -1 }

  it('resolves a shot through the head as a head hit', () => {
    const dummy = new Dummy({ id: 1, slot, moving: false, now: 0, jitterX: 0, jitterZ: 0 })
    const hit = dummy.hitTest({ x: 0, y: 1.65, z: 0 }, forward)
    expect(hit?.region).toBe('head')
    dummy.dispose()
  })

  it('still resolves a shot through the chest as a body hit', () => {
    const dummy = new Dummy({ id: 2, slot, moving: false, now: 0, jitterX: 0, jitterZ: 0 })
    const hit = dummy.hitTest({ x: 0, y: 1.2, z: 0 }, forward)
    expect(hit?.region).toBe('body')
    dummy.dispose()
  })

  it('misses above the head', () => {
    const dummy = new Dummy({ id: 3, slot, moving: false, now: 0, jitterX: 0, jitterZ: 0 })
    expect(dummy.hitTest({ x: 0, y: 2.1, z: 0 }, forward)).toBeNull()
    dummy.dispose()
  })
})
