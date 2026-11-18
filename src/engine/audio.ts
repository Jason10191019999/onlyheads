/** All sounds are synthesised with the Web Audio API. No assets, no licensing. */
export class GameAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private volume = 0.6
  private enabled = true

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume))
    if (this.master) this.master.gain.value = this.enabled ? this.volume : 0
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (this.master) this.master.gain.value = enabled ? this.volume : 0
  }

  /** Call from a user gesture. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.enabled ? this.volume : 0
      this.master.connect(this.ctx.destination)
      const length = Math.floor(this.ctx.sampleRate * 0.6)
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
      this.noiseBuffer = buffer
    } catch {
      this.ctx = null
    }
  }

  private tone(freq: number, duration: number, type: OscillatorType, gain: number, endFreq?: number): void {
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration)
    }
    env.gain.setValueAtTime(gain, now)
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(env)
    env.connect(this.master)
    osc.start(now)
    osc.stop(now + duration + 0.02)
  }

  private noise(duration: number, gain: number, filterType: BiquadFilterType, frequency: number, q = 0.8): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return
    const now = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = filterType
    filter.frequency.value = frequency
    filter.Q.value = q
    const env = this.ctx.createGain()
    env.gain.setValueAtTime(gain, now)
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    src.connect(filter)
    filter.connect(env)
    env.connect(this.master)
    src.start(now)
    src.stop(now + duration + 0.02)
  }

  gunshot(): void {
    this.noise(0.08, 0.16, 'highpass', 900)
    this.tone(140, 0.08, 'square', 0.08, 60)
  }

  /**
   * Headshot: a bright metallic ping, tuned to sit just above the gunshot so
   * it reads as a separate event. Synthesised, not sampled.
   */
  headshot(streak: number): void {
    const lift = Math.min(streak, 6) * 30
    this.tone(2380 + lift, 0.075, 'sine', 0.22, 2080 + lift)
    this.tone(3560 + lift, 0.05, 'triangle', 0.1, 3220 + lift)
    this.tone(1190, 0.05, 'sine', 0.05, 980)
    this.noise(0.016, 0.1, 'bandpass', 4300, 1.6)
    this.noise(0.055, 0.05, 'highpass', 2700)
  }

  /** Body hit: a duller thock with a short click, clearly below the head ping. */
  body(): void {
    this.tone(238, 0.075, 'sine', 0.17, 150)
    this.noise(0.05, 0.11, 'lowpass', 680)
    this.noise(0.012, 0.06, 'bandpass', 2100, 2)
  }

  miss(): void {
    this.noise(0.04, 0.04, 'bandpass', 1800, 1.4)
  }

  spawn(): void {
    this.tone(720, 0.04, 'sine', 0.035, 900)
  }

  empty(): void {
    this.tone(200, 0.04, 'square', 0.05)
  }

  reload(): void {
    this.tone(300, 0.05, 'triangle', 0.06, 220)
  }

  countdown(): void {
    this.tone(880, 0.06, 'sine', 0.08)
  }

  start(): void {
    this.tone(523, 0.09, 'sine', 0.14)
    this.tone(784, 0.14, 'sine', 0.12)
  }

  finish(): void {
    this.tone(523, 0.1, 'sine', 0.16)
    this.tone(659, 0.18, 'sine', 0.14)
    this.tone(784, 0.32, 'sine', 0.12)
  }

  dispose(): void {
    if (this.ctx) void this.ctx.close()
    this.ctx = null
    this.master = null
    this.noiseBuffer = null
  }
}
