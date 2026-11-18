import * as THREE from 'three'
import { GameAudio } from './audio'
import { Dummy, disposeDummyAssets } from './dummy'
import { PointerInput } from './input'
import { Particles } from './particles'
import {
  BALCONY_SLOTS,
  BALCONY_Y,
  COUNTDOWN_MS,
  FOV,
  GRAVITY,
  GROUND_SLOTS,
  JUMP_SPEED,
  MIN_TARGET_GAP,
  PILLARS,
  PILLAR_Z,
  PLAYER_EYE,
  PLAYER_MAX_X,
  PLAYER_MAX_Z,
  PLAYER_MIN_X,
  PLAYER_MIN_Z,
  PLAYER_SPEED,
  PLAYER_WALK_SPEED,
  PLAYER_Z,
  RAIL_HEIGHT,
  RAIL_TOP,
  RESPAWN_MS,
  ROUND_MS,
  SPAWN_JITTER_X,
  SPAWN_JITTER_Z,
  SPAWN_TICK_MS,
  WEAPONS,
  type Slot,
  type WeaponConfig,
} from '../game/config'
import { clamp, dirFromYawPitch } from '../game/math'
import { mulberry32, newSeed } from '../game/rng'
import { RoundScorer } from '../game/scoring'
import { radPerCount } from '../game/sensitivity'
import { applySpread, spreadDegrees } from '../game/spread'
import { recoilKick } from '../game/recoil'
import type { HudState, RoundResult, Settings, ShotOutcome, WeaponId } from '../game/types'

type Status = 'idle' | 'countdown' | 'playing' | 'paused' | 'finished'

export interface RangeOptions {
  container: HTMLElement
  settings: Settings
  onHud: (hud: HudState) => void
  onRoundEnd: (result: RoundResult) => void
  onLockChange: (locked: boolean) => void
}

export class RangeEngine {
  private readonly opts: RangeOptions
  private readonly container: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly audio = new GameAudio()
  private readonly particles: Particles
  private readonly input: PointerInput
  private readonly scorer: RoundScorer
  private readonly rng = mulberry32(newSeed())
  private readonly weaponId: WeaponId
  private readonly weaponCfg: WeaponConfig
  private readonly crosshair: HTMLDivElement
  private readonly hitmarker: HTMLDivElement
  private readonly gun: THREE.Group
  private readonly muzzle: THREE.Mesh
  private readonly resizeObserver: ResizeObserver

  private dummies: Dummy[] = []
  private readonly cooldown = new Map<number, number>()
  private lastSlot = -1
  private nextId = 1
  private status: Status = 'idle'
  private pausedFrom: 'countdown' | 'playing' | null = null
  private clock = 0
  private elapsed = 0
  private countdownLeft = 0
  private lastBeep = 0
  private lastFrame = 0
  private raf = 0
  private nextSpawnAt = 0
  private lastHudAt = 0
  private reloadUntil = 0
  private nextFireAt = 0
  private triggerDown = false
  private gunKick = 0
  private muzzleUntil = 0
  private readonly keys = new Set<string>()
  /** m/s actually used for movement inaccuracy, decays after stopping */
  private spreadSpeed = 0
  private jumpY = 0
  private jumpVel = 0
  private grounded = true
  /** view kick in degrees, applied on top of the player's aim */
  private recoilPitch = 0
  private recoilYaw = 0
  private shotIndex = 0
  private lastShotAt = -1e9

