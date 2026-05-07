// Smoke test (CommonJS via tsx)
const { spawn, spawnSync } = require('node:child_process')
const { mkdtempSync, statSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { parseLyrics, buildAss } = require('./src/shared/lyrics')
const { buildVisualizerFilter } = require('./src/main/visualizer')
const { buildBackground } = require('./src/main/background')
const { escapeFilterPath } = require('./src/main/render-service')

async function main() {
  const audioPath = '/tmp/mss_sample.wav'
  spawnSync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=10,asetnsamples=1024',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=10,asetnsamples=1024',
    '-f', 'lavfi', '-i', 'sine=frequency=880:duration=10,asetnsamples=1024',
    '-filter_complex', '[0:a][1:a][2:a]amix=inputs=3:duration=longest:dropout_transition=0,volume=0.5[a]',
    '-map', '[a]', '-ac', '2', '-ar', '44100', audioPath
  ], { stdio: 'ignore' })

  const lines = parseLyrics(`[00:00.50]Selamat datang di Music Spectrum Studio
[00:03.00]Aplikasi pembuat lyric video profesional
[00:06.00]Hasilnya pasti memukau
[00:09.00]Terima kasih sudah mencoba`)
  console.log('[smoke] parsed', lines.length, 'lines')

  const tmp = mkdtempSync(join(tmpdir(), 'mss-smoke-'))
  const assPath = join(tmp, 'lyrics.ass')
  const ass = buildAss({
    width: 1280, height: 720, fontFamily: 'Inter', fontSize: 56,
    color: '#FFFFFF', highlightColor: '#22d3ee', outlineColor: '#000000',
    outlineWidth: 3, position: 0.85, align: 'center', animation: 'fade',
    shadow: true, lines, title: 'Test Song', artist: 'Test Artist'
  })
  writeFileSync(assPath, ass)

  const dur = 10
  const bg = buildBackground(
    { kind: 'gradient', angle: 135, stops: [{ offset: 0, color: '#0f172a' }, { offset: 1, color: '#22d3ee' }]},
    1280, 720, 30, dur
  )
  const vis = buildVisualizerFilter(1280, 360, 30, {
    style: 'cqt', color: '#22d3ee', colorSecondary: '#a855f7',
    position: 0.55, intensity: 0.85, glow: 0.5, thickness: 4, mirror: false
  })
  const overlayY = Math.round(720 * 0.55 - 720 * 0.25)
  const filterComplex = [
    bg.filterChain, vis,
    `[bg][spec]overlay=0:${overlayY}:format=auto[v1]`,
    `[v1]ass='${escapeFilterPath(assPath)}'[vout]`
  ].join(';')

  const outputPath = '/tmp/mss_smoke_output.mp4'
  const argv = [
    '-hide_banner', '-y', '-i', audioPath, ...bg.inputArgs,
    '-filter_complex', filterComplex,
    '-map', '[vout]', '-map', '0:a',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22',
    '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', '-shortest', outputPath
  ]
  console.log('[smoke] ffmpeg', argv.length, 'args')
  const proc = spawn('ffmpeg', argv, { stdio: ['ignore', 'pipe', 'pipe'] })
  let lastErr = ''
  proc.stderr.on('data', (b) => { lastErr += b.toString(); if (lastErr.length > 4096) lastErr = lastErr.slice(-4096) })
  const code = await new Promise((res) => proc.on('close', (c) => res(c ?? 1)))
  if (code !== 0) {
    console.error('[smoke] ffmpeg failed code', code, lastErr.slice(-2000))
    process.exit(1)
  }
  const st = statSync(outputPath)
  console.log('[smoke] OK output:', outputPath, st.size, 'bytes')
}

main().catch((e) => { console.error(e); process.exit(1) })
