import { describe, expect, it } from 'vitest'
import { challengeUrl, encodeChallenge, parseChallenge } from '../game/share'
import { DEFAULT_SETTINGS } from '../storage'
import type { Settings } from '../game/types'

const base: Settings = { ...DEFAULT_SETTINGS }

describe('challenge links', () => {
  it('round-trips every field it encodes', () => {
    const settings: Settings = {
      ...base,
      tier: 2,
      groundCount: 1,
      balconyCount: 9,
      moving: false,
      weapon: 'sheriff',
      sens: 0.55,
      daily: true,
    }
    const parsed = parseChallenge(encodeChallenge(settings))
    expect(parsed).toMatchObject({
      tier: 2,
      groundCount: 1,
      balconyCount: 9,
      moving: false,
      weapon: 'sheriff',
      sens: 0.55,
      daily: true,
    })
  })

  it('ignores a hash that carries no settings', () => {
    expect(parseChallenge('')).toBeNull()
    expect(parseChallenge('#section-2')).toBeNull()
    expect(parseChallenge('#foo=bar')).toBeNull()
  })

  it('clamps hostile values', () => {
    const parsed = parseChallenge('#t=9&g=999&b=-5&s=99&m=maybe&w=x')
    expect(parsed?.tier).toBe(2)
    expect(parsed?.groundCount).toBe(13)
    expect(parsed?.balconyCount).toBe(0)
    expect(parsed?.sens).toBe(10)
    expect(parsed?.moving).toBeUndefined()
    expect(parsed?.weapon).toBeUndefined()
  })

  it('builds an absolute url', () => {
    const url = challengeUrl(base, 'https://example.com', '/onlyheads/')
    expect(url.startsWith('https://example.com/onlyheads/#')).toBe(true)
  })
})
