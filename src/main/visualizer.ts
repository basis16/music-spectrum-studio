import type { VisualizerSettings, VisualizerStyle } from '../shared/types'

/**
 * Build the FFmpeg audio-to-video filter for a given visualizer style.
 * The filter takes the audio stream and produces a video stream of `width x height`
 * at the requested frame rate. The output stream is labelled `[spec]`.
 *
 * Returned string MUST end with `[spec]`.
 */
export function buildVisualizerFilter(
  width: number,
  height: number,
  fps: number,
  v: VisualizerSettings
): string {
  const w = Math.max(2, Math.round(width))
  const h = Math.max(2, Math.round(height))
  const fpsStr = String(fps)
  const intensity = clamp(v.intensity, 0, 2)
  const glow = clamp(v.glow, 0, 1)

  switch (v.style) {
    case 'cqt':
      return cqtFilter(w, h, fpsStr, v, intensity, glow)
    case 'bars':
      return barsFilter(w, h, fpsStr, v, intensity, glow)
    case 'wave':
      return waveFilter(w, h, fpsStr, v, intensity, glow)
    case 'circular':
      return circularFilter(w, h, fpsStr, v, intensity, glow)
    case 'particles':
      return particlesFilter(w, h, fpsStr, v, intensity, glow)
    default:
      return cqtFilter(w, h, fpsStr, v, intensity, glow)
  }
}

function cqtFilter(
  w: number,
  h: number,
  fps: string,
  v: VisualizerSettings,
  intensity: number,
  glow: number
): string {
  const barG = (1.5 + intensity).toFixed(2)
  const sonoG = (3 + intensity * 2).toFixed(2)
  const barV = (8 + intensity * 6).toFixed(2)
  const sonoV = (10 + intensity * 6).toFixed(2)
  const csheme = colorSchemeFromHex(v.color, v.colorSecondary)
  const blur = glowBlurAmount(glow)
  let out = `[0:a]showcqt=size=${w}x${h}:r=${fps}:bar_g=${barG}:sono_g=${sonoG}:bar_v=${barV}:sono_v=${sonoV}:cscheme=${csheme}:fps=${fps}:count=4:axis=0`
  if (blur > 0) {
    out += `,gblur=sigma=${blur.toFixed(2)}`
  }
  out += `,colorkey=color=0x000000:similarity=0.05:blend=0.05,format=yuva420p`
  return out + `[spec]`
}

function barsFilter(
  w: number,
  h: number,
  fps: string,
  v: VisualizerSettings,
  intensity: number,
  glow: number
): string {
  const colors = `${v.color}|${v.colorSecondary}`
  const mode = v.mirror ? 'separate' : 'combined'
  const winFunc = 'hann'
  const slide = 'replace'
  const ascale = 'log'
  const fscale = 'log'
  const drange = `${(80 + intensity * 40).toFixed(0)}`
  const tlength = '0.17'
  const blur = glowBlurAmount(glow)
  let out = `[0:a]showfreqs=s=${w}x${h}:rate=${fps}:mode=bar:fscale=${fscale}:ascale=${ascale}:win_size=2048:win_func=${winFunc}:colors=${colors}`
  if (blur > 0) out += `,gblur=sigma=${blur.toFixed(2)}`
  out += `,colorkey=color=0x000000:similarity=0.05:blend=0.05,format=yuva420p`
  void mode; void slide; void drange; void tlength
  return out + `[spec]`
}

function waveFilter(
  w: number,
  h: number,
  fps: string,
  v: VisualizerSettings,
  intensity: number,
  glow: number
): string {
  const mode = v.mirror ? 'cline' : 'line'
  const colors = `${v.color}|${v.colorSecondary}`
  const blur = glowBlurAmount(glow)
  let out = `[0:a]showwaves=s=${w}x${h}:rate=${fps}:mode=${mode}:colors=${colors}:scale=${intensity > 0.7 ? 'cbrt' : 'lin'}:n=${Math.max(1, v.thickness)}`
  if (blur > 0) out += `,gblur=sigma=${blur.toFixed(2)}`
  out += `,colorkey=color=0x000000:similarity=0.05:blend=0.05,format=yuva420p`
  return out + `[spec]`
}

function circularFilter(
  w: number,
  h: number,
  fps: string,
  v: VisualizerSettings,
  intensity: number,
  glow: number
): string {
  // Use avectorscope in polar mode for radial visualizer
  const blur = glowBlurAmount(glow) + 0.5
  const colors = v.color.replace('#', '0x')
  const colors2 = v.colorSecondary.replace('#', '0x')
  let out = `[0:a]avectorscope=s=${w}x${h}:r=${fps}:m=polar:rc=${parseInt(colors.slice(2, 4), 16)}:gc=${parseInt(colors.slice(4, 6), 16)}:bc=${parseInt(colors.slice(6, 8), 16)}:rf=${parseInt(colors2.slice(2, 4), 16)}:gf=${parseInt(colors2.slice(4, 6), 16)}:bf=${parseInt(colors2.slice(6, 8), 16)}:zoom=${(1 + intensity * 0.6).toFixed(2)}:draw=line`
  out += `,gblur=sigma=${blur.toFixed(2)},colorkey=color=0x000000:similarity=0.06:blend=0.05,format=yuva420p`
  return out + `[spec]`
}

function particlesFilter(
  w: number,
  h: number,
  fps: string,
  v: VisualizerSettings,
  intensity: number,
  glow: number
): string {
  // Use avectorscope in lissajous_xy with high zoom + heavy blur for particle look
  const blur = 1.0 + glow * 1.5
  const colors = v.color.replace('#', '0x')
  let out = `[0:a]avectorscope=s=${w}x${h}:r=${fps}:m=lissajous_xy:rc=${parseInt(colors.slice(2, 4), 16)}:gc=${parseInt(colors.slice(4, 6), 16)}:bc=${parseInt(colors.slice(6, 8), 16)}:zoom=${(1.5 + intensity * 0.8).toFixed(2)}:draw=dot:scale=cbrt`
  out += `,gblur=sigma=${blur.toFixed(2)},colorkey=color=0x000000:similarity=0.05:blend=0.05,format=yuva420p`
  return out + `[spec]`
}

/** Generate a 7-stop linear color scheme for showcqt cscheme parameter. */
function colorSchemeFromHex(primary: string, secondary: string): string {
  const p = hexToRgbF(primary)
  const s = hexToRgbF(secondary)
  // showcqt cscheme is "r1|g1|b1|r2|g2|b2"
  return [p.r, p.g, p.b, s.r, s.g, s.b].map((x) => x.toFixed(2)).join('|')
}

function hexToRgbF(hex: string): { r: number; g: number; b: number } {
  const c = hex.replace('#', '')
  if (c.length !== 6) return { r: 0.5, g: 0.5, b: 1 }
  return {
    r: parseInt(c.slice(0, 2), 16) / 255,
    g: parseInt(c.slice(2, 4), 16) / 255,
    b: parseInt(c.slice(4, 6), 16) / 255
  }
}

function glowBlurAmount(glow: number): number {
  // map 0..1 -> 0..2.5 sigma
  return Math.max(0, glow) * 2.5
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

export const STYLE_LABELS: Record<VisualizerStyle, string> = {
  bars: 'Bars',
  cqt: 'CQT (paling musikal)',
  wave: 'Wave',
  circular: 'Circular Radial',
  particles: 'Particles'
}
