# Test plan — auto-lirik (Whisper) — PR #1, commit df549e2

**PR:** https://github.com/basis16/music-spectrum-studio/pull/1
**Goal:** prove that a real user can pick an audio file in the running Electron app, click **Generate lirik otomatis**, and end up with a textarea full of timestamped LRC lines that match what's in the audio — and that the existing render pipeline still produces a valid MP4 with those auto-generated lines burned in.

The PR scaffold itself was already E2E-tested in the previous session via `docs/test-plan.md`. This file covers only the **new** auto-lirik path on top of that.

## What changed (user-visible)

A new accent-colored panel appears in section **3. Lirik & Tipografi** containing:
- Header text "Generate lirik otomatis"
- A language `<select>` (default "Auto-detect")
- A model `<select>` (default "Whisper Base (~75 MB · seimbang)")
- A primary button "Generate lirik otomatis" — **disabled until an audio file is picked**
- An inline progress bar with stage labels and a Cancel button while running
- On success, the LRC textarea is overwritten with the transcribed lines

Source of truth: `src/renderer/src/components/LyricsSection.tsx:130-220`, `src/main/transcribe-service.ts`, `src/main/index.ts:143-163`, `src/preload/index.ts:49-59`.

## Setup state already done (do NOT redo while recording)

- `npm install` complete
- `/tmp/e2e_speech.wav` exists (19s English TTS — clear vocals so the model has something to transcribe)
- Whisper-tiny.en model already cached at `~/.config/Music Spectrum Studio/whisper-models/Xenova/whisper-tiny.en/` — saves the 40 MB download mid-recording. (Real users still get the download once on first run.)
- `npm run dev` launched, Electron window maximized via `wmctrl`

## Single primary flow (the recording)

Five tests, ordered. Each one's "would this look identical if the change were broken?" check is included.

### Test 1 — auto-lirik panel exists with correct controls

- **Action:** scroll left sidebar to section "3. Lirik & Tipografi". Take a screenshot.
- **PASS criteria (concrete, all required):**
  - The screenshot shows an accent-bordered panel with header text exactly "Generate lirik otomatis"
  - Inside the panel, a `<select>` labeled "Bahasa" whose default selected option text is "Auto-detect"
  - A second `<select>` labeled "Model" whose default selected option text is "Whisper Base (~75 MB · seimbang)"
  - A primary (cyan) button labeled exactly "Generate lirik otomatis"
  - The button is **visibly disabled** (greyed/inert), and to its right is the helper text "Pilih file audio dulu di bagian 2."
  - **Below the panel** the existing "Import .lrc / .srt / .txt" button still exists with "0 baris" badge
- **Why broken would look different:** if the `<LyricsSection>` import broke, the entire section 3 would crash. If the panel only renders when `audio?.path` is truthy (a plausible mistake), the panel would be missing entirely until step 2.

### Test 2 — Pick `/tmp/e2e_speech.wav`, gate flips

- **Action:** click "Pilih audio" in section 2. In the file dialog, navigate to `/tmp/e2e_speech.wav` and confirm. Take a screenshot.
- **PASS criteria:**
  - Section 2 audio metadata grid shows `Durasi 0:18` (or `0:19` depending on rounding; the exact ffprobe value is 18.895s) and `Sample Rate 16 kHz` (espeak-ng default), `Channels 1`
  - In section 3, the "Generate lirik otomatis" button is now **enabled** (cyan, not greyed)
  - The "Pilih file audio dulu di bagian 2." helper text is gone
- **Why broken would look different:** if `audio.path` isn't propagating through props, the button stays disabled forever. If the helper-text gating is wrong, it lingers even after audio is set.

### Test 3 — Switch model to Tiny, click Generate, verify progress UI

- **Action:** in the "Model" `<select>`, switch to "Whisper Tiny (~40 MB · cepat)" (because we pre-cached this one and want to keep the recording short). Leave language at "Auto-detect". Click "Generate lirik otomatis". Take screenshots periodically (every ~3-5s).
- **PASS criteria (must observe at least one of each):**
  - Within 1 second, the progress bar appears with stage label text matching "Memuat model" or "Mentranskripsi audio" or "Memecah audio"
  - The "Generate lirik otomatis" button is replaced by a "Batalkan" button while running
  - The percent-complete counter (e.g. "53%") increments at least twice during the run
  - The disclaimer text "Hasil ditranskripsi sepenuhnya di komputer Anda — tidak ada audio yang dikirim ke server." is visible in the panel during the run
  - The transcription completes within 30 seconds wall-clock (the smoke run measured 11s for this exact input + model)
