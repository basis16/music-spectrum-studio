import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import type { AudioInfo, LyricLine, ProjectSettings, RenderEvent } from '../shared/types'

const api = {
  openAudio(): Promise<AudioInfo | null> {
    return ipcRenderer.invoke('dialog:open-audio')
  },
  openLyrics(): Promise<{ path: string; text: string; lines: LyricLine[] } | null> {
    return ipcRenderer.invoke('dialog:open-lyrics')
  },
  openImage(): Promise<string | null> {
    return ipcRenderer.invoke('dialog:open-image')
  },
  openVideo(): Promise<string | null> {
    return ipcRenderer.invoke('dialog:open-video')
  },
  saveOutput(defaultName?: string): Promise<string | null> {
    return ipcRenderer.invoke('dialog:save-output', defaultName)
  },
  parseLyrics(text: string): Promise<LyricLine[]> {
    return ipcRenderer.invoke('lyrics:parse', text)
  },
  startRender(project: ProjectSettings): Promise<string> {
    return ipcRenderer.invoke('render:start', project)
  },
  cancelRender(jobId: string): Promise<boolean> {
    return ipcRenderer.invoke('render:cancel', jobId)
  },
  openPath(path: string): Promise<void> {
    return ipcRenderer.invoke('app:open-path', path)
  },
  showInFolder(path: string): Promise<void> {
    return ipcRenderer.invoke('app:show-in-folder', path)
  },
  onRenderEvent(cb: (ev: RenderEvent) => void): () => void {
    const listener = (_e: IpcRendererEvent, ev: RenderEvent): void => cb(ev)
    ipcRenderer.on('render:event', listener)
    return () => ipcRenderer.removeListener('render:event', listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('mss', api)
  } catch (err) {
    console.error(err)
  }
} else {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).electron = electronAPI
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).mss = api
}

export type MssApi = typeof api
