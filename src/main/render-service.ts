import { spawn, ChildProcess } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import ffmpegPath from 'ffmpeg-static'
import ffprobeStaticImport from 'ffprobe-static'

import type { ProjectSettings, RenderEvent, RenderProgress } from '../shared/types'
import { buildAss } from '../shared/lyrics'
import { buildVisualizerFilter } from './visualizer'
import { buildBackground } from './background'

const ffprobePath = (ffprobeStaticImport as { path: string }).path

export interface RenderServiceOpts {
  /** Override for ffmpeg binary (mainly for testing) */
  ffmpegBin?: string
  ffprobeBin?: string
}

export interface RenderJob {
  id: string
  cancel: () => void
  done: Promise<{ outputPath: string; durationMs: number }>
}

export class RenderService extends EventEmitter {
  private opts: RenderServiceOpts
  private active = new Map<string, ChildProcess>()

  constructor(opts: RenderServiceOpts = {}) {
    super()
    this.opts = opts
  }

  ffmpeg(): string {
    return this.opts.ffmpegBin ?? (ffmpegPath as unknown as string) ?? 'ffmpeg'
  }

  ffprobe(): string {
    return this.opts.ffprobeBin ?? ffprobePath ?? 'ffprobe'
  }

  async probeDuration(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const args = ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioPath]
      const proc = spawn(this.ffprobe(), args)
      let out = ''
      let err = ''
      proc.stdout.on('data', (d) => (out += d.toString()))
      proc.stderr.on('data', (d) => (err += d.toString()))
      proc.on('error', reject)
      proc.on('close', (code) => {
        if (code !== 0) return reject(new Error(`ffprobe failed (${code}): ${err}`))
        const dur = parseFloat(out.trim())
        if (!Number.isFinite(dur) || dur <= 0) return reject(new Error(`Invalid duration: ${out}`))
        resolve(dur)
      })
    })
  }

  /**
   * Build the FFmpeg argv for the given project. Side-effect: writes the ASS
   * subtitle file and any temporary background asset to disk.
   * Returns the argv list and a cleanup function for the temp directory.
   */
  async buildArgs(project: ProjectSettings, durationSec: number): Promise<{ argv: string[]; cleanup: () => void }> {
    const tmp = mkdtempSync(join(tmpdir(), 'mss-render-'))
    const assPath = join(tmp, 'lyrics.ass')

    const ass = buildAss({
      width: project.output.width,
      height: project.output.height,
      fontFamily: project.lyrics.fontFamily,
      fontSize: project.lyrics.fontSize,
      color: project.lyrics.color,
      highlightColor: project.lyrics.highlightColor,
      outlineColor: project.lyrics.outlineColor,
      outlineWidth: project.lyrics.outlineWidth,
      position: project.lyrics.position,
      align: project.lyrics.align,
      animation: project.lyrics.animation,
      shadow: project.lyrics.shadow,
      lines: project.lines,
      title: project.title,
      artist: project.artist
    })
    writeFileSync(assPath, ass, 'utf8')

    const bg = buildBackground(project.background, project.output.width, project.output.height, project.output.fps, durationSec)
    const visFilter = buildVisualizerFilter(
      project.output.width,
      Math.round(project.output.height * 0.5),
      project.output.fps,
      project.visualizer
    )
    const overlayY = Math.round(project.output.height * project.visualizer.position - project.output.height * 0.25)

    const escapedAss = escapeFilterPath(assPath)

    const filterComplex = [
      bg.filterChain,
      visFilter,
      `[bg][spec]overlay=0:${overlayY}:format=auto[v1]`,
      `[v1]ass='${escapedAss}'[vout]`
    ].join(';')

    const argv: string[] = [
      '-hide_banner',
      '-y',
      '-i', project.audioPath,
      ...bg.inputArgs,
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      '-map', '0:a',
      '-c:v', 'libx264',
      '-preset', project.output.preset,
      '-crf', String(project.output.crf),
      '-pix_fmt', 'yuv420p',
      '-r', String(project.output.fps),
      '-c:a', 'aac',
      '-b:a', `${project.output.audioBitrate}k`,
      '-movflags', '+faststart',
      '-shortest',
      '-progress', 'pipe:2',
      '-nostats',
      project.output.outputPath
    ]

    return {
      argv,
      cleanup: () => {
        try {
          rmSync(tmp, { recursive: true, force: true })
        } catch {
          /* ignore */
        }
      }
    }
  }

  start(jobId: string, project: ProjectSettings): RenderJob {
    const cancelToken = { cancelled: false }
    const startTime = Date.now()
    const done = (async () => {
      const totalSec = await this.probeDuration(project.audioPath)
      this.emitEvent({ type: 'started', jobId })
      const { argv, cleanup } = await this.buildArgs(project, totalSec)
      this.emitEvent({ type: 'log', jobId, line: `ffmpeg ${argv.join(' ')}` })
      const proc = spawn(this.ffmpeg(), argv, { stdio: ['ignore', 'pipe', 'pipe'] })
      this.active.set(jobId, proc)

      let stderrBuf = ''
      const lastProgress: RenderProgress = {
        jobId,
        progress: 0,
        timeSec: 0,
        totalSec,
        fps: 0,
        speed: 0,
        etaSec: totalSec
      }

      proc.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        stderrBuf += text
        for (const line of text.split(/\r?\n/)) {
          const trimmed = line.trim()
          if (!trimmed) continue
          // Progress lines from `-progress pipe:2` are key=value pairs.
          if (/^(out_time_ms|fps|speed|frame|total_size|bitrate|progress)=/.test(trimmed)) {
            const [k, v] = trimmed.split('=')
            updateProgress(lastProgress, k, v, totalSec)
            this.emitEvent({ type: 'progress', payload: { ...lastProgress } })
          } else {
            this.emitEvent({ type: 'log', jobId, line: trimmed })
          }
        }
      })

      return await new Promise<{ outputPath: string; durationMs: number }>((resolve, reject) => {
        proc.on('error', (err) => {
          cleanup()
          this.active.delete(jobId)
          this.emitEvent({ type: 'error', jobId, message: err.message })
          reject(err)
        })
        proc.on('close', (code) => {
          cleanup()
          this.active.delete(jobId)
          if (cancelToken.cancelled) {
            this.emitEvent({ type: 'cancelled', jobId })
            return reject(new Error('cancelled'))
          }
          if (code !== 0) {
            const msg = `FFmpeg exited with code ${code}: ${tail(stderrBuf, 4000)}`
            this.emitEvent({ type: 'error', jobId, message: msg })
            return reject(new Error(msg))
          }
          const durationMs = Date.now() - startTime
          this.emitEvent({ type: 'done', jobId, outputPath: project.output.outputPath, durationMs })
          resolve({ outputPath: project.output.outputPath, durationMs })
        })
      })
    })()

    return {
      id: jobId,
      cancel: () => {
        cancelToken.cancelled = true
        const p = this.active.get(jobId)
        if (p && !p.killed) p.kill('SIGTERM')
      },
      done
    }
  }

  cancel(jobId: string): void {
    const p = this.active.get(jobId)
    if (p && !p.killed) p.kill('SIGTERM')
  }

  private emitEvent(ev: RenderEvent): void {
    this.emit('event', ev)
  }
}

function updateProgress(p: RenderProgress, key: string, value: string, totalSec: number): void {
  switch (key) {
    case 'out_time_ms': {
      const us = parseInt(value, 10)
      if (Number.isFinite(us)) {
        p.timeSec = us / 1_000_000
        p.progress = Math.max(0, Math.min(1, p.timeSec / Math.max(0.0001, totalSec)))
        p.etaSec = Math.max(0, (totalSec - p.timeSec) / Math.max(0.01, p.speed || 1))
      }
      break
    }
    case 'fps': {
      const fps = parseFloat(value)
      if (Number.isFinite(fps)) p.fps = fps
      break
    }
    case 'speed': {
      const s = parseFloat(value.replace(/x$/, ''))
      if (Number.isFinite(s)) p.speed = s
      break
    }
    case 'progress':
      // 'continue' or 'end'
      break
  }
}

function tail(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(-n)
}

/**
 * Escape a filesystem path for use inside an FFmpeg `ass=` filter.
 * Backslashes and colons (Windows drive letters!) must be escaped.
 */
export function escapeFilterPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
}
