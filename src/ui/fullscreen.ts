export function isFullscreen(): boolean {
  return Boolean(document.fullscreenElement)
}

export async function enterFullscreen(): Promise<void> {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
  } catch {
    /* the browser may refuse without a gesture; never block the game */
  }
}

export async function exitFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
  } catch {
    /* ignore */
  }
}

export async function toggleFullscreen(): Promise<void> {
  if (isFullscreen()) await exitFullscreen()
  else await enterFullscreen()
}

export function onFullscreenChange(callback: (full: boolean) => void): () => void {
  const handler = () => callback(isFullscreen())
  document.addEventListener('fullscreenchange', handler)
  return () => document.removeEventListener('fullscreenchange', handler)
}
