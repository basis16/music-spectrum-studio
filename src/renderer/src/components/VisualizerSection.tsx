import { STYLE_LABELS } from '../lib/styleLabels'
import type { ProjectSettings, VisualizerSettings, VisualizerStyle } from '../../../shared/types'

interface Props {
  project: ProjectSettings
  onChange(patch: Partial<VisualizerSettings>): void
}

export function VisualizerSection({ project, onChange }: Props): JSX.Element {
  const v = project.visualizer
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Style</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(Object.keys(STYLE_LABELS) as VisualizerStyle[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ style: s })}
              className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                v.style === s
                  ? 'border-accent-500 bg-accent-500/10 text-accent-400'
                  : 'border-ink-700 text-slate-300 hover:border-ink-600'
              }`}
            >
              {STYLE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Warna primer</label>
          <input
            type="color"
            value={v.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="h-10 w-full rounded-md border border-ink-600 bg-ink-800 p-1"
          />
        </div>
        <div>
          <label className="label">Warna sekunder</label>
          <input
            type="color"
            value={v.colorSecondary}
            onChange={(e) => onChange({ colorSecondary: e.target.value })}
            className="h-10 w-full rounded-md border border-ink-600 bg-ink-800 p-1"
          />
        </div>
        <div>
          <label className="label">Posisi vertikal ({Math.round(v.position * 100)}%)</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={v.position}
            onChange={(e) => onChange({ position: parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Intensity ({v.intensity.toFixed(2)})</label>
          <input
            type="range"
            min={0.1}
            max={2}
            step={0.05}
            value={v.intensity}
            onChange={(e) => onChange({ intensity: parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Glow ({v.glow.toFixed(2)})</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={v.glow}
            onChange={(e) => onChange({ glow: parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Tebal ({v.thickness}px)</label>
          <input
            type="range"
            min={1}
            max={16}
            step={1}
            value={v.thickness}
            onChange={(e) => onChange({ thickness: parseInt(e.target.value, 10) })}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={v.mirror}
          onChange={(e) => onChange({ mirror: e.target.checked })}
          className="h-4 w-4 accent-accent-500"
        />
        Mirror (kiri/kanan)
      </label>
    </div>
  )
}
