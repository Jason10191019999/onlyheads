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
   * Headshot: six layers — a low thump for impact, a bright ping, a metallic
   * ring for the tail and a click on top. Slight random detune per shot so a
   * streak does not sound like a machine.
   */
  headshot(streak: number): void {
    const lift = Math.min(streak, 8) * 35
    const detune = 0.99 + Math.random() * 0.02
    const ping = (2500 + lift) * detune

    // body of the hit
    this.tone(150, 0.13, 'sine', 0.19, 62)
    // main ping
    this.tone(ping, 0.085, 'sine', 0.26, ping * 0.82)
    // harmonic that gives it metal
    this.tone(ping * 1.5, 0.055, 'triangle', 0.12, ping * 1.24)
    // ringing tail
    this.tone(ping * 2, 0.16, 'sine', 0.055, ping * 1.84)
    // transient click + air
    this.noise(0.012, 0.15, 'bandpass', 4200, 1.5)
    this.noise(0.05, 0.07, 'highpass', 3000)
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
