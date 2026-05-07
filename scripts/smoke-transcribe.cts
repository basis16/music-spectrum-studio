/**
 * Smoke test for the transcribe service.
 *
 * Usage:
 *   npx tsx scripts/smoke-transcribe.cts <audio.wav> [model-id]
 *
 * Defaults:
 *   audio.wav -> /tmp/e2e_speech.wav
 *   model-id  -> Xenova/whisper-tiny.en (small, fast, English-only)
 */

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TranscribeService } from '../src/main/transcribe-service'
import type { TranscribeEvent } from '../src/shared/types'

async function main(): Promise<void> {
  const audioPath = process.argv[2] ?? '/tmp/e2e_speech.wav'
  const modelId = process.argv[3] ?? 'Xenova/whisper-tiny.en'
  const cacheDir = mkdtempSync(join(tmpdir(), 'mss-smoke-stt-'))
  console.log(`audio=${audioPath} model=${modelId} cache=${cacheDir}`)

  const svc = new TranscribeService(cacheDir)
  svc.on('event', (ev: TranscribeEvent) => {
    if (ev.type === 'transcribe-stage') {
      console.log(`[stage] ${ev.stage}${ev.message ? ' — ' + ev.message : ''}`)
    } else if (ev.type === 'transcribe-progress') {
      const pct = ev.progress != null ? `${Math.round(ev.progress * 100)}%` : ''
      const t = ev.timeSec != null && ev.totalSec != null ? `${ev.timeSec.toFixed(1)}s/${ev.totalSec.toFixed(1)}s` : ''
      const m = ev.message ?? ''
      const line = [pct, t, m].filter(Boolean).join(' ')
      if (line) console.log(`[progress] ${line}`)
    } else if (ev.type === 'transcribe-error') {
      console.error(`[error] ${ev.message}`)
    } else if (ev.type === 'transcribe-done') {
      console.log(`[done] ${ev.lines.length} lines`)
    }
  })

  const start = Date.now()
  const job = svc.start('smoke', audioPath, { language: 'auto', modelId })
  const lines = await job.done
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log('\n=== LRC output ===')
  for (const l of lines) {
    const m = Math.floor(l.start / 60)
    const s = (l.start % 60).toFixed(2).padStart(5, '0')
    console.log(`[${String(m).padStart(2, '0')}:${s}]${l.text}`)
  }
  console.log(`\nTranscription complete in ${elapsed}s, ${lines.length} lines`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
