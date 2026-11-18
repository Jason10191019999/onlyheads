import { useEffect, useMemo, useState } from 'react'
import Menu from './ui/Menu'
import RangeView from './ui/RangeView'
import Results from './ui/Results'
import { loadProfile, recordRound, recordScore, saveSettings } from './storage'
import type { RoundResult, Settings } from './game/types'
import { parseChallenge } from './game/share'
import { globalBoardEnabled, submitGlobal } from './net/board'

type Screen = 'menu' | 'range' | 'results'

export default function App() {
  const initial = useMemo(() => {
    const profile = loadProfile()
    const challenge = parseChallenge(window.location.hash)
    if (!challenge) return profile
    return { ...profile, settings: { ...profile.settings, ...challenge } }
  }, [])
  const [screen, setScreen] = useState<Screen>('menu')
  const [settings, setSettings] = useState<Settings>(initial.settings)
  const [rounds, setRounds] = useState(initial.rounds)
  const [board, setBoard] = useState(initial.board)
  const [rank, setRank] = useState(0)
  const [result, setResult] = useState<RoundResult | null>(null)

  useEffect(() => {
    saveSettings(settings)
    document.title =
      settings.lang === 'en' ? 'ONLYheads · headshot-only aim trainer' : 'ONLYheads · 专注爆头的练枪软件'
  }, [settings])

  const patch = (next: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...next }))

  const handleFinish = (round: RoundResult) => {
    const scored = recordScore(round, settings.playerName)
    setResult(round)
    setRank(scored.rank)
    setBoard(scored.board)
    setRounds(recordRound(round))
    if (globalBoardEnabled) {
      void submitGlobal({
        name: settings.playerName,
        score: round.score,
        tier: round.tier,
        headshots: round.headshots,
        accuracy: round.accuracy,
        at: round.at,
        weapon: round.weapon,
      })
    }
    setScreen('results')
  }

  return (
    <div className="app">
      {screen === 'menu' && (
        <Menu
          settings={settings}
          onChange={patch}
          rounds={rounds}
          board={board}
          onStart={() => setScreen('range')}
        />
      )}

      {screen === 'range' && (
        <RangeView
          settings={settings}
          onFinish={handleFinish}
          onExit={() => setScreen('menu')}
        />
      )}

      {screen === 'results' && result && (
        <Results
          result={result}
          rank={rank}
          name={settings.playerName}
          lang={settings.lang}
          onReplay={() => setScreen('range')}
          onMenu={() => setScreen('menu')}
        />
      )}
    </div>
  )
}
