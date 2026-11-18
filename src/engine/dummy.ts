import * as THREE from 'three'
import {
  BROKEN_MS,
  CLONE_BODY_HITS,
  HEAD_CENTER_Y,
  HEAD_RADIUS,
  RAIL_TOP,
  RELOCATE_MAX_MS,
  RELOCATE_MIN_MS,
  WALK_OUT_MS,
  type Slot,
} from '../game/config'

import { easeOutCubic, lerp } from '../game/math'
import type { Vec3 } from '../game/math'
import { rayCapsule, rayEllipsoid } from '../game/hitbox'

/* ------------------------------------------------------------------ mats */

interface Assets {
  headGeo: THREE.BufferGeometry
  white: THREE.MeshStandardMaterial
  accent: THREE.MeshStandardMaterial
  dark: THREE.MeshStandardMaterial
  mid: THREE.MeshStandardMaterial
  visor: THREE.MeshStandardMaterial
  broken: THREE.MeshStandardMaterial
}

let assets: Assets | null = null

function getAssets(): Assets {
  if (assets) return assets
  assets = {
    headGeo: new THREE.SphereGeometry(HEAD_RADIUS, 16, 12),
    white: new THREE.MeshStandardMaterial({
      color: 0xe7e5da,
      roughness: 0.45,
      metalness: 0.08,
      side: THREE.DoubleSide,
    }),
    accent: new THREE.MeshStandardMaterial({
      color: 0xd7e04b,
      emissive: 0x2c3300,
      emissiveIntensity: 0.35,
      roughness: 0.5,
      metalness: 0.2,
    }),
    dark: new THREE.MeshStandardMaterial({ color: 0x35454f, roughness: 0.68, metalness: 0.25 }),
    mid: new THREE.MeshStandardMaterial({ color: 0x7d8f99, roughness: 0.55, metalness: 0.3 }),
    visor: new THREE.MeshStandardMaterial({
      color: 0x0d171d,
      emissive: 0x19d6c8,
      emissiveIntensity: 0.75,
      roughness: 0.3,
    }),
    broken: new THREE.MeshStandardMaterial({ color: 0x37424c, roughness: 0.9, metalness: 0.05 }),
  }
  return assets
}

/** Whole-head scale, applied to the revolved profile and its face plate. */
const HEAD_SCALE = 0.9

export function disposeDummyAssets(): void {
  if (!assets) return
  assets.headGeo.dispose()
  for (const key of ['white', 'accent', 'dark', 'mid', 'visor', 'broken'] as const) {
    assets[key].dispose()
  }
  assets = null
}

/* ------------------------------------------------------------- geometry */

/** Minimal non-indexed merge so a whole dummy costs 6 draw calls. */
function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g))
  let total = 0
  for (const g of parts) total += (g.getAttribute('position') as THREE.BufferAttribute).count
  const pos = new Float32Array(total * 3)
  const nor = new Float32Array(total * 3)
  let offset = 0
  for (const g of parts) {
    const p = g.getAttribute('position') as THREE.BufferAttribute
    const n = g.getAttribute('normal') as THREE.BufferAttribute
    pos.set(p.array as Float32Array, offset * 3)
    nor.set(n.array as Float32Array, offset * 3)
    offset += p.count
  }
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  for (const g of parts) g.dispose()
  return merged
}

function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d)
  if (rx) g.rotateX(rx)
  if (ry) g.rotateY(ry)
  if (rz) g.rotateZ(rz)
  g.translate(x, y, z)
  return g
}

function cap(r: number, len: number, x: number, y: number, z: number, rx = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(r, len, 3, 8)
  if (rx) g.rotateX(rx)
  if (rz) g.rotateZ(rz)
  g.translate(x, y, z)
  return g
}

function cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, rx = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rt, rb, h, 10)
  if (rx) g.rotateX(rx)
  g.translate(x, y, z)
  return g
}

/* ---------------------------------------------------------------- dummy */
export interface DummyOptions {
  id: number
  slot: Slot
  moving: boolean
  now: number
  jitterX: number
  jitterZ: number
  /** spawned by a body hit: clearing it earns nothing */
  isClone?: boolean
}

export interface Hit {
  region: 'head' | 'body'
  t: number
}

