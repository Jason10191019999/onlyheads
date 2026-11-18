import type { Vec3 } from './math'

const EPS = 1e-9

/** Ray / sphere. `dir` must be normalised. Returns nearest non-negative t. */
export function raySphere(o: Vec3, dir: Vec3, c: Vec3, r: number): number | null {
  const ox = o.x - c.x
  const oy = o.y - c.y
  const oz = o.z - c.z
  const b = ox * dir.x + oy * dir.y + oz * dir.z
  const cc = ox * ox + oy * oy + oz * oz - r * r
  const h = b * b - cc
  if (h < 0) return null
  const sq = Math.sqrt(h)
  let t = -b - sq
  if (t < 0) {
    t = -b + sq
    if (t < 0) return null
  }
  return t
}

/** Ray / capsule. `dir` must be normalised. */
export function rayCapsule(o: Vec3, dir: Vec3, a: Vec3, b: Vec3, r: number): number | null {
  const bax = b.x - a.x
  const bay = b.y - a.y
  const baz = b.z - a.z
  const baba = bax * bax + bay * bay + baz * baz
  if (baba < EPS) return raySphere(o, dir, a, r)

  const oax = o.x - a.x
  const oay = o.y - a.y
  const oaz = o.z - a.z

  const bard = bax * dir.x + bay * dir.y + baz * dir.z
  const baoa = bax * oax + bay * oay + baz * oaz
  const rdoa = dir.x * oax + dir.y * oay + dir.z * oaz
  const oaoa = oax * oax + oay * oay + oaz * oaz

  const A = baba - bard * bard
  const B = baba * rdoa - baoa * bard
  const C = baba * oaoa - baoa * baoa - r * r * baba

  let best: number | null = null

  if (Math.abs(A) > EPS) {
    const h = B * B - A * C
    if (h >= 0) {
      const t = (-B - Math.sqrt(h)) / A
      if (t >= 0) {
        const y = baoa + t * bard
        if (y > 0 && y < baba) best = t
      }
    }
  }

  const ta = raySphere(o, dir, a, r)
  if (ta !== null && (best === null || ta < best)) best = ta
  const tb = raySphere(o, dir, b, r)
  if (tb !== null && (best === null || tb < best)) best = tb

  return best
}


/**
 * Ray / axis-aligned ellipsoid. `dir` must be normalised.
 * The ellipsoid is tested by scaling space so the same ray parameter t holds.
 */
export function rayEllipsoid(o: Vec3, dir: Vec3, c: Vec3, rx: number, ry: number, rz: number): number | null {
  const ox = (o.x - c.x) / rx
  const oy = (o.y - c.y) / ry
  const oz = (o.z - c.z) / rz
  const dx = dir.x / rx
  const dy = dir.y / ry
  const dz = dir.z / rz
  const A = dx * dx + dy * dy + dz * dz
  if (A < EPS) return null
  const B = ox * dx + oy * dy + oz * dz
  const C = ox * ox + oy * oy + oz * oz - 1
  const h = B * B - A * C
  if (h < 0) return null
  const sq = Math.sqrt(h)
  let t = (-B - sq) / A
  if (t < 0) {
    t = (-B + sq) / A
    if (t < 0) return null
  }
  return t
}
