import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { mkdirSync } from 'node:fs'
import ffmpegPath from 'ffmpeg-static'

import type { LyricLine, TranscribeEvent, TranscribeOptions } from '../shared/types'

/**
 * Whisper-based automatic speech recognition for lyric generation.
 *
 * Runs locally via @xenova/transformers (ONNX). The model is downloaded
 * once on first use and cached in Electron's userData directory.
 */
export class TranscribeService extends EventEmitter {
  private cacheDir: string
  private active = new Map<string, { cancelled: boolean }>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pipelineCache: { id: string; pipe: any } | null = null

  constructor(cacheDir: string) {
    super()
    this.cacheDir = cacheDir
    mkdirSync(this.cacheDir, { recursive: true })
  }

  cancel(jobId: string): void {
    const ctl = this.active.get(jobId)
    if (ctl) ctl.cancelled = true
  }

  start(jobId: string, audioPath: string, options: TranscribeOptions): { done: Promise<LyricLine[]> } {
    const ctl = { cancelled: false }
    this.active.set(jobId, ctl)
    const done = this.run(jobId, audioPath, options, ctl).finally(() => this.active.delete(jobId))
    return { done }
  }

  private emitEvent(ev: TranscribeEvent): void {
    this.emit('event', ev)
  }

  private async run(
    jobId: string,
    audioPath: string,
    options: TranscribeOptions,
    ctl: { cancelled: boolean }
  ): Promise<LyricLine[]> {
    try {
      this.emitEvent({ type: 'transcribe-started', jobId })

      this.emitEvent({ type: 'transcribe-stage', jobId, stage: 'loading-model', message: 'Memuat model Whisper…' })
      const pipe = await this.getPipeline(options.modelId, jobId, ctl)
      if (ctl.cancelled) {
        this.emitEvent({ type: 'transcribe-cancelled', jobId })
        throw new CancelledError()
      }

      this.emitEvent({ type: 'transcribe-stage', jobId, stage: 'decoding-audio', message: 'Memecah audio…' })
      const samples = await this.decodeToFloat32(audioPath, ctl)
      if (ctl.cancelled) {
        this.emitEvent({ type: 'transcribe-cancelled', jobId })
        throw new CancelledError()
      }

      const totalSec = samples.length / 16000
      this.emitEvent({
        type: 'transcribe-stage',
        jobId,
        stage: 'transcribing',
        message: `Mentranskripsi ${totalSec.toFixed(1)} detik audio…`
      })

      const chunkSec = 30
      const strideSec = 5
      const result = await pipe(samples, {
        chunk_length_s: chunkSec,
        stride_length_s: strideSec,
        return_timestamps: true,
        language: options.language && options.language !== 'auto' ? options.language : undefined,
        task: 'transcribe',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback_function: () => {
          if (ctl.cancelled) return
          // Emit a coarse progress heartbeat each callback tick
          this.emitEvent({ type: 'transcribe-progress', jobId })
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chunk_callback: (chunk: any) => {
          if (ctl.cancelled) return
          // chunk: { tokens, finalised, time_begin, time_end, ... }
          const start = typeof chunk?.time_begin === 'number' ? chunk.time_begin : 0
          const end = typeof chunk?.time_end === 'number' ? chunk.time_end : start + chunkSec
          const clamped = Math.min(end, totalSec)
          this.emitEvent({
            type: 'transcribe-progress',
            jobId,
            timeSec: clamped,
            totalSec,
            progress: totalSec > 0 ? Math.min(0.99, clamped / totalSec) : 0
          })
        }
      })

      if (ctl.cancelled) {
        this.emitEvent({ type: 'transcribe-cancelled', jobId })
        throw new CancelledError()
      }

      const lines = chunksToLines(result, totalSec)
      this.emitEvent({
        type: 'transcribe-progress',
        jobId,
        timeSec: totalSec,
        totalSec,
        progress: 1
      })
      this.emitEvent({ type: 'transcribe-done', jobId, lines })
      return lines
    } catch (err) {
      if (err instanceof CancelledError) {
        return []
      }
      const message = err instanceof Error ? err.message : String(err)
      this.emitEvent({ type: 'transcribe-error', jobId, message })
      throw err
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getPipeline(modelId: string, jobId: string, ctl: { cancelled: boolean }): Promise<any> {
    if (this.pipelineCache && this.pipelineCache.id === modelId) {
      return this.pipelineCache.pipe
    }
    // Dynamic import — @xenova/transformers is ESM-only and the main process
    // is bundled as CJS, so we cannot use a top-level static import.
    const tf = await import('@xenova/transformers')
    tf.env.cacheDir = this.cacheDir
    tf.env.allowRemoteModels = true
    tf.env.allowLocalModels = true
    if (tf.env.backends?.onnx?.wasm) {
      // not used in node, but defensive
      tf.env.backends.onnx.wasm.numThreads = 1
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const progress = (data: any): void => {
      if (ctl.cancelled) return
      if (data && (data.status === 'progress' || data.status === 'download')) {
        const pct = typeof data.progress === 'number' ? data.progress : 0
        this.emitEvent({
          type: 'transcribe-progress',
          jobId,
          progress: Math.min(0.95, pct / 100),
          message: data.file ? `${data.status === 'download' ? 'Mengunduh' : 'Memuat'} ${data.file}` : undefined
        })
      } else if (data && data.status === 'done' && data.file) {
        this.emitEvent({
          type: 'transcribe-progress',
          jobId,
          message: `Selesai memuat ${data.file}`
        })
      }
    }
    const pipe = await tf.pipeline('automatic-speech-recognition', modelId, { progress_callback: progress })
    this.pipelineCache = { id: modelId, pipe }
    return pipe
  }

  /**
   * Decode any audio file via ffmpeg into mono 16 kHz float32 PCM samples.
   * Whisper's preprocessor expects this exact shape.
   */
  private decodeToFloat32(audioPath: string, ctl: { cancelled: boolean }): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
      const bin = (ffmpegPath as unknown as string) ?? 'ffmpeg'
      const args = [
        '-hide_banner',
        '-loglevel', 'error',
        '-i', audioPath,
        '-vn',
        '-ac', '1',
        '-ar', '16000',
        '-f', 'f32le',
        '-acodec', 'pcm_f32le',
        'pipe:1'
      ]
      const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      const chunks: Buffer[] = []
      let err = ''
      proc.stdout.on('data', (d: Buffer) => chunks.push(d))
      proc.stderr.on('data', (d: Buffer) => (err += d.toString()))
      proc.on('error', reject)
      proc.on('close', (code) => {
        if (ctl.cancelled) return reject(new CancelledError())
        if (code !== 0) return reject(new Error(`ffmpeg decode failed (${code}): ${err}`))
        const buf = Buffer.concat(chunks)
        const samples = new Float32Array(buf.byteLength / 4)
        // Buffer.concat result has its own backing — copy bytes into Float32Array
        const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
        for (let i = 0; i < samples.length; i++) {
          samples[i] = view.getFloat32(i * 4, true)
        }
        resolve(samples)
      })

      const watch = setInterval(() => {
        if (ctl.cancelled) {
          clearInterval(watch)
          proc.kill('SIGKILL')
        }
      }, 250)
      proc.on('close', () => clearInterval(watch))
    })
  }
}

class CancelledError extends Error {
  constructor() {
    super('Cancelled')
    this.name = 'CancelledError'
  }
}

/**
 * Convert a Whisper pipeline result into clean lyric lines.
 * Splits on sentence boundaries and trims/cleans whitespace.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chunksToLines(result: any, totalSec: number): LyricLine[] {
  const raw: { start: number; end: number; text: string }[] = []

  // result can be { text, chunks: [{ timestamp: [start, end], text }] } from xenova
  // or array of those if multiple files.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chunks: any[] = Array.isArray(result?.chunks) ? result.chunks : []
  for (const c of chunks) {
    const ts = Array.isArray(c?.timestamp) ? c.timestamp : null
    if (!ts) continue
    const start = typeof ts[0] === 'number' ? ts[0] : 0
    const endRaw = typeof ts[1] === 'number' ? ts[1] : null
    const end = endRaw ?? Math.min(totalSec, start + 4)
    const text = String(c?.text ?? '').trim()
    if (!text) continue
    raw.push({ start, end, text })
  }

  // Fallback: if no chunks/timestamps, dump whole text as one line at t=0
  if (raw.length === 0 && typeof result?.text === 'string' && result.text.trim()) {
    raw.push({ start: 0, end: totalSec, text: result.text.trim() })
  }

  // Merge fragments that are very short (< 0.4s with < 3 chars) into the next chunk
  const merged: { start: number; end: number; text: string }[] = []
  for (const r of raw) {
    const last = merged[merged.length - 1]
    if (last && r.start - last.end < 0.05 && (last.text.length < 3 || r.text.length < 3)) {
      last.text = `${last.text} ${r.text}`.trim()
      last.end = r.end
    } else {
      merged.push({ ...r })
    }
  }

  return merged.map((m) => ({ start: round2(m.start), end: round2(m.end), text: cleanText(m.text) }))
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}
