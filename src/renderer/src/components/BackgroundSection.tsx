import type { Background, ProjectSettings } from '../../../shared/types'

interface Props {
  project: ProjectSettings
  onChange(bg: Background): void
}

export function BackgroundSection({ project, onChange }: Props): JSX.Element {
  const bg = project.background

  async function pickImage(): Promise<void> {
    const path = await window.mss.openImage()
    if (path) onChange({ kind: 'image', path, blur: 0.2, dim: 0.3 })
  }

  async function pickVideo(): Promise<void> {
    const path = await window.mss.openVideo()
    if (path) onChange({ kind: 'video', path, dim: 0.3 })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <KindButton active={bg.kind === 'solid'} onClick={() => onChange({ kind: 'solid', color: '#0a0a1a' })}>
          Warna solid
        </KindButton>
        <KindButton
          active={bg.kind === 'gradient'}
          onClick={() =>
            onChange({
              kind: 'gradient',
              angle: 135,
              stops: [
                { offset: 0, color: '#0f172a' },
                { offset: 1, color: '#22d3ee' }
              ]
            })
          }
        >
          Gradient
        </KindButton>
        <KindButton active={bg.kind === 'image'} onClick={pickImage}>
          Gambar…
        </KindButton>
        <KindButton active={bg.kind === 'video'} onClick={pickVideo}>
          Video loop…
        </KindButton>
      </div>

      {bg.kind === 'solid' && (
        <div>
          <label className="label">Warna</label>
          <input
            type="color"
            value={bg.color}
            onChange={(e) => onChange({ kind: 'solid', color: e.target.value })}
            className="h-10 w-32 rounded-md border border-ink-600 bg-ink-800 p-1"
          />
        </div>
      )}

      {bg.kind === 'gradient' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Sudut ({bg.angle}°)</label>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={bg.angle}
              onChange={(e) => onChange({ ...bg, angle: parseInt(e.target.value, 10) })}
            />
          </div>
          {bg.stops.map((s, i) => (
            <div key={i}>
              <label className="label">Stop {i + 1}</label>
              <input
                type="color"
                value={s.color}
                onChange={(e) => {
                  const stops = bg.stops.slice()
                  stops[i] = { ...s, color: e.target.value }
                  onChange({ ...bg, stops })
                }}
                className="h-10 w-full rounded-md border border-ink-600 bg-ink-800 p-1"
              />
            </div>
          ))}
        </div>
      )}

      {bg.kind === 'image' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 break-all">{bg.path}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Blur ({bg.blur.toFixed(2)})</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={bg.blur}
                onChange={(e) => onChange({ ...bg, blur: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Dim ({bg.dim.toFixed(2)})</label>
              <input
                type="range"
                min={0}
                max={0.85}
                step={0.05}
                value={bg.dim}
                onChange={(e) => onChange({ ...bg, dim: parseFloat(e.target.value) })}
              />
            </div>
          </div>
        </div>
      )}

      {bg.kind === 'video' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 break-all">{bg.path}</p>
          <div>
            <label className="label">Dim ({bg.dim.toFixed(2)})</label>
            <input
              type="range"
              min={0}
              max={0.85}
              step={0.05}
              value={bg.dim}
              onChange={(e) => onChange({ ...bg, dim: parseFloat(e.target.value) })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function KindButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
        active ? 'border-accent-500 bg-accent-500/10 text-accent-400' : 'border-ink-700 text-slate-300 hover:border-ink-600'
      }`}
    >
      {children}
    </button>
  )
}