  constructor(opts: RangeOptions) {
    this.opts = opts
    this.container = opts.container
    this.weaponId = opts.settings.weapon
    this.weaponCfg = WEAPONS[opts.settings.weapon]
    this.scorer = new RoundScorer(opts.settings.tier)

    const rect = this.container.getBoundingClientRect()
    const width = Math.max(1, rect.width)
    const height = Math.max(1, rect.height)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(width, height, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.4
    this.renderer.domElement.className = 'range-canvas'
    this.container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a1119)
    this.scene.fog = new THREE.Fog(0x0a1119, 34, 90)

    this.camera = new THREE.PerspectiveCamera(verticalFov(), width / height, 0.05, 160)
    this.camera.rotation.order = 'YXZ'
    this.camera.position.set(0, PLAYER_EYE, PLAYER_Z)
    this.scene.add(this.camera)

    this.buildEnvironment()

    const viewmodel = this.buildGun()
    this.gun = viewmodel.group
    this.muzzle = viewmodel.muzzle
    this.camera.add(this.gun)

    this.particles = new Particles(this.scene)

    this.crosshair = document.createElement('div')
    this.crosshair.className = 'crosshair-dot'
    this.hitmarker = document.createElement('div')
    this.hitmarker.className = 'hitmarker'
    for (let i = 0; i < 4; i += 1) {
      const tick = document.createElement('i')
      tick.className = 'hm-tick'
      tick.style.transform = `translate(-50%, -50%) rotate(${45 + i * 90}deg) translateY(-7px)`
      this.hitmarker.appendChild(tick)
    }
    this.container.append(this.crosshair, this.hitmarker)
    this.applyCrosshair()

    this.audio.setVolume(opts.settings.volume)
    this.audio.setEnabled(opts.settings.sound)

    this.input = new PointerInput({
      element: this.renderer.domElement,
      getRadPerCount: () => radPerCount(this.opts.settings.sens),
      onLockChange: this.handleLockChange,
    })

    this.renderer.domElement.addEventListener('click', this.handleCanvasClick)
    document.addEventListener('mousedown', this.handleMouseDown)
    document.addEventListener('mouseup', this.handleMouseUp)
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('blur', this.handleBlur)

    this.resizeObserver = new ResizeObserver(this.handleResize)
    this.resizeObserver.observe(this.container)
    this.handleResize()

    if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
      ;(window as unknown as Record<string, unknown>).__ohDebug = () => ({
        yawDeg: (this.input.yaw * 180) / Math.PI,
        pitchDeg: (this.input.pitch * 180) / Math.PI,
        recoilPitch: this.recoilPitch,
        recoilYaw: this.recoilYaw,
        camX: (this.camera.rotation.x * 180) / Math.PI,
        camY: (this.camera.rotation.y * 180) / Math.PI,
        status: this.status,
        counts: { ground: this.opts.settings.groundCount, balcony: this.opts.settings.balconyCount },
        jumpY: this.jumpY,
        posX: Number(this.camera.position.x.toFixed(2)),
        posZ: Number(this.camera.position.z.toFixed(2)),
        dummies: this.dummies.map((d) => ({
          x: Number(d.root.position.x.toFixed(2)),
          y: Number(d.root.position.y.toFixed(2)),
          z: Number(d.root.position.z.toFixed(2)),
          clone: d.isClone,
        })),
      })
    }