export class Dummy {
  readonly id: number
  readonly slot: Slot
  readonly isClone: boolean
  /** when a normal target jumps to a new spot, 0 for clones */
  relocateAt = 0
  private bodyDamage = 0
  private flashAt = -1e9
  readonly root = new THREE.Group()
  state: 'entering' | 'alive' | 'broken' | 'gone' = 'entering'
  visibleAt = Number.POSITIVE_INFINITY
  shotsOnTarget = 0

  private readonly upper = new THREE.Group()
  private readonly lower = new THREE.Group()
  private readonly startX: number
  private readonly targetX: number
  private readonly targetZ: number
  private readonly startAt: number
  private readonly moving: boolean
  private readonly phase = Math.random() * Math.PI * 2
  private splitAt = 0
  private readonly bornAt: number
  private upperMeshes: THREE.Mesh[] = []
  private lowerMeshes: THREE.Mesh[] = []
  private cloneMaterials: THREE.MeshStandardMaterial[] = []

  constructor(opts: DummyOptions) {
    const { slot, now } = opts
    const a = getAssets()
    this.id = opts.id
    this.isClone = opts.isClone === true
    this.slot = slot
    this.moving = opts.moving
    this.targetX = slot.x + opts.jitterX
    this.targetZ = slot.z + opts.jitterZ
    this.startX = slot.hiddenX ?? this.targetX
    this.startAt = now
    this.bornAt = now

    this.root.position.set(this.startX, slot.baseY, slot.z + opts.jitterZ)
    // The dummy is modelled facing -Z; turn it around so it faces the player.
    this.root.rotation.y = Math.PI
    if (slot.hiddenX === null) {
      this.state = 'alive'
      this.visibleAt = now
    }

    this.upper.position.y = 0.92
    this.root.add(this.upper, this.lower)
    this.build(a)

    if (this.isClone) {
      this.tintAsPenalty()
    } else {
      this.relocateAt = now + RELOCATE_MIN_MS + Math.random() * (RELOCATE_MAX_MS - RELOCATE_MIN_MS)
    }
  }

