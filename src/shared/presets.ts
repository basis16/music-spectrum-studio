import type { PresetInfo } from './types'

export const PRESETS: PresetInfo[] = [
  {
    id: 'neon-cqt',
    name: 'Neon CQT',
    description: 'Spektrum CQT bertema neon dengan latar gelap. Cocok untuk lagu elektronik / synthwave.',
    visualizer: {
      style: 'cqt',
      color: '#22d3ee',
      colorSecondary: '#a855f7',
      position: 0.6,
      intensity: 0.85,
      glow: 0.6,
      thickness: 4,
      mirror: false
    },
    background: { kind: 'solid', color: '#07070b' },
    lyrics: {
      fontFamily: 'Inter',
      fontSize: 64,
      color: '#FFFFFF',
      highlightColor: '#22d3ee',
      outlineColor: '#000000',
      outlineWidth: 3,
      position: 0.85,
      animation: 'fade',
      linesVisible: 1,
      align: 'center',
      shadow: true
    }
  },
  {
    id: 'classic-bars',
    name: 'Classic Bars',
    description: 'EQ bars klasik, bersih dan profesional. Cocok untuk semua genre.',
    visualizer: {
      style: 'bars',
      color: '#ffffff',
      colorSecondary: '#ff6b6b',
      position: 0.7,
      intensity: 0.9,
      glow: 0.2,
      thickness: 6,
      mirror: true
    },
    background: { kind: 'gradient', angle: 135, stops: [
      { offset: 0, color: '#0f172a' },
      { offset: 1, color: '#1e293b' }
    ]},
    lyrics: {
      fontFamily: 'Inter',
      fontSize: 60,
      color: '#FFFFFF',
      highlightColor: '#ff6b6b',
      outlineColor: '#000000',
      outlineWidth: 2,
      position: 0.88,
      animation: 'pop',
      linesVisible: 1,
      align: 'center',
      shadow: true
    }
  },
  {
    id: 'radial-pulse',
    name: 'Radial Pulse',
    description: 'Visualizer melingkar dengan gambar cover di tengah. Ideal untuk single / lyric video pop.',
    visualizer: {
      style: 'circular',
      color: '#fbbf24',
      colorSecondary: '#fb7185',
      position: 0.5,
      intensity: 0.8,
      glow: 0.5,
      thickness: 4,
      mirror: false
    },
    background: { kind: 'solid', color: '#0a0118' },
    lyrics: {
      fontFamily: 'Space Grotesk',
      fontSize: 56,
      color: '#FFFFFF',
      highlightColor: '#fbbf24',
      outlineColor: '#000000',
      outlineWidth: 2,
      position: 0.9,
      animation: 'fade',
      linesVisible: 1,
      align: 'center',
      shadow: true
    }
  },
  {
    id: 'minimal-wave',
    name: 'Minimal Wave',
    description: 'Garis gelombang halus, sangat minimalis. Cocok untuk lagu akustik / ballad.',
    visualizer: {
      style: 'wave',
      color: '#f8fafc',
      colorSecondary: '#94a3b8',
      position: 0.55,
      intensity: 0.7,
      glow: 0.15,
      thickness: 3,
      mirror: false
    },
    background: { kind: 'solid', color: '#0c0c0c' },
    lyrics: {
      fontFamily: 'Inter',
      fontSize: 54,
      color: '#FFFFFF',
      highlightColor: '#f8fafc',
      outlineColor: '#000000',
      outlineWidth: 1,
      position: 0.85,
      animation: 'fade',
      linesVisible: 1,
      align: 'center',
      shadow: false
    }
  },
  {
    id: 'particle-fest',
    name: 'Particle Fest',
    description: 'Vektorgram audio (avectorscope) untuk vibe psychedelic / festival.',
    visualizer: {
      style: 'particles',
      color: '#a78bfa',
      colorSecondary: '#22d3ee',
      position: 0.5,
      intensity: 1.0,
      glow: 0.7,
      thickness: 3,
      mirror: false
    },
    background: { kind: 'gradient', angle: 180, stops: [
      { offset: 0, color: '#1e1b4b' },
      { offset: 1, color: '#000000' }
    ]},
    lyrics: {
      fontFamily: 'Space Grotesk',
      fontSize: 60,
      color: '#FFFFFF',
      highlightColor: '#a78bfa',
      outlineColor: '#000000',
      outlineWidth: 3,
      position: 0.9,
      animation: 'karaoke',
      linesVisible: 1,
      align: 'center',
      shadow: true
    }
  }
]

export function getPreset(id: string): PresetInfo | undefined {
  return PRESETS.find((p) => p.id === id)
}
