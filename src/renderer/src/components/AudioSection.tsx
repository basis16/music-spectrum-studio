import type { AudioInfo } from '../../../shared/types'
import { formatDuration } from '../lib/format'

interface Props {
  info: AudioInfo | null
  busy: boolean
  onPick(): Promise<void>
}

export function AudioSection({ info, busy, onPick }: Props): JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" disabled={busy} onClick={onPick}>
          {info ? 'Ganti audio' : 'Pilih audio'}
        </button>
        {info && (
          <span className="text-xs text-slate-400 truncate" title={info.path}>
            {info.path}
          </span>
        )}
      </div>
      {info && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Durasi" value={formatDuration(info.durationSec)} />
          <Field label="Format" value={info.format.toUpperCase()} />
          <Field label="Sample Rate" value={`${(info.sampleRate / 1000).toFixed(1)} kHz`} />
          <Field label="Channels" value={String(info.channels)} />
          {info.title && <Field label="Title" value={info.title} className="col-span-2" />}
          {info.artist && <Field label="Artist" value={info.artist} className="col-span-2" />}
        </div>
      )}
      {info?.coverDataUrl && (
        <img
          src={info.coverDataUrl}
          alt="Cover"
          className="h-32 w-32 rounded-md border border-ink-700 object-cover"
        />
      )}
    </div>
  )
}

function Field({ label, value, className }: { label: string; value: string; className?: string }): JSX.Element {
  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm text-slate-200">{value}</p>
    </div>
  )
}
