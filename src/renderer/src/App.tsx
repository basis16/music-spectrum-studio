import { useEffect, useMemo, useState } from 'react'
import { makeDefaultProject } from './lib/defaults'
import { getPreset } from '../../shared/presets'
import type { AudioInfo, LyricLine, ProjectSettings, RenderEvent, RenderProgress } from '../../shared/types'
import { Section } from './components/Section'
import { AudioSection } from './components/AudioSection'
import { LyricsSection } from './components/LyricsSection'
import { VisualizerSection } from './components/VisualizerSection'
import { BackgroundSection } from './components/BackgroundSection'
import { OutputSection } from './components/OutputSection'
import { Preview } from './components/Preview'
import { PresetPicker } from './components/PresetPicker'
import { RenderProgressBar } from './components/RenderProgress'

type RenderStatus = 'idle' | 'rendering' | 'done' | 'error' | 'cancelled'

export default function App(): JSX.Element {
  const [project, setProject] = useState<ProjectSettings>(() => makeDefaultProject())
  const [audio, setAudio] = useState<AudioInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [renderStatus, setRenderStatus] = useState<RenderStatus>('idle')
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [renderJobId, setRenderJobId] = useState<string | null>(null)

  const audioUrl = useMemo(() => (audio ? `file://${audio.path.replace(/\\/g, '/')}` : null), [audio])
  const durationSec = audio?.durationSec ?? 0

  useEffect(() => {
    const off = window.mss.onRenderEvent((ev: RenderEvent) => {
      if (renderJobId && 'jobId' in ev && ev.jobId !== renderJobId) return
      switch (ev.type) {
        case 'started':
          setRenderStatus('rendering')
          setRenderError(null)
          break
        case 'progress':
          setRenderProgress(ev.payload)
          break
        case 'done':
          setRenderStatus('done')
          setRenderProgress((p) => (p ? { ...p, progress: 1 } : p))
          break
        case 'error':
          setRenderStatus('error')
          setRenderError(ev.message)
          break
        case 'cancelled':
          setRenderStatus('cancelled')
          break
      }
    })
    return off
  }, [renderJobId])

  async function pickAudio(): Promise<void> {
    setBusy(true)
    try {
      const info = await window.mss.openAudio()
      if (info) {
        setAudio(info)
        setProject((p) => {
          const updated: ProjectSettings = {
            ...p,
            audioPath: info.path,
            title: p.title || info.title || '',
            artist: p.artist || info.artist || ''
          }
          return updated
        })
      }
    } finally {
      setBusy(false)
    }
  }

  async function pickOutput(): Promise<void> {
    const defaultName = `${project.title || 'spectrum-video'}.mp4`.replace(/[\\/:*?"<>|]/g, '_')
    const path = await window.mss.saveOutput(defaultName)
    if (path) {
      setProject((p) => ({ ...p, output: { ...p.output, outputPath: path } }))
    }
  }

  function applyPreset(presetId: string): void {
    const p = getPreset(presetId)
    if (!p) return
    setProject((cur) => ({
      ...cur,
      visualizer: p.visualizer,
      background: p.background,
      lyrics: { ...cur.lyrics, ...p.lyrics }
    }))
  }

  async function startRender(): Promise<void> {
    setRenderError(null)
    if (!project.audioPath) {
      setRenderError('Pilih file audio terlebih dahulu.')
      return
    }
    if (!project.output.outputPath) {
      await pickOutput()
      return
    }
    if (project.lines.length === 0) {
      setRenderError('Tambahkan lirik (impor LRC/SRT atau ketik langsung) sebelum render.')
      return
    }
    setRenderStatus('rendering')
    setRenderProgress(null)
    const jobId = await window.mss.startRender(project)
    setRenderJobId(jobId)
  }

  async function cancelRender(): Promise<void> {
    if (renderJobId) await window.mss.cancelRender(renderJobId)
  }

  const canRender = !!audio && !!project.output.outputPath && project.lines.length > 0 && renderStatus !== 'rendering'

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left settings panel */}
      <aside className="flex w-[600px] shrink-0 flex-col border-r border-ink-800 bg-ink-950">
        <header className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent-500/15 text-accent-400">
              <span className="text-lg">♪</span>
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-slate-100">Music Spectrum Studio</h1>
              <p className="text-xs text-slate-500">Lyric video maker · Profesional</p>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          <Section title="1. Preset" subtitle="Mulai dari template profesional, lalu tweak.">
            <PresetPicker project={project} onSelect={applyPreset} />
          </Section>
          <Section title="2. Audio" subtitle="MP3 / WAV / FLAC / M4A / OGG / OPUS">
            <AudioSection info={audio} busy={busy} onPick={pickAudio} />
          </Section>
          <Section title="3. Lirik & Tipografi" subtitle="Import LRC/SRT atau ketik manual.">
            <LyricsSection
              project={project}
              audio={audio}
              onChangeLines={(lines: LyricLine[]) => setProject((p) => ({ ...p, lines }))}
              onChangeLyrics={(patch) => setProject((p) => ({ ...p, lyrics: { ...p.lyrics, ...patch } }))}
              onChangeMeta={(patch) => setProject((p) => ({ ...p, ...patch }))}
            />
          </Section>
          <Section title="4. Visualizer" subtitle="Style & warna spectrum.">
            <VisualizerSection
              project={project}
              onChange={(patch) => setProject((p) => ({ ...p, visualizer: { ...p.visualizer, ...patch } }))}
            />
          </Section>
          <Section title="5. Background" subtitle="Solid · Gradient · Gambar · Video loop">
            <BackgroundSection project={project} onChange={(bg) => setProject((p) => ({ ...p, background: bg }))} />
          </Section>
          <Section title="6. Output" subtitle="Resolusi · FPS · Kualitas">
            <OutputSection
              project={project}
              onChange={(patch) => setProject((p) => ({ ...p, output: { ...p.output, ...patch } }))}
              onPickPath={pickOutput}
            />
          </Section>
        </div>
        <footer className="border-t border-ink-800 p-4">
          <button
            type="button"
            onClick={startRender}
            disabled={!canRender}
            className="btn-primary w-full !py-3 text-sm font-semibold"
          >
            {renderStatus === 'rendering' ? 'Sedang merender…' : 'Render Video MP4'}
          </button>
          <p className="mt-2 text-center text-[10px] text-slate-500">
            Tip: gunakan preset CRF 18 + preset medium untuk kualitas terbaik.
          </p>
        </footer>
      </aside>

      {/* Right preview + render */}
      <main className="flex flex-1 flex-col bg-ink-900 p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-base font-semibold text-slate-200">Preview</h2>
          <p className="text-xs text-slate-500">
            Preview sederhana — output akhir lebih tajam (rendered oleh FFmpeg).
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <Preview project={project} audioUrl={audioUrl} durationSec={durationSec} />
        </div>
        <RenderProgressBar
          status={renderStatus}
          progress={renderProgress}
          error={renderError}
          outputPath={renderStatus === 'done' ? project.output.outputPath : null}
          onCancel={cancelRender}
          onOpen={() => project.output.outputPath && window.mss.openPath(project.output.outputPath)}
          onShowInFolder={() => project.output.outputPath && window.mss.showInFolder(project.output.outputPath)}
        />
      </main>
    </div>
  )
}
