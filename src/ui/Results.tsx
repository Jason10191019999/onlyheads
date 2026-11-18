import { useMemo } from 'react'
import type { Lang, RoundResult } from '../game/types'
import { translator } from '../i18n'
import { saveResultCard } from './shareImage'

interface Props {
  result: RoundResult
  rank: number
  name: string
  lang: Lang
  onReplay: () => void
  onMenu: () => void
}

const pct = (value: number) => `${Math.round(value * 100)}%`
const secs = (ms: number) => `${(ms / 1000).toFixed(2)}s`

export default function Results({ result, rank, name, lang, onReplay, onMenu }: Props) {
  const t = useMemo(() => translator(lang), [lang])

  return (
    <div className="results">
      <div className="results-card">
        <p className="results-kicker">{t('results')}</p>
        <p className="results-reason">
          {result.endReason === 'bodyHits' ? t('endBody') : t('endTime')}
          {rank > 0 ? ` · #${rank}` : ''}
        </p>
        <p className="results-score mono">{result.score.toLocaleString('en-US')}</p>

        <div className="stat-grid">
          <Stat label={t('bestStreak')} value={String(result.bestStreak)} />
          <Stat label={t('bodyHits')} value={String(result.bodyHits)} tone={result.bodyHits > 0 ? 'bad' : undefined} />
          <Stat label={t('penalties')} value={String(result.penaltyKills)} />
          <Stat label={t('killsPerMin')} value={result.killsPerMin.toFixed(1)} />
          <Stat label={t('firstShot')} value={pct(result.firstShotHsRate)} />
          <Stat label={t('avgTtk')} value={result.headshots > 0 ? secs(result.avgTtkMs) : '—'} />
          <Stat label={t('accuracy')} value={result.shots > 0 ? pct(result.accuracy) : '—'} />
        </div>

        <div className="results-actions">
          <button
            type="button"
            className="btn"
            onClick={() =>
              saveResultCard(
                result,
                name,
                {
                  score: t('score'),
                  heads: t('heads'),
                  bodies: t('bodies'),
                  firstShot: t('firstShot'),
                  accuracy: t('accuracy'),
                },
                `${window.location.origin}${window.location.pathname}`,
              )
            }
          >
            {t('saveCard')}
          </button>
          <button type="button" className="btn primary" onClick={onReplay}>
            {t('replay')}
          </button>
          <button type="button" className="btn" onClick={onMenu}>
            {t('menu')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value mono ${tone === 'bad' ? 'bad' : ''}`}>{value}</span>
    </div>
  )
}
