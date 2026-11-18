export interface Vec3 {
  x: number
  y: number
  z: number
}

export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z })

export function dirFromYawPitch(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch)
  return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp }
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z)
}

export function normalize(v: Vec3): Vec3 {
  const l = length(v) || 1
  return { x: v.x / l, y: v.y / l, z: v.z / l }
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function angleBetween(a: Vec3, b: Vec3): number {
  const c = Math.min(1, Math.max(-1, dot(normalize(a), normalize(b))))
  return (Math.acos(c) * 180) / Math.PI
}

export function angleToPoint(eye: Vec3, look: Vec3, point: Vec3): number {
  return angleBetween(look, sub(point, eye))
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function easeOutCubic(t: number): number {
  const p = 1 - t
  return 1 - p * p * p
}
