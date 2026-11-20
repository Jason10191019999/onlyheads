// Electron main process: serves the built game from an internal app:// scheme
// (file:// blocks ES modules) and opens it fullscreen with no browser chrome.
const { app, BrowserWindow, protocol, net, Menu, shell } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const DIST = path.join(__dirname, '..', 'dist')
const SMOKE = process.argv.includes('--smoke')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    fullscreen: !SMOKE,
    backgroundColor: '#0b131c',
    autoHideMenuBar: true,
    title: 'ONLYheads',
    icon: path.join(__dirname, '..', 'assets', 'onlyheads.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      // the game reads raw mouse counts; keep the pointer unlocked from any UI
      spellcheck: false,
    },
  })

  Menu.setApplicationMenu(null)

  win.webContents.once('did-finish-load', () => {
    if (SMOKE) {
      console.log('SMOKE_OK')
      setTimeout(() => app.quit(), 300)
    }
  })
  win.webContents.on('did-fail-load', (_event, code, description) => {
    console.error('LOAD_FAILED', code, description)
    if (SMOKE) app.exit(1)
  })

  win.loadURL('app://onlyheads/index.html')

  // F11 / Alt+Enter style shortcuts
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen())
      event.preventDefault()
    }
    if (input.key === 'Escape' && win.isFullScreen()) {
      win.setFullScreen(false)
      event.preventDefault()
    }
  })

  // external links open in the real browser, never inside the game window
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    const filePath = path.join(DIST, decodeURIComponent(url.pathname))
    const resolved = path.normalize(filePath)
    if (!resolved.startsWith(DIST)) return new Response('not found', { status: 404 })
    return net.fetch(pathToFileURL(resolved).toString())
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
