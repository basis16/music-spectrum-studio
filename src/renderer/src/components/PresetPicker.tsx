import { PRESETS } from '../../../shared/presets'
import type { ProjectSettings } from '../../../shared/types'

interface Props {
  project: ProjectSettings
  onSelect(presetId: string): void
}

export function PresetPicker({ project, onSelect }: Props): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {PRESETS.map((p) => {
        const active = isActive(project, p.id)
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={`group rounded-lg border p-3 text-left transition-colors ${
              active ? 'border-accent-500 bg-accent-500/5' : 'border-ink-700 hover:border-ink-600 hover:bg-ink-800'
            }`}
          >
            <div className="mb-2 h-12 w-full rounded" style={previewStyle(p)} />
            <h4 className="text-sm font-semibold text-slate-100">{p.name}</h4>
            <p className="mt-1 line-clamp-2 text-xs text-slate-400">{p.description}</p>
          </button>
        )
      })}
    </div>
  )
}

function isActive(project: ProjectSettings, presetId: string): boolean {
  const p = PRESETS.find((x) => x.id === presetId)
  if (!p) return false
  return p.visualizer.style === project.visualizer.style && p.visualizer.color === project.visualizer.color
}

function previewStyle(p: (typeof PRESETS)[number]): React.CSSProperties {
  if (p.background.kind === 'gradient') {
    const stops = [...p.background.stops].sort((a, b) => a.offset - b.offset)
    return {
      background: `linear-gradient(${p.background.angle}deg, ${stops.map((s) => s.color).join(', ')})`,
      boxShadow: `inset 0 -8px 16px ${p.visualizer.color}40`
    }
  }
  if (p.background.kind === 'solid') {
    return {
      background: p.background.color,
      boxShadow: `inset 0 -8px 16px ${p.visualizer.color}40`
    }
  }
  return { background: '#000' }
}
