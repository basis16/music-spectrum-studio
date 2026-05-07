import { PRESETS } from '../../../shared/presets'
import type { ProjectSettings } from '../../../shared/types'

export function makeDefaultProject(): ProjectSettings {
  const preset = PRESETS[0]
  return {
    audioPath: '',
    background: preset.background,
    visualizer: preset.visualizer,
    lyrics: {
      fontFamily: preset.lyrics.fontFamily ?? 'Inter',
      fontSize: preset.lyrics.fontSize ?? 60,
      color: preset.lyrics.color ?? '#FFFFFF',
      highlightColor: preset.lyrics.highlightColor ?? '#22d3ee',
      outlineColor: preset.lyrics.outlineColor ?? '#000000',
      outlineWidth: preset.lyrics.outlineWidth ?? 3,
      position: preset.lyrics.position ?? 0.85,
      animation: preset.lyrics.animation ?? 'fade',
      linesVisible: preset.lyrics.linesVisible ?? 1,
      align: preset.lyrics.align ?? 'center',
      shadow: preset.lyrics.shadow ?? true
    },
    lines: [],
    title: '',
    artist: '',
    output: {
      width: 1920,
      height: 1080,
      fps: 30,
      crf: 18,
      audioBitrate: 320,
      outputPath: '',
      preset: 'medium'
    }
  }
}
