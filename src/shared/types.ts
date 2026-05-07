/**
 * Shared types between main, preload, and renderer.
 */

export type VisualizerStyle = 'bars' | 'circular' | 'wave' | 'cqt' | 'particles'

export interface ColorStop {
  /** 0..1 */
  offset: number
  /** #RRGGBB */
  color: string
}

export type Background =
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; stops: ColorStop[]; angle: number }
  | { kind: 'image'; path: string; blur: number; dim: number }
  | { kind: 'video'; path: string; dim: number }

export interface VisualizerSettings {
  style: VisualizerStyle
  /** primary color #RRGGBB */
  color: string
  /** secondary color (used by some styles) */
  colorSecondary: string
  /** vertical position of bar/wave anchor in 0..1 */
  position: number
  /** 0..1 intensity multiplier */
  intensity: number
  /** Optional glow / bloom 0..1 */
  glow: number
  /** Bar width / line thickness 1..16 */
  thickness: number
  /** Mirror left/right (relevant for bars/wave) */
  mirror: boolean
}

export interface LyricLine {
  /** start time in seconds */
  start: number
  /** end time in seconds (optional - inferred from next line if missing) */
  end?: number
  text: string
}

export interface LyricsSettings {
  fontFamily: string
  fontSize: number
  /** #RRGGBB */
  color: string
  /** highlight (sung) color */
  highlightColor: string
  /** outline color */
  outlineColor: string
  outlineWidth: number
  /** vertical position 0..1 (0 top, 1 bottom) */
  position: number
  /** 'fade' | 'pop' | 'slide' | 'karaoke' */
  animation: 'fade' | 'pop' | 'slide' | 'karaoke' | 'none'
  /** Show 1 line at a time, or N lines (current + lookahead) */
  linesVisible: number
  /** alignment */
  align: 'left' | 'center' | 'right'
  /** add subtle shadow */
  shadow: boolean
}

export interface ProjectSettings {
  audioPath: string
  background: Background
  visualizer: VisualizerSettings
  lyrics: LyricsSettings
  lines: LyricLine[]
  /** Title shown at top (optional) */
  title?: string
  /** Artist shown below title (optional) */
  artist?: string
  /** Output settings */
  output: OutputSettings
}

export interface OutputSettings {
  width: number
  height: number
  fps: 24 | 30 | 60
  /** CRF 0..51 (lower = better; 18 = visually lossless) */
  crf: number
  /** Audio bitrate kbps */
  audioBitrate: number
  /** Output file path */
  outputPath: string
  /** Encoder preset */
  preset: 'ultrafast' | 'fast' | 'medium' | 'slow' | 'veryslow'
}

export interface AudioInfo {
  path: string
  durationSec: number
  sampleRate: number
  channels: number
  format: string
  bitrate?: number
  title?: string
  artist?: string
  album?: string
  /** base64 data URL of cover art if present */
  coverDataUrl?: string
}

export interface RenderProgress {
  jobId: string
  /** 0..1 */
  progress: number
  /** processed seconds of audio */
  timeSec: number
  /** total duration */
  totalSec: number
  /** encoder fps */
  fps: number
  /** estimated speed */
  speed: number
  /** estimated remaining seconds */
  etaSec: number
}

export type RenderEvent =
  | { type: 'started'; jobId: string }
  | { type: 'progress'; payload: RenderProgress }
  | { type: 'log'; jobId: string; line: string }
  | { type: 'done'; jobId: string; outputPath: string; durationMs: number }
  | { type: 'error'; jobId: string; message: string }
  | { type: 'cancelled'; jobId: string }

export interface RenderRequest {
  jobId: string
  project: ProjectSettings
}

export interface TranscribeOptions {
  /**
   * Language hint for Whisper. Use 'auto' to let the model detect.
   * Common values: 'auto', 'id' (Indonesian), 'en', 'ja', 'es', 'fr', etc.
   */
  language: 'auto' | string
  /**
   * Hugging Face model id to load via @xenova/transformers.
   * Default is 'Xenova/whisper-base' (~75 MB, multilingual, balance of speed and accuracy).
   * Use 'Xenova/whisper-tiny' for faster but less accurate, or 'Xenova/whisper-small' for higher quality.
   */
  modelId: string
}

export type TranscribeStage = 'loading-model' | 'decoding-audio' | 'transcribing' | 'finalizing'

export interface TranscribeProgress {
  jobId: string
  stage?: TranscribeStage
  /** 0..1 overall progress (best-effort) */
  progress?: number
  /** Processed seconds of audio (during transcribing stage) */
  timeSec?: number
  /** Total audio duration */
  totalSec?: number
  /** Free-form human-readable status message */
  message?: string
  partialText?: string
  chunkIndex?: number
  totalChunks?: number
}

export type TranscribeEvent =
  | { type: 'transcribe-started'; jobId: string }
  | { type: 'transcribe-stage'; jobId: string; stage: TranscribeStage; message?: string }
  | ({ type: 'transcribe-progress' } & TranscribeProgress)
  | { type: 'transcribe-done'; jobId: string; lines: LyricLine[] }
  | { type: 'transcribe-cancelled'; jobId: string }
  | { type: 'transcribe-error'; jobId: string; message: string }

export interface PresetInfo {
  id: string
  name: string
  description: string
  visualizer: VisualizerSettings
  background: Background
  lyrics: Partial<LyricsSettings>
}
