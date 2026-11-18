import * as THREE from 'three'

const MAX_PARTICLES = 320

interface Particle {
  active: boolean
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  maxLife: number
  r: number
  g: number
  b: number
}

/** One Points object, fixed pool, no per-burst allocation. */
export class Particles {
  private readonly points: THREE.Points
  private readonly positions: Float32Array
  private readonly colors: Float32Array
  private readonly particles: Particle[]
  private cursor = 0

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(MAX_PARTICLES * 3)
    this.colors = new Float32Array(MAX_PARTICLES * 3)
    this.particles = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: -999,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1,
      r: 0,
      g: 0,
      b: 0,
    }))
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    for (let i = 0; i < MAX_PARTICLES; i += 1) this.positions[i * 3 + 1] = -999
    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.points = new THREE.Points(geometry, material)
    this.points.frustumCulled = false
    scene.add(this.points)
  }

  burst(origin: { x: number; y: number; z: number }, color: number, count = 12, speed = 2.6): void {
    const c = new THREE.Color(color)
    for (let i = 0; i < count; i += 1) {
      const p = this.particles[this.cursor]
      this.cursor = (this.cursor + 1) % MAX_PARTICLES
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      const s = speed * (0.3 + Math.random() * 0.9)
      p.active = true
      p.x = origin.x
      p.y = origin.y
      p.z = origin.z
      p.vx = Math.cos(theta) * Math.sin(phi) * s
      p.vy = Math.cos(phi) * s * 0.8 + 1.1
      p.vz = Math.sin(theta) * Math.sin(phi) * s
      p.maxLife = 0.35 + Math.random() * 0.4
      p.life = p.maxLife
      p.r = c.r
      p.g = c.g
      p.b = c.b
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      const p = this.particles[i]
      const idx = i * 3
      if (!p.active) continue
      p.life -= dt
      if (p.life <= 0) {
        p.active = false
        this.positions[idx + 1] = -999
        this.colors[idx] = 0
        this.colors[idx + 1] = 0
        this.colors[idx + 2] = 0
        continue
      }
      p.vy -= 11 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      if (p.y < 0.02) {
        p.y = 0.02
        p.vy *= -0.28
        p.vx *= 0.7
        p.vz *= 0.7
      }
      const fade = Math.max(0, p.life / p.maxLife)
      this.positions[idx] = p.x
      this.positions[idx + 1] = p.y
      this.positions[idx + 2] = p.z
      this.colors[idx] = p.r * fade
      this.colors[idx + 1] = p.g * fade
      this.colors[idx + 2] = p.b * fade
    }
    const geo = this.points.geometry
    ;(geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    ;(geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
  }

  dispose(): void {
    this.points.geometry.dispose()
    ;(this.points.material as THREE.Material).dispose()
    this.points.parent?.remove(this.points)
  }
}