- **Why broken would look different:** if IPC events aren't reaching the renderer (`onTranscribeEvent` listener bug), the percent counter never moves and the panel stays stuck at 0%. If `setAuto({ status: 'running' })` is wrong, the cancel button never appears. If the IPC handler is missing entirely, clicking the button does nothing.

### Test 4 — LRC textarea is auto-populated with transcribed lines

- **Action:** wait for the green text "Lirik berhasil dihasilkan (N baris)" to appear. Screenshot the LRC textarea.
- **PASS criteria (all required):**
  - The "N baris" badge in the import row reads at least `3 baris` (the smoke run produced 5; bare-minimum threshold is 3 to allow for environmental variance — fewer than that signals broken segmentation)
  - The textarea contains lines that begin with `[00:` (square-bracketed `mm:ss.xx` LRC timestamp). Specifically the first character of the first line must be `[`.
  - The textarea contains the literal string `Welcome to Music Spectrum Studio` somewhere in its body. This is the first sentence of the TTS source — if it doesn't show up, the model output isn't reaching the textarea (or transcription is severely broken).
- **Why broken would look different:** if `onChangeLines(ev.lines)` isn't wired, the textarea stays empty / unchanged. If the LRC formatter (`linesToLrc` at LyricsSection.tsx:283) is broken, the timestamps are missing or wrong shape. If the chunk→line conversion (`chunksToLines` in transcribe-service.ts) drops everything, the textarea is empty even though `transcribe-done` fired.

### Test 5 — Render still works with the auto-generated lyrics (regression)

- **Action:** scroll to section "6. Output". Click "Pilih lokasi simpan" → save dialog → type `/tmp/mss_autolyric_output.mp4`. Pick **720p** to keep render fast. Click "Render Video MP4". Wait for `Selesai`. Then in a shell, extract a frame at t=2s with `ffmpeg -ss 2 -i /tmp/mss_autolyric_output.mp4 -frames:v 1 /tmp/autolyric_frame.png` and view it.
- **PASS criteria:**
  - Render progress bar reaches 100% with status text "Selesai" within 90 seconds
  - `ffprobe /tmp/mss_autolyric_output.mp4` reports `codec_name=h264`, `width=1280`, `height=720`, `nb_streams≥2` (video + audio), and `format.duration` between 18.0 and 19.5
  - The extracted PNG frame shows a recognizable substring of the auto-transcribed lyric text overlaid on the video (any one of: "Welcome", "Music Spectrum Studio", "demonstrates", "transcribed", "whisper") — confirms the new lines actually flowed all the way into the ASS subtitle pipeline
- **Why broken would look different:** if line `end` times aren't filled in by `chunksToLines`, ASS dialogue events get malformed `Dialogue:` timestamps and libass refuses to draw them — the frame would have no overlay text. If the new lines aren't in `project.lines` at render-start, the rendered video plays the audio but with empty subtitles.

## Out of scope for this recording

- Trying language=Bahasa Indonesia / Japanese / etc. — the language picker is a one-line change (`language` is forwarded to the pipeline) and will be exercised by users with their own audio. Not adversarial enough to record.
- Trying Whisper-base or Whisper-small — these would force a multi-minute model download which adds nothing the tiny model doesn't already prove. The model picker is a one-line change.
- Cancellation flow — exists in the code (cancel button + `cancel()` method) but blocking on user-visible verification means deliberately starting and aborting, which adds little after we've already shown the happy path works.

## Risk register

- **Risk:** the espeak-ng-generated audio is mono 16 kHz, not 44.1 kHz stereo. The render pipeline expects audio in many formats and re-encodes it, so this should be fine — but if the audio re-encode step is broken for mono input, render Test 5 fails. Mitigation: if Test 5 fails specifically with an audio decode error, swap to `/tmp/e2e_audio.wav` (44.1 kHz stereo) for the render — but for transcription `/tmp/e2e_speech.wav` is the only fixture with actual words.
- **Risk:** the prewarmed cache copy is in the wrong format and Whisper redownloads anyway. Mitigation: the recording will still work; it'll just take longer (~30-60s for the download on top of the 11s for transcription).
