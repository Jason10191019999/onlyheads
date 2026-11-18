import { useEffect, useMemo, useState } from 'react'
import { MAX_PER_FLOOR, TIERS } from '../game/config'
import { cmPer360, eDPI, formatCm } from '../game/sensitivity'
import type { Lang, LeaderboardEntry, RoundResult, Settings, Tier, WeaponId } from '../game/types'
import { translator } from '../i18n'
import { challengeUrl } from '../game/share'
import { todayKey } from '../game/rng'
import { fetchGlobalBoard, globalBoardEnabled, type GlobalEntry } from '../net/board'
import { enterFullscreen, isFullscreen, toggleFullscreen } from './fullscreen'

interface Props {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  rounds: RoundResult[]
  board: LeaderboardEntry[]
  onStart: () => void
}

const TIER_KEYS = ['casual', 'standard', 'hardcore'] as const
const WEAPON_IDS: WeaponId[] = ['vandal', 'sheriff']

export default function Menu({ settings, onChange, rounds, board, onStart }: Props) {
  const t = useMemo(() => translator(settings.lang), [settings.lang])
  const [copied, setCopied] = useState(false)
  const [fullScreen, setFullScreen] = useState(isFullscreen)
  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => Promise<void> } | null>(null)

  useEffect(() => {
    const onChange = () => setFullScreen(isFullscreen())
    document.addEventListener('fullscreenchange', onChange)
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as unknown as { prompt: () => Promise<void> })
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      window.removeEventListener('beforeinstallprompt', onPrompt)
    }
  }, [])
  const [global, setGlobal] = useState<GlobalEntry[] | null>(null)

  useEffect(() => {
    if (!globalBoardEnabled) return
    let alive = true
    fetchGlobalBoard().then((rows) => {
      if (alive) setGlobal(rows)
    })
    return () => {
      alive = false
    }
  }, [])

  const copyChallenge = async () => {
    const link = challengeUrl(settings, window.location.origin, window.location.pathname)
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy this link:', link)
    }
  }
  const recent = rounds.slice(0, 5)

  return (
    <div className="menu">
      <div className="menu-inner">
        <header className="brand">
          <h1 className="brand-title">ONLY<span>HEADS</span></h1>
          <p className="brand-sub">{t('tagline')}</p>
        </header>

        <section className="block">
          <h2 className="block-title">{t('tier')}</h2>
          <div className="tier-grid">
            {TIERS.map((tier) => {
              const key = TIER_KEYS[tier.id]
              return (
                <button
                  key={tier.id}
                  type="button"
                  className={`tier-card ${settings.tier === tier.id ? 'active' : ''}`}
                  onClick={() =>
                    onChange({
                      tier: tier.id as Tier,
                      groundCount: tier.ground,
                      balconyCount: tier.balcony,
                    })
                  }
                >
                  <span className="tier-index">0{tier.id + 1}</span>
                  <span className="tier-name">{t(key)}</span>
                  <span className="tier-desc">{t(`${key}Desc` as const)}</span>
                  <span className="tier-meta">
                    {tier.ground + tier.balcony} {t('targets')}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="count-row">
            {(
              [
                ['groundCount', settings.groundCount] as const,
                ['balconyCount', settings.balconyCount] as const,
              ]
            ).map(([key, value]) => (
              <div className="count-group" key={key}>
                <span className="count-label">{t(key)}</span>
                <div className="stepper">
                  <button
                    type="button"
                    aria-label="minus"
                    onClick={() => onChange({ [key]: Math.max(0, value - 1) })}
                  >
                    −
                  </button>
                  <span className="mono">{value}</span>
                  <button
                    type="button"
                    aria-label="plus"
                    onClick={() => onChange({ [key]: Math.min(MAX_PER_FLOOR, value + 1) })}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
            <div className="count-group">
              <span className="count-label">{t('daily')} · {todayKey()}</span>
              <button
                type="button"
                className={`switch ${settings.daily ? 'on' : ''}`}
                onClick={() => onChange({ daily: !settings.daily })}
                aria-label="daily challenge"
              >
                <span />
              </button>
            </div>
            <div className="count-group">
              <span className="count-label">{t('moving')}</span>
              <button
                type="button"
                className={`switch ${settings.moving ? 'on' : ''}`}
                onClick={() => onChange({ moving: !settings.moving })}
                aria-label="moving targets"
              >
                <span />
              </button>
            </div>
            <span className="count-hint">0 – {MAX_PER_FLOOR}</span>
          </div>
        </section>

        <section className="block">
          <h2 className="block-title">{t('weapon')}</h2>
          <div className="weapon-row">
            {WEAPON_IDS.map((id) => {
              const note = id === 'vandal' ? t('vandalNote') : t('sheriffNote')
              return (
                <button
                  key={id}
                  type="button"
                  className={`weapon-chip ${settings.weapon === id ? 'active' : ''}`}
                  onClick={() => onChange({ weapon: id })}
                >
                  <span className="weapon-name">{id === 'vandal' ? t('vandal') : t('sheriff')}</span>
                  <span className="weapon-note">
                    {note}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="block">
          <div className="settings-grid">
            <div className="panel">
              <h2 className="block-title">{t('mouse')}</h2>
              <div className="field">
                <label htmlFor="sens">{t('sens')}</label>
                <input
                  id="sens"
                  className="input mono"
                  type="number"
                  step={0.01}
                  min={0.1}
                  max={10}
                  value={settings.sens}
                  onChange={(event) => onChange({ sens: Number(event.target.value) })}
                />
              </div>
              <div className="field">
                <label htmlFor="dpi">{t('dpi')}</label>
                <input
                  id="dpi"
                  className="input mono"
                  type="number"
                  step={50}
                  min={100}
                  max={6400}
                  value={settings.dpi}
                  onChange={(event) => onChange({ dpi: Number(event.target.value) })}
                />
              </div>
              <div className="readout">
                <div>
                  <span className="readout-label">{t('eDPI')}</span>
                  <span className="readout-value mono">{eDPI(settings.sens, settings.dpi)}</span>
                </div>
                <div>
                  <span className="readout-label">{t('distance360')}</span>
                  <span className="readout-value mono">
                    {formatCm(cmPer360(settings.sens, settings.dpi))}
                  </span>
                </div>
              </div>
            </div>

            <div className="panel">
              <h2 className="block-title">{t('sound')} / {t('lang')}</h2>
              <div className="field">
                <label>{t('sound')}</label>
                <button
                  type="button"
                  className={`switch ${settings.sound ? 'on' : ''}`}
                  onClick={() => onChange({ sound: !settings.sound })}
                  aria-label="sound"
                >
                  <span />
                </button>
              </div>
              <div className="field">
                <label>{t('lang')}</label>
                <div className="seg">
                  {(['zh', 'en'] as Lang[]).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      className={settings.lang === lang ? 'active' : ''}
                      onClick={() => onChange({ lang })}
                    >
                      {lang === 'zh' ? '中文' : 'EN'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel">
              <h2 className="block-title">{t('crosshair')}</h2>
              <div className="field">
                <label>{t('shape')}</label>
                <div className="seg">
                  {(['dot', 'cross'] as const).map((shape) => (
                    <button
                      key={shape}
                      type="button"
                      className={settings.crosshairShape === shape ? 'active' : ''}
                      onClick={() => onChange({ crosshairShape: shape })}
                    >
                      {shape === 'dot' ? t('shapeDot') : t('shapeCross')}
                    </button>
                  ))}
                </div>
              </div>
              {(
                [
                  ['size', settings.crosshairSize, 2, 20] as const,
                  ['gap', settings.crosshairGap, 0, 16] as const,
                  ['thickness', settings.crosshairThickness, 1, 6] as const,
                ]
              ).map(([key, value, min, max]) => (
                <div className="field" key={key}>
                  <label>{t(key)}</label>
                  <div className="stepper">
                    <button
                      type="button"
                      aria-label="minus"
                      disabled={value <= min}
                      onClick={() =>
                        onChange({ [`crosshair${key[0].toUpperCase()}${key.slice(1)}`]: Math.max(min, value - 1) })
                      }
                    >
                      −
                    </button>
                    <span className="mono">{value}</span>
                    <button
                      type="button"
                      aria-label="plus"
                      disabled={value >= max}
                      onClick={() =>
                        onChange({ [`crosshair${key[0].toUpperCase()}${key.slice(1)}`]: Math.min(max, value + 1) })
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              <div className="field">
                <label htmlFor="xh-color">{t('color')}</label>
                <input
                  id="xh-color"
                  className="color-input"
                  type="color"
                  value={settings.crosshairColor}
                  onChange={(event) => onChange({ crosshairColor: event.target.value })}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="block">
          <h2 className="block-title">{t('leaderboard')}</h2>
          <div className="board-card">
            <div className="board-head">
              <label htmlFor="player-name">{t('playerName')}</label>
              <input
                id="player-name"
                className="input"
                maxLength={12}
                value={settings.playerName}
                onChange={(event) => onChange({ playerName: event.target.value })}
              />
            </div>
            {board.length === 0 ? (
              <p className="muted">{t('noScores')}</p>
            ) : (
              <ol className="board">
                {board.slice(0, 10).map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className={index === 0 ? 'board-row top' : 'board-row'}>
                    <span className="board-rank mono">{index + 1}</span>
                    <span className="board-name">{entry.name}</span>
                    <span className="board-meta mono">
                      {t(TIER_KEYS[entry.tier])} · {entry.headshots} {t('heads')}
                    </span>
                    <span className="board-score mono">{entry.score.toLocaleString('en-US')}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        {global && (
          <section className="block">
            <h2 className="block-title">{t('globalBoard')}</h2>
            <div className="board-card">
              {global.length === 0 && <p className="muted">{t('noGlobal')}</p>}
              <ol className="board">
                {global.slice(0, 10).map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className={index === 0 ? 'board-row top' : 'board-row'}>
                    <span className="board-rank mono">{index + 1}</span>
                    <span className="board-name">{entry.name}</span>
                    <span className="board-meta mono">
                      {entry.headshots} {t('heads')}
                    </span>
                    <span className="board-score mono">{entry.score.toLocaleString('en-US')}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        <div className="share-row">
          <button
            type="button"
            className="ghost"
            onClick={() => {
              void toggleFullscreen()
              onChange({ fullscreen: !fullScreen })
            }}
          >
            {fullScreen ? t('exitFullscreen') : t('fullscreen')}
          </button>
          {installPrompt && (
            <button
              type="button"
              className="ghost"
              onClick={async () => {
                await installPrompt.prompt()
                setInstallPrompt(null)
              }}
            >
              {t('installApp')}
            </button>
          )}
          <button type="button" className="ghost" onClick={copyChallenge}>
            {copied ? t('copied') : t('copyChallenge')}
          </button>
        </div>

        <button
          type="button"
          className="start"
          onClick={async () => {
            if (settings.fullscreen) await enterFullscreen()
            onStart()
          }}
        >
          {t('start')}
          <span className="start-chevron" aria-hidden>
            ›
          </span>
        </button>

        <section className="block">
          <h2 className="block-title">{t('recent')}</h2>
          {recent.length === 0 ? (
            <p className="muted">{t('noRounds')}</p>
          ) : (
            <ul className="history">
              {recent.map((round) => (
                <li key={round.at}>
                  <span>{t(TIER_KEYS[round.tier])}</span>
                  <span className="mono muted">
                    {t('bodies')} {round.bodyHits}
                  </span>
                  <span className="mono">{round.score.toLocaleString('en-US')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="foot">{t('footer')}</footer>
      </div>
    </div>
  )
}
