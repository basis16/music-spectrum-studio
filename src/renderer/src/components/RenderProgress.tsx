import type { RenderProgress as P } from '../../../shared/types'
import { formatEta } from '../lib/format'

interface Props {
  status: 'idle' | 'rendering' | 'done' | 'error' | 'cancelled'
  progress: P | null
  error?: string | null
  outputPath?: string | null
  onCancel(): void
  onOpen(): void
  onShowInFolder(): void
}

export function RenderProgressBar({ status, progress, error, outputPath, onCancel, onOpen, onShowInFolder }: Props): JSX.Element | null {
  if (status === 'idle' && !progress) return null
  return (
    <div className="panel mt-3 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-100">
            {status === 'rendering' && 'Rendering…'}
            {status === 'done' && 'Selesai'}
            {status === 'error' && 'Error'}
            {status === 'cancelled' && 'Dibatalkan'}
          </p>
          {progress && (
            <p className="text-xs text-slate-400">
              {progress.timeSec.toFixed(1)}s / {progress.totalSec.toFixed(1)}s · {progress.fps.toFixed(0)} fps · {progress.speed.toFixed(2)}x · ETA {formatEta(progress.etaSec)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {status === 'rendering' && (
            <button type="button" className="btn-ghost" onClick={onCancel}>
              Batal
            </button>
          )}
          {status === 'done' && outputPath && (
            <>
              <button type="button" className="btn-secondary" onClick={onShowInFolder}>
                Buka folder
              </button>
              <button type="button" className="btn-primary" onClick={onOpen}>
                Putar video
              </button>
            </>
          )}
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-700">
        <div
          className="h-full bg-accent-500 transition-[width] duration-150 ease-out"
          style={{ width: `${(progress ? progress.progress * 100 : status === 'done' ? 100 : 0).toFixed(1)}%` }}
        />
      </div>
      {error && <p className="mt-2 text-xs text-rose-400 break-words">{error}</p>}
      {status === 'done' && outputPath && (
        <p className="mt-2 text-xs text-slate-400 break-all">Output: {outputPath}</p>
      )}
    </div>
  )
}
