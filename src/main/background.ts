import type { Background } from '../shared/types'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface BackgroundInputs {
  /** ffmpeg `-i` arguments (one entry per file/lavfi input) */
  inputArgs: string[]
  /** filter chain that produces `[bg]` of size widthxheight at fps */
  filterChain: string
  /** index in inputArgs that corresponds to this input (1 means second `-i`, etc.) */
  inputIndex: number
}

/**
 * Build FFmpeg inputs and a filter chain that yields a background video stream
 * of `widthxheight` at `fps` for the requested duration. Output label = `[bg]`.
 *
 * The audio file is always input #0; this background's input begins at #1.
 */
export function buildBackground(
  bg: Background,
  width: number,
  height: number,
  fps: number,
  durationSec: number
): BackgroundInputs {
  switch (bg.kind) {
    case 'solid': {
      const color = bg.color.startsWith('#') ? bg.color : `#${bg.color}`
      return {
        inputArgs: ['-f', 'lavfi', '-i', `color=c=${color}:s=${width}x${height}:r=${fps}:d=${durationSec.toFixed(3)}`],
        filterChain: `[1:v]format=yuv420p[bg]`,
        inputIndex: 1
      }
    }
    case 'gradient': {
      const path = writeGradientPng(bg.stops, bg.angle, width, height)
      return {
        inputArgs: ['-loop', '1', '-t', durationSec.toFixed(3), '-i', path],
        filterChain: `[1:v]scale=${width}:${height},fps=${fps},format=yuv420p[bg]`,
        inputIndex: 1
      }
    }
    case 'image': {
      const blur = bg.blur > 0 ? `,gblur=sigma=${(bg.blur * 5).toFixed(2)}` : ''
      const dim = bg.dim > 0 ? `,colorchannelmixer=rr=${(1 - bg.dim).toFixed(3)}:gg=${(1 - bg.dim).toFixed(3)}:bb=${(1 - bg.dim).toFixed(3)}` : ''
      return {
        inputArgs: ['-loop', '1', '-t', durationSec.toFixed(3), '-i', bg.path],
        filterChain: `[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps}${blur}${dim},format=yuv420p[bg]`,
        inputIndex: 1
      }
    }
    case 'video': {
      const dim = bg.dim > 0 ? `,colorchannelmixer=rr=${(1 - bg.dim).toFixed(3)}:gg=${(1 - bg.dim).toFixed(3)}:bb=${(1 - bg.dim).toFixed(3)}` : ''
      return {
        inputArgs: ['-stream_loop', '-1', '-i', bg.path],
        filterChain: `[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps}${dim},trim=duration=${durationSec.toFixed(3)},setpts=PTS-STARTPTS,format=yuv420p[bg]`,
        inputIndex: 1
      }
    }
  }
}

/**
 * Render a 2-stop linear gradient PNG using a tiny in-memory generator.
 * Returns the file path.
 */
function writeGradientPng(
  stops: { offset: number; color: string }[],
  angleDeg: number,
  _width: number,
  _height: number
): string {
  // Generate PPM then convert via FFmpeg would require a child process; instead
  // we encode a minimal PNG using the built-in zlib + simple raw RGBA pixels.
  // For simplicity & quality at any size, we draw a small 256x256 PNG and let
  // FFmpeg scale it up.
  const w = 256
  const h = 256
  const rgba = new Uint8Array(w * h * 4)
  const sortedStops = [...stops].sort((a, b) => a.offset - b.offset)
  if (sortedStops.length === 0) {
    sortedStops.push({ offset: 0, color: '#000000' }, { offset: 1, color: '#FFFFFF' })
  } else if (sortedStops.length === 1) {
    sortedStops.push({ offset: 1, color: sortedStops[0].color })
  }
  const angleRad = (angleDeg * Math.PI) / 180
  const dx = Math.cos(angleRad)
  const dy = Math.sin(angleRad)
  // Project each pixel onto the gradient axis to get t in [0,1]
  const minProj = Math.min(0, dx * (w - 1)) + Math.min(0, dy * (h - 1))
  const maxProj = Math.max(0, dx * (w - 1)) + Math.max(0, dy * (h - 1))
  const range = Math.max(1e-6, maxProj - minProj)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const proj = dx * x + dy * y
      const t = (proj - minProj) / range
      const c = sampleStops(sortedStops, t)
      const off = (y * w + x) * 4
      rgba[off] = c.r
      rgba[off + 1] = c.g
      rgba[off + 2] = c.b
      rgba[off + 3] = 255
    }
  }
  const png = encodePng(rgba, w, h)
  const dir = mkdtempSync(join(tmpdir(), 'mss-grad-'))
  const path = join(dir, 'gradient.png')
  writeFileSync(path, png)
  return path
}

function sampleStops(stops: { offset: number; color: string }[], t: number): { r: number; g: number; b: number } {
  if (t <= stops[0].offset) return hexToRgb(stops[0].color)
  if (t >= stops[stops.length - 1].offset) return hexToRgb(stops[stops.length - 1].color)
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (t >= a.offset && t <= b.offset) {
      const f = (t - a.offset) / Math.max(1e-6, b.offset - a.offset)
      const ca = hexToRgb(a.color)
      const cb = hexToRgb(b.color)
      return {
        r: Math.round(ca.r + (cb.r - ca.r) * f),
        g: Math.round(ca.g + (cb.g - ca.g) * f),
        b: Math.round(ca.b + (cb.b - ca.b) * f)
      }
    }
  }
  return hexToRgb(stops[stops.length - 1].color)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const c = hex.replace('#', '')
  if (c.length !== 6) return { r: 0, g: 0, b: 0 }
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16)
  }
}

/** Encode raw RGBA pixels into a minimal PNG buffer. */
function encodePng(rgba: Uint8Array, width: number, height: number): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const zlib = require('node:zlib') as typeof import('node:zlib')
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // Add filter byte (0) per scanline
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.subarray(y * stride, (y + 1) * stride).forEach((b, i) => {
      raw[y * (stride + 1) + 1 + i] = b
    })
  }
  const idatData = zlib.deflateSync(raw)
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idatData), chunk('IEND', Buffer.alloc(0))])
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
