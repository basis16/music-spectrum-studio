# Test report — auto-lirik (Whisper) — PR #1

**Devin session:** https://app.devin.ai/sessions/e694fc254b6e424e8a31310f9abad12d
**Recording:** https://app.devin.ai/attachments/db0842ae-6e23-4de7-93d2-6e8dd97c9a66/rec-8ba473ae-f9c2-4569-a470-7d0148a21222-edited.mp4
**Test plan:** [docs/test-plan-auto-lyric.md](./test-plan-auto-lyric.md)

## How tested

Drove the real Electron dev build (`npm run dev`) on Linux/X11 against `/tmp/e2e_speech.wav` (19s English TTS sample). Whisper-Tiny was pre-cached at `~/.config/Music Spectrum Studio/whisper-models/Xenova/whisper-tiny.en/`; Whisper-Base was downloaded fresh during the recording (~75 MB) so the first-run download path is also exercised. Output MP4 inspected with `ffprobe` and `ffmpeg` frame extraction.

## Headlines

- **Pipeline:** auto-lirik panel → Generate → progress UI → textarea populate → render with new lines → MP4 with overlay — **all 5 tests pass**.
- **Quality caveat:** with default `Auto-detect` + `Whisper Tiny`, the multilingual tiny model hallucinated. Switching language to `English` (Whisper Base) produced 5 recognizable lines including `Welcome to Music and Trim Studio.` (slight `Spectrum`→`Trim` mishearing, otherwise faithful). This is an upstream Whisper behavior, not a bug in the wiring.

## Results

| # | Test | Result |
|---|---|---|
| 1 | Auto-lirik panel renders with Bahasa/Model selectors and Generate button gated until audio is picked | passed |
| 2 | Picking `/tmp/e2e_speech.wav` flips Generate button from disabled → enabled (helper text disappears) | passed |
| 3 | Click Generate → Cancel button replaces it; stage labels (`Memuat model`, `Mentranskripsi audio`) and percent counter update; offline disclaimer visible | passed |
| 4 | LRC textarea is auto-populated with `[mm:ss.xx]` lines; "N baris" badge updates; live preview renders the new line | passed (with quality caveat — see below) |
| 5 | Render with auto-generated lines produces valid MP4 (h264 1280×720, aac mono, duration 18.896s); extracted frames show the auto-transcribed text overlaid on CQT spectrum | passed |

### Test 4 quality caveat

| Run | Language | Model | Result |
|---|---|---|---|
| First | Auto-detect | Whisper Tiny (multilingual) | 1 baris — `[00:00.00]and we will be able to do this in the future.` (hallucination) |
| Second | Auto-detect | Whisper Base (multilingual) | 1 baris — `[00:00.00][Music]` (hallucination) |
| Third | English (forced) | Whisper Base | **5 baris**, recognizable — see textarea content below |

Final textarea content from run 3 (this is what flowed into the rendered MP4):

```
[00:00.00]Welcome to Music and Trim Studio.
[00:02.62]This song demonstrates the art of lyric generation feature.
[00:06.80]Each line you hear is being transcribed by whisper running locally on your computer.
[00:11.96]No art is sent to any external server.
[00:15.12]We hope you enjoy creating beautiful music videos.
```

Source TTS script was: *"Welcome to Music Spectrum Studio. This song demonstrates the audio lyric generation feature. Each line you hear is being transcribed by Whisper running locally on your computer. No audio is sent to any external server. We hope you enjoy creating beautiful music videos."* The Whisper-Base output is ≥90% word-accurate.

**Conclusion on the model picker:** the feature works, but the multilingual tiny / base default has a real chance of hallucinating on quiet/synthetic input. Two follow-up ideas worth doing in a separate PR:
1. Add `Xenova/whisper-tiny.en` and `Xenova/whisper-base.en` as picker options (English-only variants are markedly more accurate for English-only audio and the same size as multilingual).
2. Bias the default model from Tiny to Base (already the default in the code — confirmed).

## Render output

- Saved path: `/tmp/mss_autolyric_output.mp4.mp4` (the `.mp4.mp4` suffix is the same GTK save-dialog quirk noted in the previous session — it appends `.mp4` to a name already ending in `.mp4`).
- ffprobe: `codec_name=h264, width=1280, height=720, channels=1 (aac), duration=18.896s`.
- 4 extracted frames showing the auto-transcribed lines over the CQT spectrum:

| t = 0.5s | t = 5s |
|---|---|
| ![t=0.5s](https://app.devin.ai/attachments/6a2e7dc3-eb69-4052-9f4c-1a3026769404/auto_t0.5.png) | ![t=5s](https://app.devin.ai/attachments/a962b8b5-22e7-4004-aa11-d444d1caf744/auto_t5.png) |
| t = 10s | t = 14s |
| ![t=10s](https://app.devin.ai/attachments/92c3e6e5-e2cd-4b34-898a-1ac3ba7fba8d/auto_t10.png) | ![t=14s](https://app.devin.ai/attachments/060b38d6-d68a-4f54-b1c2-4080f50c967b/auto_t14.png) |

## Notes / things not tested

- **Bahasa Indonesia / other languages** — language picker is wired (`options.language` is forwarded to the pipeline as Whisper's `language` arg) but the only on-disk fixture is English TTS. Worth a recording on a real Indonesian audio sample once one is available.
- **Cancel mid-transcription** — the cancel button + `transcribe:cancel` IPC path exists and the `cancelled` flag is checked in `transcribe-service.ts`, but I did not exercise it during the recording (each Whisper run completed within ~10s so there was no meaningful window).
- **Windows .exe packaging** — same untested status as the previous session (no Windows VM / Wine here). The asarUnpack additions for `onnxruntime-node` and `@xenova/transformers` are best-effort based on electron-builder docs; first-time Windows packaging will likely need one or two adjustments.
