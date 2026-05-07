import type { ElectronAPI } from '@electron-toolkit/preload'
import type { MssApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    mss: MssApi
  }
}

export {}
