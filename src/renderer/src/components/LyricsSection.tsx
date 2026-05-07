import { useMemo } from 'react'
import type { LyricLine, LyricsSettings, ProjectSettings } from '../../../shared/types'
import { parseLyrics } from '../../../shared/lyrics'

interface Props {
  project: ProjectSettings
  onChangeLines(lines: LyricLine[]): void
  onChangeLyrics(patch: Partial<LyricsSettings>): void
  onChangeMeta(patch: { title?: string; artist?: string }): void
}

export function LyricsSection({ project, onChangeLines, onChangeLyrics, onChangeMeta }: Props): JSX.Element {
  const text = useMemo(() => linesToLrc(project.lines), [project.lines])

  async function importFile(): Promise<void> {
    const res = await window.mss.openLyrics()
    if (res) onChangeLines(res.lines)
  }

  function onTextChange(value: string): void {
    onChangeLines(parseLyrics(value))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Judul</label>
          <input
            className="input"
            value={project.title ?? ''}
            onChange={(e) => onChangeMeta({ title: e.target.value })}
            placeholder="Judul lagu (opsional)"
          />
        </div>
        <div>
          <label className="label">Artis</label>
          <input
            className="input"
            value={project.artist ?? ''}
            onChange={(e) => onChangeMeta({ artist: e.target.value })}
            placeholder="Nama artis (opsional)"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className="btn-secondary" onClick={importFile}>
          Import .lrc / .srt / .txt
        </button>
        <span className="text-xs text-slate-500">{project.lines.length} baris</span>
      </div>

      <div>
        <label className="label">Lirik (format LRC)</label>
        <textarea
          className="textarea h-56"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={`[00:01.20]Baris pertama\n[00:04.50]Baris kedua\n[00:08.00]Baris ketiga`}
          spellCheck={false}
        />
        <p className="mt-1 text-xs text-slate-500">
          Gunakan format <code className="text-accent-400">[mm:ss.xx]Teks</code>. Anda juga bisa paste SRT.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Font</label>
          <select
            className="select"
            value={project.lyrics.fontFamily}
            onChange={(e) => onChangeLyrics({ fontFamily: e.target.value })}
          >
            <option value="Inter">Inter</option>
            <option value="Space Grotesk">Space Grotesk</option>
            <option value="JetBrains Mono">JetBrains Mono</option>
            <option value="Arial">Arial</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Georgia">Georgia</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Verdana">Verdana</option>
          </select>
        </div>
        <div>
          <label className="label">Ukuran ({project.lyrics.fontSize}px)</label>
          <input
            type="range"
            min={28}
            max={140}
            step={2}
            value={project.lyrics.fontSize}
            onChange={(e) => onChangeLyrics({ fontSize: parseInt(e.target.value, 10) })}
          />
        </div>
        <div>
          <label className="label">Animasi</label>
          <select
            className="select"
            value={project.lyrics.animation}
            onChange={(e) => onChangeLyrics({ animation: e.target.value as LyricsSettings['animation'] })}
          >
            <option value="fade">Fade</option>
            <option value="pop">Pop</option>
            <option value="slide">Slide</option>
            <option value="karaoke">Karaoke</option>
            <option value="none">None</option>
          </select>
        </div>
        <div>
          <label className="label">Warna teks</label>
          <input
            type="color"
            value={project.lyrics.color}
            onChange={(e) => onChangeLyrics({ color: e.target.value })}
            className="h-10 w-full rounded-md border border-ink-600 bg-ink-800 p-1"
          />
        </div>
        <div>
          <label className="label">Warna highlight</label>
          <input
            type="color"
            value={project.lyrics.highlightColor}
            onChange={(e) => onChangeLyrics({ highlightColor: e.target.value })}
            className="h-10 w-full rounded-md border border-ink-600 bg-ink-800 p-1"
          />
        </div>
        <div>
          <label className="label">Warna outline</label>
          <input
            type="color"
            value={project.lyrics.outlineColor}
            onChange={(e) => onChangeLyrics({ outlineColor: e.target.value })}
            className="h-10 w-full rounded-md border border-ink-600 bg-ink-800 p-1"
          />
        </div>
        <div>
          <label className="label">Outline ({project.lyrics.outlineWidth}px)</label>
          <input
            type="range"
            min={0}
            max={8}
            step={1}
            value={project.lyrics.outlineWidth}
            onChange={(e) => onChangeLyrics({ outlineWidth: parseInt(e.target.value, 10) })}
          />
        </div>
        <div>
          <label className="label">Posisi vertikal ({Math.round(project.lyrics.position * 100)}%)</label>
          <input
            type="range"
            min={0.05}
            max={0.95}
            step={0.01}
            value={project.lyrics.position}
            onChange={(e) => onChangeLyrics({ position: parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Alignment</label>
          <select
            className="select"
            value={project.lyrics.align}
            onChange={(e) => onChangeLyrics({ align: e.target.value as LyricsSettings['align'] })}
          >
            <option value="left">Kiri</option>
            <option value="center">Tengah</option>
            <option value="right">Kanan</option>
          </select>
        </div>
        <label className="mt-6 flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={project.lyrics.shadow}
            onChange={(e) => onChangeLyrics({ shadow: e.target.checked })}
            className="h-4 w-4 accent-accent-500"
          />
          Bayangan teks
        </label>
      </div>
    </div>
  )
}

function linesToLrc(lines: LyricLine[]): string {
  return lines
    .map((l) => `[${formatLrcTime(l.start)}]${l.text}`)
    .join('\n')
}

function formatLrcTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`
}
