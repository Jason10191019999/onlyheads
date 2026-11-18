import { useEffect, useMemo, useState } from 'react'
import Menu from './ui/Menu'
import RangeView from './ui/RangeView'
import Results from './ui/Results'
import { loadProfile, recordRound, recordScore, saveSettings } from './storage'
import type { RoundResult, Settings } from './game/types'

type Screen = 'menu' | 'range' | 'results'

export default function App() {
  const initial = useMemo(() => loadProfile(), [])
  const [screen, setScreen] = useState<Screen>('menu')
  const [settings, setSettings] = useState<Settings>(initial.settings)
  const [rounds, setRounds] = useState(initial.rounds)
  const [board, setBoard] = useState(initial.board)
  const [rank, setRank] = useState(0)
  const [result, setResult] = useState<RoundResult | null>(null)

  useEffect(() => {
    saveSettings(settings)
    document.title =
      settings.lang === 'en' ? 'OnlyHeads · headshot-only aim range' : 'OnlyHeads · 只练爆头'
  }, [settings])

  const patch = (next: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...next }))

  const handleFinish = (round: RoundResult) => {
    const scored = recordScore(round, settings.playerName)
    setResult(round)
    setRank(scored.rank)
    setBoard(scored.board)
    setRounds(recordRound(round))
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
          lang={settings.lang}
          onReplay={() => setScreen('range')}
          onMenu={() => setScreen('menu')}
        />
      )}
    </div>
  )
}
