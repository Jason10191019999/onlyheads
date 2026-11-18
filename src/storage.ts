import type { Lang, LeaderboardEntry, RoundResult, Settings, Tier, WeaponId } from './game/types'
import { MAX_PER_FLOOR, TIERS } from './game/config'
import { sanitizeDpi, sanitizeSens } from './game/sensitivity'

const KEY = 'onlyheads.profile.v1'
const MAX_ROUNDS = 50
const MAX_BOARD = 20

export interface Profile {
  version: 1
  settings: Settings
  rounds: RoundResult[]
  board: LeaderboardEntry[]
}

export const DEFAULT_SETTINGS: Settings = {
  sens: 0.45,
  dpi: 800,
  tier: 1,
  groundCount: 5,
  balconyCount: 5,
  moving: true,
  playerName: 'Player',
  weapon: 'vandal',
  volume: 0.6,
  sound: true,
  lang: 'en',
  crosshairColor: '#ffb020',
}

export function sanitizeName(value: unknown): string {
  const text = typeof value === 'string' ? value.trim().slice(0, 12) : ''
  return text.length > 0 ? text : 'Player'
}

function clampCount(value: unknown, tier: Tier, floor: 0 | 1): number {
  const fallback = floor === 0 ? TIERS[tier].ground : TIERS[tier].balcony
  if (!Number.isFinite(value)) return fallback
  return Math.min(MAX_PER_FLOOR, Math.max(0, Math.round(value as number)))
}

function normalize(raw: Partial<Settings> | undefined): Settings {
  const s = raw ?? {}
  const tier: Tier = s.tier === 0 || s.tier === 2 ? s.tier : 1
  const weapon: WeaponId = s.weapon === 'sheriff' ? 'sheriff' : 'vandal'
  const lang: Lang = s.lang === 'zh' ? 'zh' : 'en'
  return {
    sens: sanitizeSens(s.sens ?? DEFAULT_SETTINGS.sens),
    dpi: sanitizeDpi(s.dpi ?? DEFAULT_SETTINGS.dpi),
    tier,
    groundCount: clampCount(s.groundCount, tier, 0),
    balconyCount: clampCount(s.balconyCount, tier, 1),
    moving: s.moving !== false,
    playerName: sanitizeName(s.playerName),
    weapon,
    volume: Number.isFinite(s.volume) ? Math.min(1, Math.max(0, s.volume as number)) : 0.6,
    sound: s.sound !== false,
    lang,
    crosshairColor: /^#[0-9a-f]{6}$/i.test(s.crosshairColor ?? '')
      ? (s.crosshairColor as string)
      : DEFAULT_SETTINGS.crosshairColor,
  }
}

function emptyProfile(): Profile {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, rounds: [], board: [] }
}

function read(): Profile {
  if (typeof localStorage === 'undefined') return emptyProfile()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyProfile()
    const parsed = JSON.parse(raw) as Partial<Profile>
    return {
      version: 1,
      settings: normalize(parsed.settings),
      rounds: Array.isArray(parsed.rounds) ? parsed.rounds.slice(0, MAX_ROUNDS) : [],
      board: Array.isArray(parsed.board) ? parsed.board.slice(0, MAX_BOARD) : [],
    }
  } catch {
    return emptyProfile()
  }
}

function write(profile: Profile): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(profile))
  } catch {
    // ignore quota / private mode
  }
}

export function loadProfile(): Profile {
  return read()
}

export function saveSettings(settings: Settings): void {
  const profile = read()
  profile.settings = normalize(settings)
  write(profile)
}

export interface ScoreEntry {
  board: LeaderboardEntry[]
  rank: number
}

/** Adds a result to the local leaderboard and reports the player's rank (0 if it did not make the cut). */
export function recordScore(result: RoundResult, name: string): ScoreEntry {
  const profile = read()
  const entry: LeaderboardEntry = {
    name: sanitizeName(name),
    score: result.score,
    tier: result.tier,
    weapon: result.weapon,
    headshots: result.headshots,
    accuracy: result.accuracy,
    at: result.at,
  }
  const board = [...profile.board, entry]
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, MAX_BOARD)
  profile.board = board
  write(profile)
  return { board, rank: board.indexOf(entry) + 1 }
}

export function recordRound(result: RoundResult): RoundResult[] {
  const profile = read()
  profile.rounds = [result, ...profile.rounds].slice(0, MAX_ROUNDS)
  write(profile)
  return profile.rounds
}

export function clearRounds(): RoundResult[] {
  const profile = read()
  profile.rounds = []
  write(profile)
  return profile.rounds
}

