/**
 * Vandal recoil, modelled on community spray tests (Inven Global weapon guide):
 * the first shots climb, then the pattern sways left and right with no fixed
 * rhythm. Values are degrees of view kick per shot.
 */
export interface RecoilKick {
  pitch: number
  yaw: number
}

const PATTERN: ReadonlyArray<readonly [number, number]> = [
  [0.55, 0.0],
  [0.55, 0.05],
  [0.5, -0.05],
  [0.45, 0.1],
  [0.4, -0.12],
  [0.3, 0.18],
  [0.22, -0.2],
  [0.15, 0.25],
  [0.08, -0.28],
  [0.05, 0.32],
  [0.04, -0.32],
  [0.03, 0.3],
  [0.02, -0.28],
  [0.02, 0.26],
  [0.01, -0.24],
]

/** `rand` is a 0..1 sample used to give the sway a slightly random feel. */
export function recoilKick(shotIndex: number, rand: number): RecoilKick {
  const index = Math.min(shotIndex, PATTERN.length - 1)
  const [pitch, yaw] = PATTERN[index]
  const jitter = shotIndex >= 6 ? 0.07 : 0.02
  return { pitch, yaw: yaw + (rand * 2 - 1) * jitter }
}

/** Total vertical climb after `shots` bullets, in degrees. */
export function recoilClimb(shots: number): number {
  let total = 0
  for (let i = 0; i < shots; i += 1) {
    total += PATTERN[Math.min(i, PATTERN.length - 1)][0]
  }
  return total
}
