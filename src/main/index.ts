import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

function shortId(): string {
  return randomBytes(8).toString('base64url').replace(/[-_]/g, '').slice(0, 10) || `${Date.now()}`
}

import { RenderService } from './render-service'
import { getAudioInfo } from './audio-info'
import { parseLyrics } from '../shared/lyrics'
import type { ProjectSettings, RenderEvent } from '../shared/types'

let mainWindow: BrowserWindow | null = null
const renderService = new RenderService()
const activeJobs = new Map<string, ReturnType<RenderService['start']>>()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#07070b',
    title: 'Music Spectrum Studio',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.basis.musicspectrumstudio')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function registerIpc(): void {
  ipcMain.handle('dialog:open-audio', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Pilih file audio',
      properties: ['openFile'],
      filters: [
        { name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus'] }
      ]
    })
    if (res.canceled || res.filePaths.length === 0) return null
    const path = res.filePaths[0]
    return await getAudioInfo(path)
  })

  ipcMain.handle('dialog:open-lyrics', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Pilih file lirik (LRC / SRT / TXT)',
      properties: ['openFile'],
      filters: [
        { name: 'Lirik', extensions: ['lrc', 'srt', 'txt'] }
      ]
    })
    if (res.canceled || res.filePaths.length === 0) return null
    const text = readFileSync(res.filePaths[0], 'utf8')
    return { path: res.filePaths[0], text, lines: parseLyrics(text) }
  })

  ipcMain.handle('dialog:open-image', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Pilih background gambar',
      properties: ['openFile'],
      filters: [{ name: 'Gambar', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }]
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  ipcMain.handle('dialog:open-video', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Pilih background video',
      properties: ['openFile'],
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'webm', 'mkv'] }]
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  ipcMain.handle('dialog:save-output', async (_e, defaultName?: string) => {
    const res = await dialog.showSaveDialog({
      title: 'Simpan video output',
      defaultPath: defaultName ?? 'spectrum-video.mp4',
      filters: [{ name: 'MP4', extensions: ['mp4'] }]
    })
    if (res.canceled || !res.filePath) return null
    return res.filePath
  })

  ipcMain.handle('lyrics:parse', (_e, text: string) => parseLyrics(text))

  ipcMain.handle('render:start', (_e, project: ProjectSettings) => {
    const jobId = shortId()
    const job = renderService.start(jobId, project)
    activeJobs.set(jobId, job)
    job.done.finally(() => activeJobs.delete(jobId))
    return jobId
  })

  ipcMain.handle('render:cancel', (_e, jobId: string) => {
    renderService.cancel(jobId)
    return true
  })

  ipcMain.handle('app:open-path', async (_e, path: string) => {
    await shell.openPath(path)
  })

  ipcMain.handle('app:show-in-folder', (_e, path: string) => {
    shell.showItemInFolder(path)
  })

  renderService.on('event', (ev: RenderEvent) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('render:event', ev)
    }
  })
}
