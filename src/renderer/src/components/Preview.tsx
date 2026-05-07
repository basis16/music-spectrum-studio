import { useEffect, useMemo, useRef, useState } from 'react'
import type { LyricLine, ProjectSettings } from '../../../shared/types'

interface PreviewProps {
  project: ProjectSettings
  audioUrl: string | null
  durationSec: number
}

/**
 * Live preview using HTMLAudioElement + Canvas + Web Audio API.
 * NOTE: this is an *approximation* for the user; the final exported video is
 * rendered server-side by FFmpeg for guaranteed quality + sync.
 */
export function Preview({ project, audioUrl, durationSec }: PreviewProps): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  // Map current time to active lyric line(s)
  const activeLine = useMemo<LyricLine | null>(() => {
    const t = currentTime
    for (const l of project.lines) {
      const end = l.end ?? l.start + 4
      if (t >= l.start && t <= end) return l
    }
    return null
  }, [currentTime, project.lines])

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      try {
        sourceRef.current?.disconnect()
        analyserRef.current?.disconnect()
        void ctxRef.current?.close()
      } catch {
        /* noop */
      }
    }
  }, [audioUrl])

  function ensureAudio(): void {
    if (!audioRef.current) return
    if (!ctxRef.current) {
      const AudioCtx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
      const ctx = new AudioCtx()
      const src = ctx.createMediaElementSource(audioRef.current)
      const an = ctx.createAnalyser()
      an.fftSize = 2048
      an.smoothingTimeConstant = 0.82
      src.connect(an)
      an.connect(ctx.destination)
      ctxRef.current = ctx
      sourceRef.current = src
      analyserRef.current = an
    }
  }

  function loop(): void {
    const a = audioRef.current
    const an = analyserRef.current
    const c = canvasRef.current
    if (!a || !an || !c) return
    setCurrentTime(a.currentTime)
    drawFrame(c, an, project)
    rafRef.current = requestAnimationFrame(loop)
  }

  async function togglePlay(): Promise<void> {
    if (!audioRef.current) return
    ensureAudio()
    if (audioRef.current.paused) {
      await ctxRef.current?.resume()
      await audioRef.current.play()
      setPlaying(true)
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(loop)
    } else {
      audioRef.current.pause()
      setPlaying(false)
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }

  function seek(t: number): void {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.max(0, Math.min(durationSec || 0, t))
    setCurrentTime(audioRef.current.currentTime)
    if (canvasRef.current && analyserRef.current) drawFrame(canvasRef.current, analyserRef.current, project)
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-ink-700 bg-black shadow-2xl shadow-black/50">
        <BackgroundLayer project={project} />
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="absolute inset-0 h-full w-full"
        />
        <LyricOverlay project={project} line={activeLine} />
        {!audioUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
            <div className="text-3xl">🎵</div>
            <p className="text-sm">Upload audio untuk memulai preview</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-primary !px-3"
          onClick={togglePlay}
          disabled={!audioUrl}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <div className="flex flex-1 items-center gap-2 text-xs text-slate-400">
          <span className="w-12 text-right tabular-nums">{format(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(0.1, durationSec)}
            step={0.05}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            disabled={!audioUrl}
            className="flex-1"
          />
          <span className="w-12 tabular-nums">{format(durationSec)}</span>
        </div>
      </div>

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  )
}

function BackgroundLayer({ project }: { project: ProjectSettings }): JSX.Element {
  const bg = project.background
  if (bg.kind === 'solid') {
    return <div className="absolute inset-0" style={{ backgroundColor: bg.color }} />
  }
  if (bg.kind === 'gradient') {
    const stops = [...bg.stops].sort((a, b) => a.offset - b.offset)
    const css = `linear-gradient(${bg.angle}deg, ${stops.map((s) => `${s.color} ${(s.offset * 100).toFixed(0)}%`).join(', ')})`
    return <div className="absolute inset-0" style={{ background: css }} />
  }
  if (bg.kind === 'image') {
    return (
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(file://${bg.path.replace(/\\/g, '/')})`,
          filter: `blur(${(bg.blur * 8).toFixed(1)}px) brightness(${(1 - bg.dim).toFixed(2)})`
        }}
      />
    )
  }
  return <div className="absolute inset-0 bg-black" />
}

function LyricOverlay({ project, line }: { project: ProjectSettings; line: LyricLine | null }): JSX.Element {
  if (!line) return <></>
  const l = project.lyrics
  return (
    <div
      className="pointer-events-none absolute inset-x-0 flex justify-center px-8"
      style={{ top: `${(l.position * 100).toFixed(1)}%`, transform: 'translateY(-50%)' }}
    >
      <p
        className="max-w-[90%] text-balance leading-tight"
        style={{
          fontFamily: l.fontFamily,
          fontSize: `${(l.fontSize / 1080) * 100}cqh`,
          color: l.color,
          textShadow: l.shadow ? `0 2px 8px rgba(0,0,0,0.7), 0 0 ${l.outlineWidth * 2}px ${l.outlineColor}` : 'none',
          WebkitTextStroke: `${l.outlineWidth * 0.5}px ${l.outlineColor}`,
          textAlign: l.align,
          fontWeight: 700
        }}
      >
        {line.text}
      </p>
    </div>
  )
}

function format(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Lightweight Canvas spectrum drawer for the renderer preview. */
function drawFrame(canvas: HTMLCanvasElement, analyser: AnalyserNode, project: ProjectSettings): void {
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return
  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)

  const v = project.visualizer
  const freq = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(freq)
  const tdata = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteTimeDomainData(tdata)

  ctx.save()
  ctx.shadowBlur = v.glow * 24
  ctx.shadowColor = v.color

  if (v.style === 'bars' || v.style === 'cqt') {
    const bars = 96
    const barW = (width / bars) * 0.7
    const gap = (width / bars) * 0.3
    const baseY = height * v.position
    for (let i = 0; i < bars; i++) {
      const idx = Math.floor((i / bars) * freq.length * 0.6)
      const mag = (freq[idx] / 255) * v.intensity
      const h = mag * height * 0.5
      const x = i * (barW + gap)
      const grad = ctx.createLinearGradient(0, baseY - h, 0, baseY)
      grad.addColorStop(0, v.color)
      grad.addColorStop(1, v.colorSecondary)
      ctx.fillStyle = grad
      ctx.fillRect(x, baseY - h, barW, h)
      if (v.mirror) ctx.fillRect(x, baseY, barW, h * 0.6)
    }
  } else if (v.style === 'wave') {
    ctx.beginPath()
    ctx.lineWidth = v.thickness
    ctx.strokeStyle = v.color
    const baseY = height * v.position
    for (let i = 0; i < tdata.length; i++) {
      const x = (i / tdata.length) * width
      const y = baseY + ((tdata[i] - 128) / 128) * height * 0.25 * v.intensity
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  } else if (v.style === 'circular') {
    const cx = width / 2
    const cy = height / 2
    const r = Math.min(width, height) * 0.22
    const bars = 128
    for (let i = 0; i < bars; i++) {
      const idx = Math.floor((i / bars) * freq.length * 0.5)
      const mag = (freq[idx] / 255) * v.intensity
      const a = (i / bars) * Math.PI * 2
      const x1 = cx + Math.cos(a) * r
      const y1 = cy + Math.sin(a) * r
      const x2 = cx + Math.cos(a) * (r + mag * r * 1.6)
      const y2 = cy + Math.sin(a) * (r + mag * r * 1.6)
      ctx.beginPath()
      ctx.lineWidth = v.thickness
      ctx.strokeStyle = mag > 0.6 ? v.colorSecondary : v.color
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }
  } else if (v.style === 'particles') {
    ctx.fillStyle = v.color
    for (let i = 0; i < tdata.length; i++) {
      const a = (tdata[i] / 255) * Math.PI * 2
      const r = (freq[i % freq.length] / 255) * Math.min(width, height) * 0.45 * v.intensity
      const x = width / 2 + Math.cos(a) * r
      const y = height / 2 + Math.sin(a) * r
      ctx.fillRect(x, y, v.thickness, v.thickness)
    }
  }
  ctx.restore()
}