  /** Duplicates are painted red so it is obvious they must be cleared. */
  private tintAsPenalty(): void {
    const cache = new Map<THREE.Material, THREE.MeshStandardMaterial>()
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const source = mesh.material as THREE.MeshStandardMaterial
      let tinted = cache.get(source)
      if (!tinted) {
        tinted = source.clone()
        tinted.color.lerp(new THREE.Color(0xff2f2a), 0.55)
        tinted.emissive = new THREE.Color(0x8a0f0c)
        tinted.emissiveIntensity = 0.7
        cache.set(source, tinted)
        this.cloneMaterials.push(tinted)
      }
      mesh.material = tinted
    })
  }

  private build(a: Assets): void {
    /* -------- upper body (above the waist): head, chest, arms -------- */
    const white: THREE.BufferGeometry[] = []
    const accentUpper: THREE.BufferGeometry[] = []
    const darkUpper: THREE.BufferGeometry[] = []
    const visor: THREE.BufferGeometry[] = []

    // Head: a vertical oval with a squared-off top, revolved from a profile.
    const profile = [
      new THREE.Vector2(0.0, -0.152),
      new THREE.Vector2(0.062, -0.142),
      new THREE.Vector2(0.098, -0.09),
      new THREE.Vector2(0.111, 0.0),
      new THREE.Vector2(0.111, 0.1),
      new THREE.Vector2(0.1, 0.138),
      new THREE.Vector2(0.088, 0.152),
      new THREE.Vector2(0.0, 0.152),
    ]
    const shell = new THREE.LatheGeometry(profile, 18)
    shell.scale(HEAD_SCALE, HEAD_SCALE, HEAD_SCALE)
    shell.translate(0, HEAD_CENTER_Y, 0)
    white.push(shell)

    // face: a dark visor band with two glowing eyes
    darkUpper.push(box(0.126, 0.068, 0.028, 0, HEAD_CENTER_Y - 0.004, -0.09))
    visor.push(box(0.025, 0.012, 0.009, -0.033, HEAD_CENTER_Y + 0.014, -0.106))
    visor.push(box(0.025, 0.012, 0.009, 0.033, HEAD_CENTER_Y + 0.014, -0.106))

    // neck ring
    accentUpper.push(cyl(0.055, 0.06, 0.07, 0, 1.53, 0))

    // chest
    darkUpper.push(box(0.36, 0.3, 0.24, 0, 1.34, 0))
    darkUpper.push(box(0.26, 0.16, 0.2, 0, 1.1, 0))
    accentUpper.push(box(0.3, 0.045, 0.22, 0, 1.475, 0))
    accentUpper.push(box(0.032, 0.26, 0.08, -0.185, 1.32, 0))
    accentUpper.push(box(0.032, 0.26, 0.08, 0.185, 1.32, 0))
    accentUpper.push(box(0.3, 0.04, 0.2, 0, 1.02, 0))
    // sternum plate
    const plate = box(0.16, 0.12, 0.02, 0, 1.36, -0.125)
    const midUpper: THREE.BufferGeometry[] = [plate]

    // shoulders / arms
    for (const side of [-1, 1]) {
      // angular shoulder plates instead of spheres
      accentUpper.push(box(0.16, 0.095, 0.21, side * 0.245, 1.445, 0, 0, 0, side * -0.14))
      darkUpper.push(box(0.13, 0.075, 0.17, side * 0.25, 1.365, 0))
      darkUpper.push(cap(0.055, 0.18, side * 0.28, 1.3, 0, 0, side * 0.12))
      accentUpper.push(box(0.095, 0.07, 0.1, side * 0.305, 1.13, 0))
      darkUpper.push(cap(0.048, 0.18, side * 0.315, 0.99, 0, 0, side * 0.06))
      darkUpper.push(box(0.075, 0.1, 0.09, side * 0.325, 0.86, 0))
    }

    /* -------- lower body: hips, legs, boots -------- */
    const accentLower: THREE.BufferGeometry[] = []
    const darkLower: THREE.BufferGeometry[] = []

    darkLower.push(box(0.3, 0.18, 0.21, 0, 0.9, 0))
    accentLower.push(box(0.31, 0.035, 0.22, 0, 0.955, 0))
    accentLower.push(box(0.05, 0.12, 0.19, -0.15, 0.85, 0))
    accentLower.push(box(0.05, 0.12, 0.19, 0.15, 0.85, 0))

    for (const side of [-1, 1]) {
      darkLower.push(cap(0.075, 0.24, side * 0.11, 0.68, 0, 0, side * -0.04))
      darkLower.push(box(0.105, 0.13, 0.13, side * 0.115, 0.5, 0))
      accentLower.push(box(0.09, 0.1, 0.115, side * 0.118, 0.5, -0.03))
      darkLower.push(cap(0.058, 0.3, side * 0.12, 0.3, 0, 0, side * 0.03))
      darkLower.push(box(0.115, 0.09, 0.21, side * 0.125, 0.055, -0.02))
      accentLower.push(box(0.1, 0.02, 0.16, side * 0.12, 0.1, -0.01))
    }

    const upper = [
      new THREE.Mesh(merge(upperTranslate(white, 0)), a.white),
      new THREE.Mesh(merge(upperTranslate(accentUpper, 0)), a.accent),
      new THREE.Mesh(merge(upperTranslate(darkUpper, 0)), a.dark),
      new THREE.Mesh(merge(upperTranslate(midUpper, 0)), a.mid),
      new THREE.Mesh(merge(upperTranslate(visor, 0)), a.visor),
    ]
    const lower = [
      new THREE.Mesh(merge(darkLower), a.dark),
      new THREE.Mesh(merge(accentLower), a.accent),
    ]

    for (const m of upper) {
      this.upper.add(m)
      this.upperMeshes.push(m)
    }
    for (const m of lower) {
      this.lower.add(m)
      this.lowerMeshes.push(m)
    }
  }

  /** Returns the body hits still needed before the clone falls. */
  takeBodyHit(now: number): number {
    this.bodyDamage += 1
    this.flashAt = now
    return Math.max(0, CLONE_BODY_HITS - this.bodyDamage)
  }

  headCenter(): Vec3 {
    return {
      x: this.root.position.x,
      y: this.root.position.y + HEAD_CENTER_Y,
      z: this.root.position.z,
    }
  }

  isHittable(): boolean {
    return this.state === 'alive'
  }

  hitTest(origin: Vec3, dir: Vec3): Hit | null {
    if (!this.isHittable()) return null
    const { x, z } = this.root.position
    const floorY = this.root.position.y
    const head = rayEllipsoid(origin, dir, { x, y: floorY + HEAD_CENTER_Y, z }, 0.1, 0.135, 0.108)
    // The head always wins: the torso capsule bulges over the neck, and without
    // this a shot through the skull resolves as a body hit.
    if (head !== null) return { region: 'head', t: head }

    let best: Hit | null = null
    const clip = this.slot.floor === 1 ? Math.max(RAIL_TOP, this.slot.baseY) : -Infinity
    const parts: Array<[number, number, number, number]> = [
      [x, 0.9, 1.45, 0.18],
      [x - 0.27, 0.97, 1.39, 0.058],
      [x + 0.27, 0.97, 1.39, 0.058],
    ]
    parts.push([x - 0.1, 0.08, 0.88, 0.085], [x + 0.1, 0.08, 0.88, 0.085])

    for (const [px, y0, y1, r] of parts) {
      const lo = Math.max(floorY + y0, clip)
      const hi = floorY + y1
      if (hi <= lo) continue
      const t = rayCapsule(origin, dir, { x: px, y: lo, z }, { x: px, y: hi, z }, r)
      if (t !== null && (best === null || t < best.t)) best = { region: 'body', t }
    }
    return best
  }

  split(now: number): void {
    if (this.state === 'broken') return
    this.state = 'broken'
    this.splitAt = now
    const a = getAssets()
    for (const mesh of this.upperMeshes) mesh.material = a.broken
    for (const mesh of this.lowerMeshes) mesh.material = a.broken
  }

  isGone(now: number): boolean {
    return this.state === 'broken' && now - this.splitAt > BROKEN_MS + 220
  }

  update(now: number, frozen: boolean): void {
    if (this.state === 'broken') {
      const t = Math.min((now - this.splitAt) / 1000, 1.2)
      this.upper.rotation.x = -Math.min(t * 2.4, 1.25)
      this.upper.position.y = 0.92 - Math.min(t * t * 0.5, 0.3)
      this.lower.rotation.x = Math.min(t * 1.6, 0.6)
      if (now - this.splitAt > BROKEN_MS) {
        const s = Math.max(0.001, 1 - (now - this.splitAt - BROKEN_MS) / 220)
        this.root.scale.setScalar(s)
      }
      return
    }

    if (this.state === 'entering') {
      const p = Math.min((now - this.startAt) / WALK_OUT_MS, 1)
      this.root.position.x = lerp(this.startX, this.targetX, easeOutCubic(p))
      if (p >= 1) {
        this.state = 'alive'
        this.visibleAt = now
      }
      return
    }

    const grow = Math.min((now - this.bornAt) / 140, 1)
    if (grow < 1) this.root.scale.setScalar(0.72 + 0.28 * grow)

    if (this.isClone && this.cloneMaterials.length > 0) {
      const flashing = now - this.flashAt < 120
      const intensity = flashing ? 2.6 : 0.45 + 0.25 * (0.5 + 0.5 * Math.sin(now / 260))
      for (const material of this.cloneMaterials) material.emissiveIntensity = intensity
    }

    if (frozen || !this.moving) return
    const t = now / 1000
    // wander in both axes so targets cannot be pre-aimed on one line
    this.root.position.x = this.targetX + Math.sin(t * 1.35 + this.phase) * 1.0
    this.root.position.z = this.targetZ + Math.sin(t * 0.92 + this.phase * 1.6) * 0.45
  }

  dispose(): void {
    this.root.parent?.remove(this.root)
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
    })
    for (const material of this.cloneMaterials) material.dispose()
    this.cloneMaterials = []
    this.root.clear()
    this.upperMeshes = []
    this.lowerMeshes = []
  }
}

/** Upper-body geometry is authored in world-height space; shift it under the hip pivot. */
function upperTranslate(list: THREE.BufferGeometry[], dy: number): THREE.BufferGeometry[] {
  for (const g of list) g.translate(0, -0.92 + dy, 0)
  return list
}

