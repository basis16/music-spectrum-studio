import type { LyricLine } from './types'

const LRC_TIME_RE = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g
const SRT_TIME_RE = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/

/**
 * Parse a LRC file body into lyric lines.
 * Supports multiple timestamps per line (e.g. "[00:01.23][00:05.67]hello").
 */
export function parseLrc(text: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (/^\[(ar|ti|al|by|offset|length|re|ve):/i.test(line)) continue

    const stamps: number[] = []
    let match: RegExpExecArray | null
    LRC_TIME_RE.lastIndex = 0
    while ((match = LRC_TIME_RE.exec(line)) !== null) {
      const min = parseInt(match[1], 10)
      const sec = parseInt(match[2], 10)
      const fracStr = match[3] ?? '0'
      // Pad/truncate fraction to milliseconds
      const ms = parseInt((fracStr + '000').slice(0, 3), 10)
      stamps.push(min * 60 + sec + ms / 1000)
    }
    if (stamps.length === 0) continue
    const text = line.replace(LRC_TIME_RE, '').trim()
    if (!text) continue
    for (const t of stamps) {
      lines.push({ start: t, text })
    }
  }
  lines.sort((a, b) => a.start - b.start)
  // Infer end times
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].end != null) continue
    const next = lines[i + 1]
    lines[i].end = next ? next.start : lines[i].start + 4
  }
  return lines
}

/**
 * Parse SRT subtitle file into lyric lines.
 */
export function parseSrt(text: string): LyricLine[] {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/)
  const lines: LyricLine[] = []
  for (const block of blocks) {
    const m = block.match(SRT_TIME_RE)
    if (!m) continue
    const start =
      parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) + parseInt(m[4], 10) / 1000
    const end =
      parseInt(m[5], 10) * 3600 + parseInt(m[6], 10) * 60 + parseInt(m[7], 10) + parseInt(m[8], 10) / 1000
    const idx = block.search(SRT_TIME_RE)
    const after = block.slice(idx).split('\n').slice(1).join('\n').trim()
    if (!after) continue
    lines.push({ start, end, text: after })
  }
  return lines
}

/**
 * Auto-detect LRC vs SRT and parse.
 */
export function parseLyrics(text: string): LyricLine[] {
  if (SRT_TIME_RE.test(text)) return parseSrt(text)
  return parseLrc(text)
}

/**
 * Format seconds into ASS time (H:MM:SS.cs).
 */
export function formatAssTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const cs = Math.floor((sec - Math.floor(sec)) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function hexToAssColor(hex: string, alpha = 0): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return '&H00FFFFFF'
  const r = clean.slice(0, 2)
  const g = clean.slice(2, 4)
  const b = clean.slice(4, 6)
  const a = alpha.toString(16).padStart(2, '0').toUpperCase()
  return `&H${a}${b.toUpperCase()}${g.toUpperCase()}${r.toUpperCase()}`
}

/** Escape characters that have special meaning in ASS dialogue text. */
function escapeAssText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\n/g, '\\N')
}

export interface BuildAssOptions {
  width: number
  height: number
  fontFamily: string
  fontSize: number
  color: string
  highlightColor: string
  outlineColor: string
  outlineWidth: number
  /** 0..1 (0 top, 1 bottom) */
  position: number
  align: 'left' | 'center' | 'right'
  animation: 'fade' | 'pop' | 'slide' | 'karaoke' | 'none'
  shadow: boolean
  lines: LyricLine[]
  title?: string
  artist?: string
}

/**
 * Build an ASS subtitle file string from lyric lines and styling options.
 * The output is ready to be referenced via the `ass=` filter in FFmpeg.
 */
export function buildAss(opts: BuildAssOptions): string {
  const alignMap = { left: 1, center: 2, right: 3 }
  const align = alignMap[opts.align]
  const marginV = Math.max(20, Math.round((1 - opts.position) * opts.height))
  const shadow = opts.shadow ? 2 : 0
  const primary = hexToAssColor(opts.color)
  const secondary = hexToAssColor(opts.highlightColor)
  const outline = hexToAssColor(opts.outlineColor)
  const back = '&H80000000'

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${opts.width}
PlayResY: ${opts.height}
ScaledBorderAndShadow: yes
WrapStyle: 0
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Lyric,${opts.fontFamily},${opts.fontSize},${primary},${secondary},${outline},${back},1,0,0,0,100,100,0,0,1,${opts.outlineWidth},${shadow},${align},80,80,${marginV},1
Style: Title,${opts.fontFamily},${Math.round(opts.fontSize * 0.7)},${primary},${secondary},${outline},${back},1,0,0,0,100,100,0,0,1,${opts.outlineWidth},${shadow},8,80,80,60,1
Style: Artist,${opts.fontFamily},${Math.round(opts.fontSize * 0.45)},${primary},${secondary},${outline},${back},0,1,0,0,100,100,0,0,1,${Math.max(1, opts.outlineWidth - 1)},${shadow},8,80,80,${60 + Math.round(opts.fontSize * 0.85)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

  const events: string[] = []
  if (opts.title) {
    events.push(
      `Dialogue: 0,0:00:00.00,9:59:59.00,Title,,0,0,0,,${escapeAssText(opts.title)}`
    )
  }
  if (opts.artist) {
    events.push(
      `Dialogue: 0,0:00:00.00,9:59:59.00,Artist,,0,0,0,,${escapeAssText(opts.artist)}`
    )
  }

  for (const line of opts.lines) {
    const start = formatAssTime(line.start)
    const end = formatAssTime(line.end ?? line.start + 4)
    let text = escapeAssText(line.text)
    let prefix = ''
    switch (opts.animation) {
      case 'fade':
        prefix = '{\\fad(250,250)}'
        break
      case 'pop':
        prefix = '{\\fad(120,120)\\t(0,180,\\fscx110\\fscy110)\\t(180,360,\\fscx100\\fscy100)}'
        break
      case 'slide':
        prefix = '{\\fad(300,300)\\move(0,30,0,0,0,300)}'
        break
      case 'karaoke': {
        const durationCs = Math.max(1, Math.round(((line.end ?? line.start + 4) - line.start) * 100))
        const k = Math.max(1, Math.floor(durationCs / Math.max(1, line.text.length)))
        text = line.text
          .split(/(\s+)/)
          .map((tok) => (tok.trim() ? `{\\kf${k * tok.length}}${escapeAssText(tok)}` : escapeAssText(tok)))
          .join('')
        prefix = '{\\fad(150,150)}'
        break
      }
      case 'none':
      default:
        prefix = ''
    }
    events.push(`Dialogue: 0,${start},${end},Lyric,,0,0,0,,${prefix}${text}`)
  }
  return header + events.join('\n') + '\n'
}
