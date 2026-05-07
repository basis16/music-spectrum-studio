import type { OutputSettings, ProjectSettings } from '../../../shared/types'

interface Props {
  project: ProjectSettings
  onChange(patch: Partial<OutputSettings>): void
  onPickPath(): Promise<void>
}

export function OutputSection({ project, onChange, onPickPath }: Props): JSX.Element {
  const o = project.output
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="label">Resolusi</label>
          <select
            className="select"
            value={`${o.width}x${o.height}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split('x').map((s) => parseInt(s, 10))
              onChange({ width: w, height: h })
            }}
          >
            <option value="1280x720">720p (1280×720)</option>
            <option value="1920x1080">1080p (1920×1080)</option>
            <option value="2560x1440">1440p (2560×1440)</option>
            <option value="3840x2160">4K (3840×2160)</option>
            <option value="1080x1920">Vertical 1080×1920</option>
            <option value="1080x1080">Square 1080×1080</option>
          </select>
        </div>
        <div>
          <label className="label">FPS</label>
          <select
            className="select"
            value={o.fps}
            onChange={(e) => onChange({ fps: parseInt(e.target.value, 10) as 24 | 30 | 60 })}
          >
            <option value={24}>24</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </div>
        <div>
          <label className="label">Kualitas (CRF {o.crf})</label>
          <input
            type="range"
            min={14}
            max={28}
            step={1}
            value={o.crf}
            onChange={(e) => onChange({ crf: parseInt(e.target.value, 10) })}
          />
          <p className="mt-1 text-[10px] text-slate-500">Lebih kecil = lebih tajam (file lebih besar)</p>
        </div>
        <div>
          <label className="label">Audio bitrate</label>
          <select
            className="select"
            value={o.audioBitrate}
            onChange={(e) => onChange({ audioBitrate: parseInt(e.target.value, 10) })}
          >
            <option value={128}>128 kbps</option>
            <option value={192}>192 kbps</option>
            <option value={256}>256 kbps</option>
            <option value={320}>320 kbps</option>
          </select>
        </div>
        <div>
          <label className="label">Encoder preset</label>
          <select
            className="select"
            value={o.preset}
            onChange={(e) => onChange({ preset: e.target.value as OutputSettings['preset'] })}
          >
            <option value="ultrafast">ultrafast (cepat, file besar)</option>
            <option value="fast">fast</option>
            <option value="medium">medium (balance)</option>
            <option value="slow">slow</option>
            <option value="veryslow">veryslow (terbaik, lambat)</option>
          </select>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <label className="label">File output</label>
          <div className="flex items-center gap-2">
            <input className="input" readOnly value={o.outputPath} placeholder="Belum dipilih" />
            <button type="button" className="btn-secondary shrink-0" onClick={onPickPath}>
              Pilih…
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
