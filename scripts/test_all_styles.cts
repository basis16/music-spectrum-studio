const { spawn, spawnSync } = require('node:child_process')
const { mkdtempSync, statSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { parseLyrics, buildAss } = require('../src/shared/lyrics')
const { buildVisualizerFilter } = require('../src/main/visualizer')
const { buildBackground } = require('../src/main/background')
const { escapeFilterPath } = require('../src/main/render-service')

async function main() {
  const audioPath = '/tmp/mss_sample.wav'
  if (!require('node:fs').existsSync(audioPath)) {
    spawnSync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=5,asetnsamples=1024',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5,asetnsamples=1024',
      '-f', 'lavfi', '-i', 'sine=frequency=880:duration=5,asetnsamples=1024',
      '-filter_complex', '[0:a][1:a][2:a]amix=inputs=3:duration=longest:dropout_transition=0,volume=0.5[a]',
      '-map', '[a]', '-ac', '2', '-ar', '44100', audioPath
    ], { stdio: 'ignore' })
  }

  const lines = parseLyrics(`[00:00.50]Halo dunia\n[00:02.50]Music spectrum`)
  const styles = ['cqt', 'bars', 'wave', 'circular', 'particles']
  const results = []
  for (const style of styles) {
    const tmp = mkdtempSync(join(tmpdir(), `mss-${style}-`))
    const assPath = join(tmp, 'lyrics.ass')
    writeFileSync(assPath, buildAss({
      width: 640, height: 360, fontFamily: 'Inter', fontSize: 32,
      color: '#FFFFFF', highlightColor: '#22d3ee', outlineColor: '#000000',
      outlineWidth: 2, position: 0.85, align: 'center', animation: 'fade',
      shadow: true, lines, title: `Style: ${style}`
    }))
    const bg = buildBackground(
      { kind: 'solid', color: '#0a0a1a' },
      640, 360, 30, 5
    )
    const vis = buildVisualizerFilter(640, 180, 30, {
      style, color: '#22d3ee', colorSecondary: '#a855f7',
      position: 0.55, intensity: 0.85, glow: 0.4, thickness: 4, mirror: false
    })
    const overlayY = Math.round(360 * 0.55 - 360 * 0.25)
    const filterComplex = [
      bg.filterChain, vis,
      `[bg][spec]overlay=0:${overlayY}:format=auto[v1]`,
      `[v1]ass='${escapeFilterPath(assPath)}'[vout]`
    ].join(';')
    const outputPath = `/tmp/mss_style_${style}.mp4`
    const argv = [
      '-hide_banner', '-y', '-i', audioPath, ...bg.inputArgs,
      '-filter_complex', filterComplex,
      '-map', '[vout]', '-map', '0:a',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24',
      '-pix_fmt', 'yuv420p', '-r', '30',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart', '-shortest', outputPath
    ]
    const proc = spawn('ffmpeg', argv, { stdio: ['ignore', 'ignore', 'pipe'] })
    let lastErr = ''
    proc.stderr.on('data', (b) => { lastErr += b.toString(); if (lastErr.length > 4096) lastErr = lastErr.slice(-4096) })
    const code = await new Promise((res) => proc.on('close', (c) => res(c ?? 1)))
    if (code !== 0) {
      console.error(`[${style}] FAILED code ${code}\n`, lastErr.slice(-1000))
      results.push({ style, ok: false })
    } else {
      const sz = statSync(outputPath).size
      console.log(`[${style}] OK ${outputPath} ${sz} bytes`)
      results.push({ style, ok: true, size: sz })
    }
  }
  console.log('\n=== summary ===')
  for (const r of results) console.log(r)
  if (results.some((r) => !r.ok)) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
