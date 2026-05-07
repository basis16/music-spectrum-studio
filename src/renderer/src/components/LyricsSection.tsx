import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AudioInfo,
  LyricLine,
  LyricsSettings,
  ProjectSettings,
  TranscribeEvent
} from '../../../shared/types'
import { parseLyrics } from '../../../shared/lyrics'

interface Props {
  project: ProjectSettings
  audio: AudioInfo | null
  onChangeLines(lines: LyricLine[]): void
  onChangeLyrics(patch: Partial<LyricsSettings>): void
  onChangeMeta(patch: { title?: string; artist?: string }): void
}

type AutoStatus = 'idle' | 'running' | 'done' | 'error' | 'cancelled'

interface AutoState {
  status: AutoStatus
  jobId: string | null
  stage?: string
  message?: string
  progress?: number
  timeSec?: number
  totalSec?: number
  error?: string
}

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語 (Japanese)' },
  { value: 'ko', label: '한국어 (Korean)' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'zh', label: '中文 (Chinese)' },
  { value: 'ar', label: 'العربية (Arabic)' }
]

const MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: 'Xenova/whisper-tiny', label: 'Whisper Tiny (~40 MB · cepat)' },
  { value: 'Xenova/whisper-base', label: 'Whisper Base (~75 MB · seimbang)' },
  { value: 'Xenova/whisper-small', label: 'Whisper Small (~250 MB · akurat)' }
]

const STAGE_LABELS: Record<string, string> = {
  'loading-model': 'Memuat model',
  'decoding-audio': 'Memecah audio',
  transcribing: 'Mentranskripsi audio',
  finalizing: 'Merapikan hasil'
}

export function LyricsSection({ project, audio, onChangeLines, onChangeLyrics, onChangeMeta }: Props): JSX.Element {
  const text = useMemo(() => linesToLrc(project.lines), [project.lines])
  const [language, setLanguage] = useState<string>('auto')
  const [modelId, setModelId] = useState<string>('Xenova/whisper-base')
  const [auto, setAuto] = useState<AutoState>({ status: 'idle', jobId: null })
  const autoJobRef = useRef<string | null>(null)

  useEffect(() => {
    const off = window.mss.onTranscribeEvent((ev: TranscribeEvent) => {
      if (autoJobRef.current && 'jobId' in ev && ev.jobId !== autoJobRef.current) return
      switch (ev.type) {
        case 'transcribe-started':
          setAuto((s) => ({ ...s, status: 'running' }))
          break
        case 'transcribe-stage':
          setAuto((s) => ({ ...s, stage: ev.stage, message: ev.message }))
          break
        case 'transcribe-progress':
          setAuto((s) => ({
            ...s,
            stage: ev.stage ?? s.stage,
            message: ev.message ?? s.message,
            progress: typeof ev.progress === 'number' ? ev.progress : s.progress,
            timeSec: typeof ev.timeSec === 'number' ? ev.timeSec : s.timeSec,
            totalSec: typeof ev.totalSec === 'number' ? ev.totalSec : s.totalSec
          }))
          break
        case 'transcribe-done':
          setAuto((s) => ({ ...s, status: 'done', progress: 1 }))
          if (ev.lines.length > 0) onChangeLines(ev.lines)
          break
        case 'transcribe-cancelled':
          setAuto((s) => ({ ...s, status: 'cancelled' }))
          break
        case 'transcribe-error':
          setAuto((s) => ({ ...s, status: 'error', error: ev.message }))
          break
      }
    })
    return off
  }, [onChangeLines])

  async function importFile(): Promise<void> {
    const res = await window.mss.openLyrics()
    if (res) onChangeLines(res.lines)
  }

  async function generateAuto(): Promise<void> {
    if (!audio?.path) return
    setAuto({ status: 'running', jobId: null, progress: 0, message: 'Menyiapkan…' })
    const jobId = await window.mss.startTranscribe(audio.path, { language, modelId })
    autoJobRef.current = jobId
    setAuto((s) => ({ ...s, jobId }))
  }

  async function cancelAuto(): Promise<void> {
    if (autoJobRef.current) await window.mss.cancelTranscribe(autoJobRef.current)
  }

  function onTextChange(value: string): void {
    onChangeLines(parseLyrics(value))
  }

  const running = auto.status === 'running'
  const pct = Math.max(0, Math.min(1, auto.progress ?? 0))
  const stageLabel = auto.stage ? STAGE_LABELS[auto.stage] ?? auto.stage : ''
  const timeReadout =
    typeof auto.timeSec === 'number' && typeof auto.totalSec === 'number' && auto.totalSec > 0
      ? `${auto.timeSec.toFixed(1)}s / ${auto.totalSec.toFixed(1)}s`
      : ''

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

      <div className="rounded-lg border border-accent-500/30 bg-accent-500/5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-accent-300">Generate lirik otomatis</h4>
            <p className="text-xs text-slate-400">
              Pakai Whisper (lokal, offline) untuk transkrip audio menjadi lirik dengan timestamp.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="label">Bahasa</label>
            <select
              className="select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={running}
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Model</label>
            <select
              className="select"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              disabled={running}
            >
              {MODEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {!running && (
            <button
              type="button"
              className="btn-primary"
              onClick={generateAuto}
              disabled={!audio?.path}
              title={!audio?.path ? 'Pilih audio terlebih dahulu' : undefined}
            >
              Generate lirik otomatis
            </button>
          )}
          {running && (
            <button type="button" className="btn-secondary" onClick={cancelAuto}>
              Batalkan
            </button>
          )}
          {!audio?.path && (
            <span className="text-xs text-slate-500">Pilih file audio dulu di bagian 2.</span>
          )}
          {auto.status === 'done' && (
            <span className="text-xs text-emerald-400">
              Lirik berhasil dihasilkan ({project.lines.length} baris)
            </span>
          )}
          {auto.status === 'cancelled' && <span className="text-xs text-slate-400">Dibatalkan.</span>}
          {auto.status === 'error' && (
            <span className="text-xs text-rose-400">Gagal: {auto.error ?? 'unknown error'}</span>
          )}
        </div>
        {(running || (auto.status !== 'idle' && auto.status !== 'done' && auto.status !== 'cancelled')) && (
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full bg-accent-400 transition-all"
                style={{ width: `${Math.round(pct * 100)}%` }}
              />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              {stageLabel && <span>{stageLabel}</span>}
              {auto.message && <span className="truncate">· {auto.message}</span>}
              {timeReadout && <span>· {timeReadout}</span>}
              {pct > 0 && <span>· {Math.round(pct * 100)}%</span>}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Pertama kali pakai akan mengunduh model (sekali saja, ~40-250 MB tergantung pilihan).
              Hasil ditranskripsi sepenuhnya di komputer Anda — tidak ada audio yang dikirim ke
              server.
            </p>
          </div>
        )}
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
