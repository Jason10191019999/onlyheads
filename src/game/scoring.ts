import type { RoundResult, ShotEvent, Tier, WeaponId } from './types'

/** Flat reward: one headshot, one hundred. No multiplier ladder to learn. */
export const HEADSHOT_POINTS = 100

/**
 * Simplified round scoring.
 *
 *  - a headshot is worth 100 and always kills;
 *  - body hits never cost points, they only split the target (and reset the streak);
 *  - penalty clones are worth nothing, they exist to be cleared;
 *  - the round always runs the full 60 seconds.
 */
export class RoundScorer {
  readonly tier: Tier
  bank = 0
  /** consecutive headshots, display only */
  streak = 0
  bestStreak = 0
  headshots = 0
  bodyHits = 0
  penaltyKills = 0
  shots = 0
  engagements = 0
  firstShotHeads = 0

  private ttkSum = 0
  private ttkCount = 0

  constructor(tier: Tier) {
    this.tier = tier
  }

  private noteEngagement(event: ShotEvent): void {
    if (event.isPenalty) return
    if (!event.isFirstShotOnTarget) return
    this.engagements += 1
    if (event.outcome === 'head') this.firstShotHeads += 1
  }

  onHead(event: ShotEvent): number {
    this.noteEngagement(event)
    this.shots += 1
    this.headshots += 1
    this.streak += 1
    this.bestStreak = Math.max(this.bestStreak, this.streak)
    this.bank += HEADSHOT_POINTS
    this.ttkSum += event.timeSinceVisibleMs
    this.ttkCount += 1
    return HEADSHOT_POINTS
  }

  /** A duplicate spawned by a body hit: it still counts as a head, but pays nothing. */
  onPenaltyHead(event: ShotEvent): void {
    this.noteEngagement(event)
    this.shots += 1
    this.penaltyKills += 1
    this.ttkSum += event.timeSinceVisibleMs
    this.ttkCount += 1
  }

  /** A body hit on a normal target: it splits, and the streak resets. */
  onBody(event: ShotEvent): void {
    this.noteEngagement(event)
    this.shots += 1
    this.bodyHits += 1
    this.streak = 0
  }

  /** A body hit on a penalty clone: chip damage, no score either way. */
  onPenaltyBody(event: ShotEvent): void {
    this.noteEngagement(event)
    this.shots += 1
    this.bodyHits += 1
    this.streak = 0
  }

  onMiss(event: ShotEvent): void {
    this.noteEngagement(event)
    this.shots += 1
  }

  finish(meta: { weapon: WeaponId; durationMs: number }): RoundResult {
    const duration = Math.max(1, meta.durationMs)
    return {
      at: Date.now(),
      weapon: meta.weapon,
      tier: this.tier,
      score: Math.max(0, Math.round(this.bank)),
      bestStreak: this.bestStreak,
      bodyHits: this.bodyHits,
      headshots: this.headshots,
      penaltyKills: this.penaltyKills,
      shots: this.shots,
      accuracy:
        this.shots > 0 ? (this.headshots + this.bodyHits + this.penaltyKills) / this.shots : 0,
      firstShotHsRate: this.engagements > 0 ? this.firstShotHeads / this.engagements : 0,
      avgTtkMs: this.ttkCount > 0 ? this.ttkSum / this.ttkCount : 0,
      killsPerMin: (this.headshots / duration) * 60_000,
      durationMs: duration,
      endReason: 'time',
    }
  }
}
