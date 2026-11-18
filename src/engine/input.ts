import { clamp } from '../game/math'

const MAX_PITCH = (89 * Math.PI) / 180

export interface PointerInputOptions {
  element: HTMLElement
  getRadPerCount: () => number
  onLockChange: (locked: boolean) => void
}

/**
 * Pointer-lock mouse look.
 *
 * Deltas are accumulated in the event handler and flushed on demand, so fast
 * flicks are never dropped and a click is always resolved against the exact
 * crosshair position at the moment of the click.
 */
export class PointerInput {
  yaw = 0
  pitch = 0
  locked = false

  private pendingX = 0
  private pendingY = 0
  /** Browsers report a synthetic delta right after locking; ignore that window. */
  private lockedAt = 0
  private readonly element: HTMLElement
  private readonly getRadPerCount: () => number
  private readonly onLockChange: (locked: boolean) => void

  constructor(opts: PointerInputOptions) {
    this.element = opts.element
    this.getRadPerCount = opts.getRadPerCount
    this.onLockChange = opts.onLockChange
    document.addEventListener('pointermove', this.handleMove)
    document.addEventListener('pointerlockchange', this.handleLockChange)
    document.addEventListener('pointerlockerror', this.handleLockError)
    this.element.addEventListener('contextmenu', this.handleContextMenu)
  }

  private handleContextMenu = (event: Event) => event.preventDefault()

  private handleMove = (event: PointerEvent) => {
    if (!this.locked) return
    // The browser re-centres the cursor on lock and reports it as a delta.
    if (performance.now() - this.lockedAt < 400) return
    this.pendingX += event.movementX || 0
    this.pendingY += event.movementY || 0
  }

  private handleLockChange = () => {
    const locked = document.pointerLockElement === this.element
    this.locked = locked
    if (locked) this.lockedAt = performance.now()
    this.pendingX = 0
    this.pendingY = 0
    this.onLockChange(locked)
  }

  private handleLockError = () => {
    this.locked = false
    this.onLockChange(false)
  }

  flush(): void {
    if (performance.now() - this.lockedAt < 400) {
      this.pendingX = 0
      this.pendingY = 0
      return
    }
    if (this.pendingX === 0 && this.pendingY === 0) return
    const rad = this.getRadPerCount()
    this.yaw -= this.pendingX * rad
    this.pitch = clamp(this.pitch - this.pendingY * rad, -MAX_PITCH, MAX_PITCH)
    this.pendingX = 0
    this.pendingY = 0
  }

  requestLock(): void {
    this.lock({ unadjustedMovement: true })
  }

  exitLock(): void {
    if (document.pointerLockElement === this.element) document.exitPointerLock()
  }

  reset(): void {
    this.yaw = 0
    this.pitch = 0
    this.pendingX = 0
    this.pendingY = 0
  }

  dispose(): void {
    document.removeEventListener('pointermove', this.handleMove)
    document.removeEventListener('pointerlockchange', this.handleLockChange)
    document.removeEventListener('pointerlockerror', this.handleLockError)
    this.element.removeEventListener('contextmenu', this.handleContextMenu)
    this.exitLock()
  }

  private lock(options?: PointerLockOptions): void {
    try {
      const result = this.element.requestPointerLock(options) as unknown
      if (result && typeof (result as Promise<void>).catch === 'function') {
        ;(result as Promise<void>).catch(() => {
          if (options) this.lock()
        })
      }
    } catch {
      if (options) this.lock()
    }
  }
}
