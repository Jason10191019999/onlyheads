/**
 * Valorant → browser 1:1 sensitivity.
 * Valorant turns 0.07° per mouse count at sensitivity 1.0.
 */
export const VALORANT_DEG_PER_COUNT = 0.07

export const MIN_SENS = 0.1
export const MAX_SENS = 10
export const MIN_DPI = 100
export const MAX_DPI = 6400

export function sanitizeSens(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.min(MAX_SENS, Math.max(MIN_SENS, Number(value.toFixed(3))))
}

export function sanitizeDpi(value: number): number {
  if (!Number.isFinite(value)) return 800
  return Math.min(MAX_DPI, Math.max(MIN_DPI, Math.round(value)))
}

export function radPerCount(valorantSens: number): number {
  return (VALORANT_DEG_PER_COUNT * sanitizeSens(valorantSens) * Math.PI) / 180
}

export function countsPer360(valorantSens: number): number {
  return 360 / (VALORANT_DEG_PER_COUNT * sanitizeSens(valorantSens))
}

export function cmPer360(valorantSens: number, dpi: number): number {
  return (countsPer360(valorantSens) / sanitizeDpi(dpi)) * 2.54
}

export function eDPI(valorantSens: number, dpi: number): number {
  return Math.round(sanitizeSens(valorantSens) * sanitizeDpi(dpi))
}

export function formatCm(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return `${value.toFixed(1)} cm`
}
