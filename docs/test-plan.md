# Test plan — PR #1: Music Spectrum Studio scaffold

**PR:** https://github.com/basis16/music-spectrum-studio/pull/1
**Goal:** prove that a real user can launch the app, pick an audio file, paste lyrics, click Render, and get back a valid MP4 with a CQT spectrum visualizer + lyric overlay + the original audio.

The PR introduces the entire app, so the only meaningful test is the **end-to-end render flow**. Everything else (5 visualizer styles, gradient PNG generator, ASS karaoke timing) is covered by the two non-Electron smoke scripts (`scripts/smoke.cts`, `scripts/test_all_styles.cts`) which I already exercised before pushing — re-running those is regression noise, not the primary thing the user wants to see.

## What changed (user-visible)

Brand-new desktop app. Before this PR there is no app; after, running `npm run dev` opens an Electron window that lets you assemble a project from audio + lyrics + style + background, then click `Render Video MP4` to get an MP4 file out via FFmpeg.

## Single primary flow

Run the dev build of the Electron app, drive the UI like a real user, and confirm the rendered MP4 contains the right audio, the right number of frames at the requested resolution, and that the lyric I imported is actually visible in a frame extracted from the video.

### Setup state already done (do NOT redo while recording)

- `npm install` already complete
- Sample fixtures already on disk: `/tmp/e2e_audio.wav` (15s, sine melody + brown noise, 44.1kHz stereo) and `/tmp/e2e_lyrics.lrc` (6 lines)
- `npm run dev` already running in the background; Electron window "Music Spectrum Studio" already on the X server (window id 0x02800004) and maximized

### Test steps

1. **Verify cold-start UI**
   - Action: take a screenshot of the maximized Electron window.
   - **PASS criteria (concrete):** the screenshot must show ALL of: title bar text "Music Spectrum Studio", the section header "1. Preset" with five clickable preset tiles ("Neon CQT", "Classic Bars", "Radial Pulse", "Minimal Wave", "Particle Fest"), section "2. Audio" with a button labeled exactly "Pilih audio", section "3. Lirik & Tipografi" with a button labeled exactly "Import .lrc / .srt / .txt" and a "0 baris" line counter badge, and a footer button labeled exactly "Render Video MP4" that is **disabled** (greyed/inert).
   - **Why this would fail if broken:** if the IPC bridge is broken or the React app fails to mount, the window will be blank or white. If the canRender gate (App.tsx:120) is wrong, the Render button would be enabled before any input.

2. **Pick audio file**
   - Action: click "Pilih audio" → in the native file dialog, type `/tmp/e2e_audio.wav` and confirm.
   - **PASS criteria:** the audio metadata grid appears in section 2 showing `Durasi 0:15`, `Format WAV` (or similar), `Sample Rate 44.1 kHz`, `Channels 2`. The "Pilih audio" button text changes to "Ganti audio". The Render button is still disabled (because no lyrics yet).
   - **Why this would fail if broken:** if `getAudioInfo()` (audio-info.ts) doesn't run, the metadata grid stays hidden and the Render gate stays at "audio missing".

3. **Paste lyrics**
   - Action: click into the LRC textarea, paste the contents of `/tmp/e2e_lyrics.lrc` (6 timestamped lines).
   - **PASS criteria:** the line counter changes from "0 baris" to "6 baris". The textarea visibly shows the LRC text. Render button is **still disabled** (because output path is not yet set).
   - **Why this would fail if broken:** if `parseLyrics()` (shared/lyrics.ts) is broken, the counter stays at 0. If `canRender` ignores `lines.length`, the button would enable prematurely.

4. **Set output path**
   - Action: scroll the left sidebar to find section "6. Output". Click "Pilih lokasi simpan" (or the path-picker button) → in the save dialog type `/tmp/mss_e2e_output.mp4`. Also pick the **720p** resolution to keep render time small (~1-2 min on this CPU).
   - **PASS criteria:** the output path field shows `/tmp/mss_e2e_output.mp4`. The "Render Video MP4" footer button now becomes **enabled** (full color, clickable).
   - **Why this would fail if broken:** if save dialog's path is not wired into `project.output.outputPath`, the Render button stays disabled. If `canRender` doesn't check `outputPath`, it would have been enabled at step 2 instead.

5. **Click Render and watch progress**
   - Action: click "Render Video MP4". Watch the progress UI for ~30-90 seconds.
   - **PASS criteria:** within 5 seconds the bottom-right "Render Progress" panel shows `Rendering…` text, a progress bar that visibly advances (not stuck at 0%), and a status line containing `Xs / 15.0s`, an `fps` value, a `speed` (e.g. `0.50x`), and an `ETA`. The progress bar reaches 100% and status changes to `Selesai` (Indonesian for "done"). Two new buttons appear: `Buka folder` and `Putar video`. Output path text below reads `Output: /tmp/mss_e2e_output.mp4`.
   - **Why this would fail if broken:** if FFmpeg never spawns (render-service.ts), the panel never shows progress. If `-progress pipe:2` parsing is broken, progress stays at 0%. If the IPC bridge `render:event` doesn't deliver, no UI update at all.

6. **Verify the rendered MP4 is real (post-render assertions, run via shell)**
   - Action: outside the Electron window, run `ffprobe -v error -show_entries format=duration:stream=index,codec_name,codec_type,width,height -of default=noprint_wrappers=1 /tmp/mss_e2e_output.mp4` and `ffmpeg -y -hide_banner -loglevel error -i /tmp/mss_e2e_output.mp4 -ss 00:00:08 -frames:v 1 /tmp/mss_e2e_frame.png`.
   - **PASS criteria (concrete):**
     - file size > 100 KB
     - ffprobe shows exactly **one video stream** with `codec_name=h264`, `width=1280`, `height=720`
     - ffprobe shows exactly **one audio stream** with `codec_name=aac`
     - format duration is between **14.5 and 15.5 seconds** (must match audio source within ±0.5s)
     - extracted frame at t=8s (which falls in the time range of the 4th lyric line `[00:07.50]With karaoke style lyrics`) **must visibly contain the text "With karaoke style lyrics"** — verified by either OCR or eyeball; if neither succeeds, this assertion is marked **inconclusive**, not passing
     - the same frame must show a non-empty CQT spectrum band — proven by checking that the middle horizontal band of the image has > 5% non-background pixels (i.e., it is not solid black)
   - **Why this would fail if broken:** if FFmpeg silently fails (e.g. the colorkey filter is malformed), the output file is missing or 0 bytes. If ASS rendering is broken, the lyric text won't appear on the frame. If overlay coordinates are wrong, the spectrum doesn't appear.

### Out of scope for this run

- Windows `.exe` packaging (`npm run package:win`) — needs a Windows VM or Wine; not testing here. Will note as **untested** in report.
- 4K + 60fps rendering — quality difference vs 720p@30 isn't useful evidence and triples render time on this CPU. Not testing.
- Non-CQT visualizer styles in the dev app — already proven by `scripts/test_all_styles.cts` smoke (regression). Not re-driven through UI.
- Image/video background paths — same FFmpeg input/filter machinery; covered by `buildBackground()` smoke. Not re-driven through UI.

If anything in steps 1-6 produces a result not matching the concrete PASS criteria, I will report it as **failed** with the screenshot + ffprobe output, and not paper over it.
