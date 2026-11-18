import { PLAYER_SPEED } from './config'
import { normalize } from './math'
import type { Vec3 } from './math'

/**
 * Movement inaccuracy, modelled on Valorant: standing still is perfectly
 * accurate, running scatters the shot, walking scatters it less.
 */
export const MOVE_SPREAD_MAX_DEG = 2.6
const SPREAD_EXPONENT = 1.3

/** Half-angle in degrees of the cone the bullet can land inside. */
export function spreadDegrees(speed: number): number {
  const ratio = Math.min(1, Math.max(0, speed / PLAYER_SPEED))
  return MOVE_SPREAD_MAX_DEG * Math.pow(ratio, SPREAD_EXPONENT)
}

/** Rotate the aim direction by a random offset inside the spread cone. */
export function applySpread(forward: Vec3, yaw: number, spreadRad: number): Vec3 {
  if (spreadRad <= 0) return forward
  const right = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) }
  const up = {
    x: right.y * forward.z - right.z * forward.y,
    y: right.z * forward.x - right.x * forward.z,
    z: right.x * forward.y - right.y * forward.x,
  }
  const theta = Math.random() * Math.PI * 2
  const radius = Math.sqrt(Math.random()) * Math.tan(spreadRad)
  const cos = Math.cos(theta) * radius
  const sin = Math.sin(theta) * radius
  return normalize({
    x: forward.x + right.x * cos + up.x * sin,
    y: forward.y + right.y * cos + up.y * sin,
    z: forward.z + right.z * cos + up.z * sin,
  })
}