    this.lastFrame = performance.now()
    this.loop()
    this.emitHud(true)
  }

  // ------------------------------------------------------------- lifecycle

  requestLock(): void {
    this.audio.unlock()
    this.input.requestLock()
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    this.renderer.domElement.removeEventListener('click', this.handleCanvasClick)
    document.removeEventListener('mousedown', this.handleMouseDown)
    document.removeEventListener('mouseup', this.handleMouseUp)
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('blur', this.handleBlur)
    this.input.dispose()
    for (const d of this.dummies) d.dispose()
    this.dummies = []
    this.particles.dispose()
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(material)) material.forEach((m) => m.dispose())
      else material?.dispose()
    })
    this.scene.clear()
    disposeDummyAssets()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.crosshair.remove()
    this.hitmarker.remove()
    this.audio.dispose()
  }

  // --------------------------------------------------------------- state

  private maxFor(floor: 0 | 1): number {
    return floor === 0 ? this.opts.settings.groundCount : this.opts.settings.balconyCount
  }

  private begin(): void {
    this.status = 'countdown'
    this.clock = 0
    this.elapsed = 0
    this.countdownLeft = COUNTDOWN_MS
    this.lastBeep = 0
    this.input.reset()
    this.scorer.bank = 0
    this.nextFireAt = 0
    this.nextSpawnAt = 0
    this.recoilPitch = 0
    this.recoilYaw = 0
    this.shotIndex = 0
    this.lastShotAt = -1e9
    this.spreadSpeed = 0
    this.jumpY = 0
    this.jumpVel = 0
    this.grounded = true
    this.gunKick = 0
    this.muzzleUntil = 0
    this.cooldown.clear()
    this.lastSlot = -1
    for (const d of this.dummies) d.dispose()
    this.dummies = []
    this.fillTargets(0)
    this.emitHud(true)
  }

  private finish(): void {
    if (this.status === 'finished') return
    this.status = 'finished'
    this.triggerDown = false
    this.input.exitLock()
    this.audio.finish()
    const result = this.scorer.finish({ weapon: this.weaponId, durationMs: this.elapsed })
    this.emitHud(true)
    this.opts.onRoundEnd(result)
  }

  private handleLockChange = (locked: boolean): void => {
    this.opts.onLockChange(locked)
    if (locked) {
      if (this.status === 'idle') this.begin()
      else if (this.status === 'paused' && this.pausedFrom) {
        this.status = this.pausedFrom
        this.pausedFrom = null
      }
      return
    }
    if (this.status === 'countdown' || this.status === 'playing') {
      this.pausedFrom = this.status
      this.status = 'paused'
      this.triggerDown = false
      this.emitHud(true)
    }
  }

  // ------------------------------------------------------------------ loop

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1)
    this.lastFrame = now

    if (this.status === 'countdown' || this.status === 'playing') {
      this.clock += dt * 1000
      this.update(dt)
    } else {
      this.particles.update(dt)
    }
    this.renderer.render(this.scene, this.camera)
  }

  private update(dt: number): void {
    this.input.flush()
    this.applyRecovery(dt)
    this.updateJump(dt)
    this.applyCamera()
    this.updateMovement(dt)

    if (this.status === 'countdown') {
      this.countdownLeft -= dt * 1000
      const seconds = Math.ceil(this.countdownLeft / 1000)
      if (seconds !== this.lastBeep && seconds > 0) {
        this.lastBeep = seconds
        this.audio.countdown()
      }
      if (this.countdownLeft <= 0) {
        this.status = 'playing'
        this.countdownLeft = 0
        this.audio.start()
        this.emitHud(true)
      }
    } else {
      this.elapsed += dt * 1000
      if (this.elapsed >= ROUND_MS) {
        this.elapsed = ROUND_MS
        this.finish()
        return
      }
    }

    const frozen = this.status === 'countdown'

    for (const d of this.dummies) d.update(this.clock, frozen)

    if (this.status === 'playing') {
      for (const d of [...this.dummies]) {
        if (!d.isClone && this.clock >= d.relocateAt) this.relocate(d)
      }
    }

    if (this.status === 'playing') {
      if (this.triggerDown && this.weaponCfg.automatic) this.fire()
      if (this.clock >= this.nextSpawnAt) {
        this.nextSpawnAt = this.clock + SPAWN_TICK_MS
        this.fillTargets(this.clock)
      }
    }

    this.particles.update(dt)
    this.gunKick *= Math.pow(0.0006, dt)
    this.gun.position.z = -0.68 + this.gunKick
    this.gun.position.y = -0.19 - this.gunKick * 0.35
    this.muzzle.visible = this.clock < this.muzzleUntil
    this.emitHud(false)
  }


  private applyCamera(): void {
    this.camera.rotation.x = this.input.pitch + (this.recoilPitch * Math.PI) / 180
    this.camera.rotation.y = this.input.yaw + (this.recoilYaw * Math.PI) / 180
  }

  /** Valorant pulls the view back to the aim point once the trigger stops. */
  private applyRecovery(dt: number): void {
    if (this.recoilPitch === 0 && this.recoilYaw === 0) return
    if (this.clock - this.lastShotAt < 120) return
    const factor = dt > 0 ? Math.exp(-dt * 11) : 1
    this.recoilPitch *= factor
    this.recoilYaw *= factor
    if (Math.abs(this.recoilPitch) < 0.004 && Math.abs(this.recoilYaw) < 0.004) {
      this.recoilPitch = 0
      this.recoilYaw = 0
      this.shotIndex = 0
    }
  }


  private updateJump(dt: number): void {
    if (!this.grounded) {
      this.jumpVel -= GRAVITY * dt
      this.jumpY += this.jumpVel * dt
      if (this.jumpY <= 0) {
        this.jumpY = 0
        this.jumpVel = 0
        this.grounded = true
      }
    }
    this.camera.position.y = PLAYER_EYE + this.jumpY
    if (!this.grounded) this.spreadSpeed = PLAYER_SPEED
  }

  private updateMovement(dt: number): void {
    let dx = 0
    let dz = 0
    if (this.keys.has('KeyW')) dz -= 1
    if (this.keys.has('KeyS')) dz += 1
    if (this.keys.has('KeyA')) dx -= 1
    if (this.keys.has('KeyD')) dx += 1
    if (dx === 0 && dz === 0) {
      this.spreadSpeed = Math.max(0, this.spreadSpeed - dt * (PLAYER_SPEED / 0.08))
      return
    }
    const len = Math.hypot(dx, dz)
    dx /= len
    dz /= len
    const yaw = this.input.yaw
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)
    const walking = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
    const speed = walking ? PLAYER_WALK_SPEED : PLAYER_SPEED
    this.spreadSpeed = speed
    const step = speed * dt
    this.camera.position.x = clamp(
      this.camera.position.x + (cos * dx + sin * dz) * step,
      PLAYER_MIN_X,
      PLAYER_MAX_X,
    )
    this.camera.position.z = clamp(
      this.camera.position.z + (-sin * dx + cos * dz) * step,
      PLAYER_MIN_Z,
      PLAYER_MAX_Z,
    )
  }

  // ---------------------------------------------------------------- spawn

  private aliveCount(floor: 0 | 1): number {
    let n = 0
    for (const d of this.dummies) if (d.slot.floor === floor) n += 1
    return n
  }

  private fillTargets(now: number): void {
    for (const floor of [0, 1] as const) {
      let attempts = 0
      while (this.aliveCount(floor) < this.maxFor(floor) && attempts < 24) {
        attempts += 1
        const slots = floor === 0 ? GROUND_SLOTS : BALCONY_SLOTS
        const used = new Set(this.dummies.map((d) => d.slot.id))
        const free = slots.filter((s) => !used.has(s.id) && (this.cooldown.get(s.id) ?? 0) <= now)
        if (free.length === 0) break
        const filtered = free.filter((s) => s.id !== this.lastSlot)
        const pool = filtered.length > 0 ? filtered : free
        for (let i = pool.length - 1; i > 0; i -= 1) {
          const j = Math.floor(this.rng() * (i + 1))
          const tmp = pool[i]
          pool[i] = pool[j]
          pool[j] = tmp
        }
        let placed = false
        for (const slot of pool) {
          if (this.trySpawn(slot, now)) {
            placed = true
            break
          }
        }
        if (!placed) break
      }
    }
  }


  /** Normal targets hop to a free spot on their floor so the range keeps moving. */
  private relocate(dummy: Dummy): void {
    const slots = dummy.slot.floor === 0 ? GROUND_SLOTS : BALCONY_SLOTS
    const taken = new Set(this.dummies.map((d) => d.slot.id))
    const free = slots.filter(
      (s) => s.id !== dummy.slot.id && !taken.has(s.id) && (this.cooldown.get(s.id) ?? 0) <= this.clock,
    )
    if (free.length === 0) {
      dummy.relocateAt = this.clock + 1200
      return
    }
    const slot = free[Math.floor(this.rng() * free.length)]
    this.dummies = this.dummies.filter((d) => d !== dummy)
    this.cooldown.set(dummy.slot.id, this.clock + 600)
    dummy.dispose()
    this.trySpawn(slot, this.clock, true)
  }

  private trySpawn(slot: Slot, now: number, silent = false): boolean {
    const tight = slot.baseY > BALCONY_Y + 0.1 || slot.z > -6.6
    const jitterX = (this.rng() * 2 - 1) * (tight ? 0.12 : SPAWN_JITTER_X)
    const jitterZ = (this.rng() * 2 - 1) * (tight ? 0.15 : SPAWN_JITTER_Z)
    const x = slot.x + jitterX
    for (const d of this.dummies) {
      if (d.slot.floor !== slot.floor) continue
      if (Math.abs(d.root.position.x - x) < MIN_TARGET_GAP) return false
    }
    const moving = this.opts.settings.moving
    const dummy = new Dummy({ id: this.nextId++, slot, moving, now, jitterX, jitterZ })
    this.dummies.push(dummy)
    this.scene.add(dummy.root)
    this.lastSlot = slot.id
    this.cooldown.set(slot.id, now + RESPAWN_MS)
    if (!silent) this.audio.spawn()
    return true
  }

  // -------------------------------------------------------------- combat

  private fire(): void {
    if (this.status !== 'playing') return
    if (this.reloadUntil > 0) return
    if (this.clock < this.nextFireAt) return
    this.nextFireAt = this.clock + 1000 / this.weaponCfg.fireRate
    this.gunKick = Math.min(0.055, this.gunKick + 0.04)
    this.muzzleUntil = this.clock + 40
    this.audio.gunshot()

    this.input.flush()
    this.applyCamera()
    const eye = this.camera.position
    const aimPitch = this.input.pitch + (this.recoilPitch * Math.PI) / 180
    const aimYaw = this.input.yaw + (this.recoilYaw * Math.PI) / 180
    const spreadRad = (spreadDegrees(this.spreadSpeed) * Math.PI) / 180
    const dir = applySpread(dirFromYawPitch(aimYaw, aimPitch), aimYaw, spreadRad)

    // The bullet has left the barrel; now the view kicks.
    const kick = recoilKick(this.shotIndex, this.rng())
    this.shotIndex += 1
    this.recoilPitch += kick.pitch
    this.recoilYaw += kick.yaw
    this.lastShotAt = this.clock

    let hit: { dummy: Dummy; region: 'head' | 'body'; t: number } | null = null
    for (const dummy of this.dummies) {
      const result = dummy.hitTest(eye, dir)
      if (result && (!hit || result.t < hit.t)) hit = { dummy, region: result.region, t: result.t }
    }

    const outcome: ShotOutcome = hit ? (hit.region === 'head' ? 'head' : 'body') : 'miss'
    const target = hit?.dummy ?? null
    const event = {
      outcome,
      isFirstShotOnTarget: target !== null && target.shotsOnTarget === 0,
      timeSinceVisibleMs: target ? this.clock - target.visibleAt : 0,
      isPenalty: target?.isClone === true,
    }
    if (target) target.shotsOnTarget += 1

    if (outcome === 'head' && target) {
      if (target.isClone) {
        this.scorer.onPenaltyHead(event)
        this.particles.burst(target.headCenter(), 0x8b9aa6, 14, 2.6)
        this.audio.headshot(this.scorer.streak)
        this.flashHitmarker('head')
      } else {
        const points = this.scorer.onHead(event)
        this.particles.burst(target.headCenter(), 0xffb020, 18, 3.2)
        this.audio.headshot(this.scorer.streak)
        this.flashHitmarker('head')
        this.showPoints(points)
      }
      this.removeDummy(target)
    } else if (outcome === 'body' && target) {
      this.audio.body()
      this.flashHitmarker('body')
      if (target.isClone) {
        this.scorer.onPenaltyBody(event)
        const left = target.takeBodyHit(this.clock)
        this.particles.burst(
          { x: target.root.position.x, y: target.root.position.y + 1.1, z: target.root.position.z },
          0xff5a3c,
          8,
          1.9,
        )
        if (left <= 0) {
          this.particles.burst(target.headCenter(), 0xff3b30, 18, 3.2)
          this.removeDummy(target)
        }
      } else {
        this.scorer.onBody(event)
        this.splitTarget(target)
      }
    } else {
      this.scorer.onMiss(event)
      this.audio.miss()
    }

    this.emitHud(true)
  }


  /**
   * A body hit makes the target vanish and reappear as two penalty bots, one
   * on each side. Both have to be cleared with headshots; the pair is shifted
   * if the spawn point does not have room on both sides.
   */
  private splitTarget(source: Dummy): void {
    const floor = source.slot.floor
    const z = source.root.position.z
    const baseY = source.slot.baseY
    const originX = source.root.position.x
    const onPillar = floor === 1 && baseY > BALCONY_Y + 0.5
    const gap = onPillar ? 0.38 : 0.55

    let center = clamp(originX, -12.4, 12.4)
    const shifts = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4]
    for (const shift of shifts) {
      const candidate = clamp(originX + shift, -12.4, 12.4)
      if (
        this.isSplitSpotFree(candidate - gap, z, floor, baseY, source) &&
        this.isSplitSpotFree(candidate + gap, z, floor, baseY, source)
      ) {
        center = candidate
        break
      }
    }

    this.dummies = this.dummies.filter((d) => d !== source)
    this.cooldown.set(source.slot.id, this.clock + 800)
    this.particles.burst(
      { x: originX, y: baseY + 1.1, z },
      0xff5a3c,
      16,
      3,
    )
    source.dispose()

    for (const side of [-1, 1]) {
      this.spawnPenaltyBot(center + side * gap, z, baseY, floor)
    }
    this.audio.spawn()
  }

  private isSplitSpotFree(x: number, z: number, floor: 0 | 1, baseY: number, ignore: Dummy): boolean {
    if (x < -12.6 || x > 12.6) return false
    for (const d of this.dummies) {
      if (d === ignore || d.slot.floor !== floor) continue
      const dx = d.root.position.x - x
      const dy = d.slot.baseY - baseY
      const dz = d.root.position.z - z
      if (Math.hypot(dx, dy, dz) < MIN_TARGET_GAP) return false
    }
    if (floor === 1 && baseY < BALCONY_Y + 0.5 && Math.abs(z - PILLAR_Z) < 0.8) {
      for (const pillar of PILLARS) {
        if (Math.abs(x - pillar.x) < pillar.w / 2 + 0.35) return false
      }
    }
    return true
  }

  private spawnPenaltyBot(x: number, z: number, baseY: number, floor: 0 | 1): void {
    const pseudo: Slot = {
      id: -1000 - this.nextId,
      floor,
      x,
      z,
      baseY,
      distance: 0,
      hiddenX: null,
    }
    const twin = new Dummy({
      id: this.nextId++,
      slot: pseudo,
      moving: false,
      now: this.clock,
      jitterX: 0,
      jitterZ: 0,
      isClone: true,
    })
    this.dummies.push(twin)
    this.scene.add(twin.root)
  }

  private removeDummy(dummy: Dummy): void {
    this.dummies = this.dummies.filter((d) => d !== dummy)
    dummy.dispose()
    this.cooldown.set(dummy.slot.id, this.clock + RESPAWN_MS)
  }

  private showPoints(points: number): void {
    this.showFlash(`+${points}`, '#4be3d6')
  }

  private showFlash(text: string, color: string): void {
    const el = document.createElement('div')
    el.className = 'floating-points'
    el.textContent = text
    el.style.color = color
    this.container.appendChild(el)
    window.setTimeout(() => el.remove(), 620)
  }

  private flashHitmarker(kind: 'head' | 'body'): void {
    this.hitmarker.style.setProperty('--hm', kind === 'head' ? '#ff4655' : '#8b9aa6')
    this.hitmarker.classList.remove('show')
    void this.hitmarker.offsetWidth
    this.hitmarker.classList.add('show')
  }

  // ------------------------------------------------------------- visuals

  private buildEnvironment(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 44),
      new THREE.MeshStandardMaterial({ color: 0x17222d, roughness: 0.92, metalness: 0.05 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.z = -4
    this.scene.add(floor)

    const grid = new THREE.GridHelper(40, 40, 0x2a3f52, 0x1a2835)
    grid.position.set(0, 0.002, -4)
    this.scene.add(grid)

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x18232f, roughness: 1 })
    const back = new THREE.Mesh(new THREE.PlaneGeometry(90, 40), wallMat)
    back.position.set(0, 12, -16)
    this.scene.add(back)
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(44, 30), wallMat)
      wall.rotation.y = (side * Math.PI) / 2
      wall.position.set(side * 15, 10, -4)
      this.scene.add(wall)
    }

    // Balcony slab
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(26, 0.3, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x1e2a37, roughness: 0.85, metalness: 0.15 }),
    )
    slab.position.set(0, 3.0 - 0.15, -7.25)
    this.scene.add(slab)

    // Solid parapet: hides everything below 4.05 on the balcony
    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(26, RAIL_HEIGHT, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x22303e, roughness: 0.88, metalness: 0.12 }),
    )
    parapet.position.set(0, 3.0 + RAIL_HEIGHT / 2, -6)
    this.scene.add(parapet)
    const railTop = new THREE.Mesh(
      new THREE.BoxGeometry(26.1, 0.06, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x2b3c4a, emissive: 0x122028, emissiveIntensity: 0.7 }),
    )
    railTop.position.set(0, RAIL_TOP, -6)
    this.scene.add(railTop)

    // Cover pillars: uneven widths, heights and spacing
    for (const pillar of PILLARS) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(pillar.w, pillar.h, 1.25),
        new THREE.MeshStandardMaterial({ color: 0x1b2735, roughness: 0.88, metalness: 0.12 }),
      )
      mesh.position.set(pillar.x, 3.0 + pillar.h / 2, PILLAR_Z)
      this.scene.add(mesh)
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(pillar.w + 0.08, 0.06, 1.32),
        new THREE.MeshStandardMaterial({ color: 0x263341, roughness: 0.7, metalness: 0.25 }),
      )
      cap.position.set(pillar.x, 3.0 + pillar.h + 0.03, PILLAR_Z)
      this.scene.add(cap)
    }

    // Uneven buttresses along the parapet
    for (const [x, w] of [
      [-10.2, 0.5],
      [-6.1, 0.8],
      [2.4, 0.6],
      [6.8, 0.9],
      [10.4, 0.45],
    ] as const) {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(w, 1.7, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x1d2a36, roughness: 0.9 }),
      )
      rib.position.set(x, 3.0 + 0.85, -6.1)
      this.scene.add(rib)
    }

    const amber = new THREE.MeshBasicMaterial({ color: 0xffb020 })
    const cyan = new THREE.MeshBasicMaterial({ color: 0x2ad8c8 })
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 22), amber)
      strip.position.set(side * 10.5, 0.05, -3)
      this.scene.add(strip)
      for (const sx of [-6.5, 6.5]) {
        const under = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 2.2), cyan)
        under.position.set(sx, 2.88, -7.2)
        this.scene.add(under)
      }
    }

    this.scene.add(new THREE.HemisphereLight(0x6f93b8, 0x0a1018, 1.9))
    const key = new THREE.DirectionalLight(0xfff0da, 2.6)
    key.position.set(5, 11, 6)
    this.scene.add(key)
    const warm = new THREE.PointLight(0xffb020, 90, 38, 2)
    warm.position.set(3, 5.2, -3)
    this.scene.add(warm)
    const cool = new THREE.PointLight(0x2ad8c8, 90, 40, 2)
    cool.position.set(-7, 3.2, 0)
    this.scene.add(cool)
    // dim fill behind the balcony, so walking past the targets is not pitch black
    const rear = new THREE.PointLight(0x2ad8c8, 45, 34, 2)
    rear.position.set(0, 4.2, -12)
    this.scene.add(rear)
  }

  private buildGun(): { group: THREE.Group; muzzle: THREE.Mesh } {
    const group = new THREE.Group()
    const gunmetal = new THREE.MeshStandardMaterial({
      color: 0x232c36,
      emissive: 0x05090d,
      emissiveIntensity: 1.2,
      roughness: 0.62,
      metalness: 0.32,
    })
    const darker = new THREE.MeshStandardMaterial({
      color: 0x141a21,
      emissive: 0x04070a,
      emissiveIntensity: 1.1,
      roughness: 0.7,
      metalness: 0.26,
    })
    const teal = new THREE.MeshStandardMaterial({
      color: 0x4be3d6,
      emissive: 0x2ad8c8,
      emissiveIntensity: 1.1,
      roughness: 0.4,
    })
    const red = new THREE.MeshStandardMaterial({
      color: 0xff4655,
      emissive: 0xff2233,
      emissiveIntensity: 0.9,
    })
    const glove = new THREE.MeshStandardMaterial({
      color: 0xa87a5c,
      emissive: 0x2a1a12,
      emissiveIntensity: 0.5,
      roughness: 0.82,
      metalness: 0.05,
    })


    if (this.weaponId === 'sheriff') {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 10), gunmetal)
      barrel.rotation.x = Math.PI / 2
      barrel.position.set(0, 0.02, -0.2)
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.075, 10), darker)
      drum.rotation.x = Math.PI / 2
      drum.position.set(0, 0.01, -0.06)
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.075), darker)
      grip.position.set(0, -0.09, 0.06)
      grip.rotation.x = -0.24
      const dot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.012), teal)
      dot.position.set(0, 0.055, -0.18)
      group.add(barrel, drum, grip, dot)
    } else {
      // Vandal: long barrel, tall receiver, curved magazine, skeleton stock
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.125, 0.32), gunmetal)
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.022, 0.46), darker)
      rail.position.set(0, 0.064, -0.12)
      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.072, 0.26), darker)
      handguard.position.set(0, 0.004, -0.33)
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.3, 10), gunmetal)
      barrel.rotation.x = Math.PI / 2
      barrel.position.set(0, 0.02, -0.58)
      const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.07, 10), darker)
      brake.rotation.x = Math.PI / 2
      brake.position.set(0, 0.02, -0.76)
      const gasBlock = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.06, 0.06), gunmetal)
      gasBlock.position.set(0, 0.04, -0.44)

      const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.038, 0.028), darker)
      rearSight.position.set(0, 0.088, 0.04)
      const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.048, 0.018), darker)
      frontSight.position.set(0, 0.086, -0.48)

      const magA = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.15, 0.09), darker)
      magA.position.set(0, -0.125, -0.04)
      magA.rotation.x = -0.16
      const magB = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.12, 0.08), darker)
      magB.position.set(0, -0.235, -0.1)
      magB.rotation.x = -0.5

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.14, 0.075), darker)
      grip.position.set(0, -0.09, 0.1)
      grip.rotation.x = -0.3
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.085, 0.18), darker)
      stock.position.set(0, 0.004, 0.23)
      const stockRail = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.018, 0.14), gunmetal)
      stockRail.position.set(0, 0.055, 0.23)

      const stripL = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.011, 0.17), teal)
      stripL.position.set(-0.037, 0.026, -0.12)
      const stripR = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.011, 0.17), teal)
      stripR.position.set(0.037, 0.026, -0.12)
      const dot = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), red)
      dot.position.set(0.039, 0.042, 0.06)

      const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.165, 0.125), glove)
      rightHand.position.set(0.02, -0.185, 0.12)
      rightHand.rotation.x = -0.3
      const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.095, 0.15), glove)
      leftHand.position.set(0, -0.075, -0.34)
      leftHand.rotation.set(-0.08, 0.05, 0.05)

      group.add(
        receiver,
        rail,
        handguard,
        barrel,
        brake,
        gasBlock,
        rearSight,
        frontSight,
        magA,
        magB,
        grip,
        stock,
        stockRail,
        stripL,
        stripR,
        dot,
        rightHand,
        leftHand,
      )
    }

    group.position.set(0.32, -0.19, -0.68)
    group.rotation.set(0.1, 0.42, 0.02)
    group.scale.setScalar(0.75)

    const muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd27a }),
    )
    muzzle.position.set(0, 0.02, -0.8)
    muzzle.visible = false
    group.add(muzzle)

    return { group, muzzle }
  }

  private applyCrosshair(): void {
    this.crosshair.style.setProperty('--xh-color', this.opts.settings.crosshairColor)
  }

  // ---------------------------------------------------------------- input

  private handleCanvasClick = (): void => {
    if (this.status === 'finished') return
    this.audio.unlock()
    if (!this.input.locked) this.input.requestLock()
  }

  private handleMouseDown = (event: MouseEvent): void => {
    if (!this.input.locked || this.status !== 'playing') return
    if (event.button !== 0) return
    this.audio.unlock()
    this.triggerDown = true
    this.fire()
  }

  private handleMouseUp = (): void => {
    this.triggerDown = false
  }

  private handleBlur = (): void => {
    this.triggerDown = false
    this.keys.clear()
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return
    this.keys.add(event.code)
    if (event.code === 'Space' && this.status === 'playing' && this.grounded) {
      this.jumpVel = JUMP_SPEED
      this.grounded = false
    }
  }

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code)
  }

  private handleResize = (): void => {
    const rect = this.container.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) return
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(rect.width, rect.height, false)
    this.camera.aspect = rect.width / rect.height
    this.camera.updateProjectionMatrix()
  }

  // ------------------------------------------------------------------ hud

  private emitHud(force: boolean): void {
    const now = performance.now()
    if (!force && now - this.lastHudAt < 80) return
    this.lastHudAt = now
    this.opts.onHud({
      status: this.status,
      score: this.scorer.bank,
      streak: this.scorer.streak,
      timeLeftMs: Math.max(0, ROUND_MS - this.elapsed),
      countdownMs: Math.max(0, this.countdownLeft),
      headshots: this.scorer.headshots,
      bodyHits: this.scorer.bodyHits,
      penaltyKills: this.scorer.penaltyKills,
      pendingPenalties: this.dummies.reduce((n, d) => (d.isClone ? n + 1 : n), 0),
    })
  }
}

/** 103 deg horizontal at 16:9 -> vertical FOV used by Three.js. */
function verticalFov(): number {
  const h = (FOV * Math.PI) / 360
  const v = Math.atan(Math.tan(h) * (9 / 16))
  return (v * 360) / Math.PI
}



