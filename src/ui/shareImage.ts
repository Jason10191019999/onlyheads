import type { RoundResult } from '../game/types'

export interface CardLabels {
  score: string
  heads: string
  bodies: string
  firstShot: string
  accuracy: string
}

const W = 1200
const H = 630
const BG = '#0b131c'
const RED = '#ff4655'
const TEAL = '#4be3d6'
const MUTED = '#7d8b99'
const TEXT = '#e9eef3'

const pct = (value: number) => `${Math.round(value * 100)}%`

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function drawResultCard(
  result: RoundResult,
  name: string,
  labels: CardLabels,
  url: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  // background
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(160, 40, 20, 160, 40, 620)
  glow.addColorStop(0, 'rgba(255, 70, 85, 0.28)')
  glow.addColorStop(1, 'rgba(255, 70, 85, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  const cool = ctx.createRadialGradient(1040, 600, 20, 1040, 600, 460)
  cool.addColorStop(0, 'rgba(75, 227, 214, 0.16)')
  cool.addColorStop(1, 'rgba(75, 227, 214, 0)')
  ctx.fillStyle = cool
  ctx.fillRect(0, 0, W, H)

  // accent bar
  ctx.fillStyle = RED
  ctx.fillRect(64, 64, 6, 92)

  // wordmark
  const display = '700 58px Bahnschrift, "Arial Narrow", Impact, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.font = display
  const onlyWidth = ctx.measureText('ONLY').width
  ctx.fillStyle = TEXT
  ctx.fillText('ONLY', 90, 132)
  ctx.fillStyle = RED
  ctx.fillText('HEADS', 90 + onlyWidth, 132)

  // subtitle + player
  ctx.font = '500 20px Bahnschrift, Arial, sans-serif'
  ctx.fillStyle = MUTED
  ctx.fillText('headshot-only aim trainer', 92, 168)
  ctx.fillStyle = TEAL
  ctx.fillText(name, 92, 200)

  // score
  ctx.font = '700 150px Bahnschrift, "Arial Narrow", Impact, sans-serif'
  ctx.fillStyle = TEXT
  ctx.fillText(result.score.toLocaleString('en-US'), 88, 386)
  ctx.font = '600 22px Bahnschrift, Arial, sans-serif'
  ctx.fillStyle = MUTED
  ctx.fillText(labels.score.toUpperCase(), 94, 420)

  // stats panel
  const panelX = 700
  const panelY = 250
  roundRect(ctx, panelX, panelY, 436, 240, 6)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.lineWidth = 1
  ctx.stroke()

  const stats: Array<[string, string]> = [
    [labels.heads, String(result.headshots)],
    [labels.bodies, String(result.bodyHits)],
    [labels.firstShot, pct(result.firstShotHsRate)],
    [labels.accuracy, pct(result.accuracy)],
  ]
  ctx.textAlign = 'left'
  for (let i = 0; i < stats.length; i += 1) {
    const y = panelY + 54 + i * 54
    ctx.font = '500 18px Bahnschrift, Arial, sans-serif'
    ctx.fillStyle = MUTED
    ctx.fillText(stats[i][0], panelX + 28, y)
    ctx.textAlign = 'right'
    ctx.font = '700 30px Bahnschrift, Arial, sans-serif'
    ctx.fillStyle = TEXT
    ctx.fillText(stats[i][1], panelX + 408, y)
    ctx.textAlign = 'left'
  }

  // footer
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.fillRect(92, 520, 1016, 1)
  ctx.font = '600 22px Bahnschrift, Arial, sans-serif'
  ctx.fillStyle = TEAL
  ctx.fillText(url.replace(/^https?:\/\//, ''), 92, 566)
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = '500 18px Bahnschrift, Arial, sans-serif'
  ctx.fillText(new Date(result.at).toLocaleDateString(), 1108, 566)
  ctx.textAlign = 'left'

  return canvas
}

export function saveResultCard(
  result: RoundResult,
  name: string,
  labels: CardLabels,
  url: string,
): void {
  const canvas = drawResultCard(result, name, labels, url)
  canvas.toBlob((blob) => {
    if (!blob) return
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `onlyheads-${result.score}.png`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(link.href), 4000)
  }, 'image/png')
}
