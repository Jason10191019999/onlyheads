import { useEffect, useMemo, useRef, useState } from 'react'
import { RangeEngine } from '../engine/range'
import type { HudState, RoundResult, Settings, WeaponId } from '../game/types'
import { translator } from '../i18n'

interface Props {
  settings: Settings
  onFinish: (result: RoundResult) => void
  onExit: () => void
}

function initialState(weapon: WeaponId): HudState {
  void weapon
  return {
    status: 'idle',
    score: 0,
    streak: 0,
    timeLeftMs: 60_000,
    countdownMs: 0,
    headshots: 0,
    bodyHits: 0,
    penaltyKills: 0,
    pendingPenalties: 0,
  }
}

function formatTime(ms: number): string {
  const total = Math.max(0, ms)
  const seconds = Math.floor(total / 1000)
  const tenths = Math.floor((total % 1000) / 100)
  return `${String(seconds).padStart(2, '0')}.${tenths}`
}

export default function RangeView({ settings, onFinish, onExit }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<RangeEngine | null>(null)
  const timerRef = useRef<number | null>(null)
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish

  const [hud, setHud] = useState<HudState>(() => initialState(settings.weapon))
  const [ending, setEnding] = useState<RoundResult | null>(null)
  const t = useMemo(() => translator(settings.lang), [settings.lang])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const engine = new RangeEngine({
      container: host,
      settings,
      onHud: setHud,
      onRoundEnd: (result) => {
        setEnding(result)
        timerRef.current = window.setTimeout(() => finishRef.current(result), 900)
      },
      onLockChange: () => undefined,
    })
    engineRef.current = engine
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      engine.dispose()
      engineRef.current = null
    }
    // Engine owns a whole round; settings never change while mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const overlayVisible = !ending && (hud.status === 'idle' || hud.status === 'paused')

  return (
    <div className="range">
      <div className="range-host" ref={hostRef} />

      <div className="hud">
        <div className="hud-item top-left">
          <span className="hud-label">{t('score')}</span>
          <span className="hud-big mono">{hud.score.toLocaleString('en-US')}</span>
        </div>

        <div className="hud-item top-center">
          <span className={`timer mono ${hud.timeLeftMs <= 10_000 ? 'low' : ''}`}>
            {formatTime(hud.timeLeftMs)}
          </span>
        </div>

        <div className="hud-item top-right">
          <span className="hud-label">{t('streak')}</span>
          <span className={`hud-big mono ${hud.streak > 0 ? 'hot' : ''}`}>{hud.streak}</span>
        </div>

        <div className="hud-item bottom-left">
          <span className="hud-label">
            {t('heads')} / {t('bodies')}
          </span>
          <span className="mono hud-small">
            {hud.headshots} / <span className={hud.bodyHits > 0 ? 'bad' : ''}>{hud.bodyHits}</span>
          </span>
        </div>

        <div className="hud-item bottom-right">
          <span className="hud-label">{t('ammo')}</span>
          <span className="mono hud-small">∞</span>
        </div>
      </div>

      {overlayVisible && (
        <button
          type="button"
          className="overlay"
          onClick={() => engineRef.current?.requestLock()}
        >
          <span className="overlay-kicker">
            {hud.status === 'paused' ? t('paused') : 'ONLY HEADS'}
          </span>
          <span className="overlay-title">
            {hud.status === 'paused' ? t('continue') : t('clickStart')}
          </span>
          <span className="overlay-hint">{t('hint')}</span>
        </button>
      )}

      {!ending && hud.pendingPenalties > 0 && (
        <div className="penalty-badge mono">
          {t('penalties')} ×{hud.pendingPenalties}
        </div>
      )}

      {!ending && hud.status === 'countdown' && (
        <div className="countdown mono">{Math.ceil(hud.countdownMs / 1000)}</div>
      )}

      {ending && <div className={`timeout ${ending.tier === 2 ? 'hard' : ''}`}>TIME OUT</div>}

      {!ending && (
        <button type="button" className="exit-btn" onClick={onExit}>
          {t('menu')}
        </button>
      )}
    </div>
  )
}
