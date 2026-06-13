/* EMPATHEIA Electron entry point.
 *
 * Wraps the Next.js static export (./out) and serves it via a built-in
 * Express-free file:// loader. We intentionally avoid loading remote URLs so
 * the desktop build remains an offline-first companion to the GitHub Pages
 * release.
 */

const { app, BrowserWindow, Menu, shell, session } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const DEV_URL = process.env.ELECTRON_START_URL // e.g. http://localhost:3000
const STATIC_DIR = path.join(__dirname, '..', 'out')
const ICON_DIR = path.join(__dirname, '..', 'build')

const ICON_BY_PLATFORM = {
  darwin: path.join(ICON_DIR, 'icon.icns'),
  win32: path.join(ICON_DIR, 'icon.ico'),
  linux: path.join(ICON_DIR, 'icon.png'),
}

function resolveIcon() {
  const candidate = ICON_BY_PLATFORM[process.platform]
  if (candidate && fs.existsSync(candidate)) return candidate
  const fallback = path.join(__dirname, '..', 'public', 'icon-512.png')
  return fs.existsSync(fallback) ? fallback : undefined
}

function staticIndex() {
  // Static export with `trailingSlash: true` writes the root document as
  // `out/index.html`. Fall back gracefully if a future export changes that.
  const candidates = [
    path.join(STATIC_DIR, 'index.html'),
    path.join(STATIC_DIR, 'index', 'index.html'),
  ]
  return candidates.find((p) => fs.existsSync(p))
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: '#0a0a0a',
    title: 'EMPATHEIA',
    icon: resolveIcon(),
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  })

  if (DEV_URL) {
    win.loadURL(DEV_URL)
  } else {
    const indexFile = staticIndex()
    if (!indexFile) {
      // Render a tiny inline error doc rather than crashing the binary.
      win.loadURL(
        'data:text/html;charset=utf-8,' +
          encodeURIComponent(
            '<h1 style="font-family:system-ui;padding:2rem">' +
              'EMPATHEIA static build missing. Run ' +
              '<code>pnpm build:electron</code> before launching.</h1>',
          ),
      )
    } else {
      win.loadFile(indexFile)
    }
  }

  // Open external links in the OS browser instead of replacing the app shell.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (DEV_URL && url.startsWith(DEV_URL)) return
    if (url.startsWith('file://')) return
    event.preventDefault()
    shell.openExternal(url)
  })

  return win
}

function applyPermissionPolicy() {
  // Camera + microphone are needed for face-api.js mood detection and voice
  // capture. Everything else we deny by default — the app is local-only.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    const allowed = new Set(['media', 'mediaKeySystem', 'clipboard-read'])
    cb(allowed.has(permission))
  })
}

app.whenReady().then(() => {
  applyPermissionPolicy()
  createWindow()

  if (process.platform === 'darwin') {
    // Minimal macOS menu so Cmd+Q / Cmd+W / copy-paste behave natively.
    const template = [
      { role: 'appMenu' },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
      {
        role: 'help',
        submenu: [
          {
            label: 'EMPATHEIA on GitHub',
            click: () =>
              shell.openExternal('https://github.com/sinhaankur/ideal-giggle'),
          },
        ],
      },
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  } else {
    Menu.setApplicationMenu(null)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
