# Music Spectrum Studio

Aplikasi desktop **cross-platform** (utama: **Windows**) untuk membuat **video musik dengan visualizer spectrum + lirik** berkualitas profesional. Cukup pilih audio, masukkan lirik (LRC/SRT atau ketik manual), pilih preset, lalu **render** ke MP4 1080p / 4K dengan satu klik.

![preview](docs/preview.png)

## Fitur

- 🎵 Input audio: **MP3, WAV, FLAC, M4A, AAC, OGG, OPUS**
- 📝 Lirik: import **.lrc / .srt / .txt** atau ketik langsung di editor (auto-parse)
- 🎨 5 preset visualizer profesional + customisasi penuh:
  - **CQT** (paling musical, rekomendasi default)
  - **Bars** (EQ klasik)
  - **Wave** (gelombang minimalis)
  - **Circular** (radial)
  - **Particles** (vector scope)
- 🖼️ Background: warna solid, gradient, gambar, atau video loop
- ✨ Tipografi lirik: font, ukuran, warna, outline, shadow, animasi (fade / pop / slide / **karaoke**)
- 🎞️ Output: **MP4 H.264 hingga 4K @ 60fps**, audio AAC 320 kbps, faststart untuk streaming
- ⚡ Render via **FFmpeg native** (bundled, user tidak perlu install) — cepat, sync sempurna, kualitas studio
- 🎚️ Live preview di app (Web Audio Canvas)
- 📊 Progress bar real-time + estimasi waktu

## Quickstart (developer)

```bash
# Prasyarat: Node.js 20+ dan npm
npm install
npm run dev
```

Kemudian buka aplikasi yang muncul. Pilih audio → atur lirik & style → klik **Render Video MP4**.

## Build installer

```bash
# Windows .exe (NSIS installer)
npm run package:win

# macOS .dmg
npm run package:mac

# Linux AppImage + .deb
npm run package:linux
```

Hasil installer ada di `release/<version>/`.

## Stack

| Layer | Teknologi |
|---|---|
| Shell | Electron 31 |
| Renderer | React 18 + TypeScript + Vite + Tailwind CSS |
| Bundler | electron-vite |
| Render engine | FFmpeg (bundled via `ffmpeg-static`) |
| Subtitle | ASS (Advanced SubStation) — render via libass |
| Metadata audio | `music-metadata` |

## Arsitektur

```
┌─────────────────────────────────────┐
│  Renderer (React)                   │
│   ├─ Form: audio / lyric / style    │
│   ├─ Live preview (Canvas + WebAudio│
│   └─ Progress bar                   │
└────────────┬────────────────────────┘
             │ IPC (contextIsolated)
┌────────────▼────────────────────────┐
│  Main (Node.js)                     │
│   ├─ ProjectSettings → ASS file     │
│   ├─ BackgroundBuilder              │
│   ├─ VisualizerFilter (showcqt/...)│
│   └─ FFmpeg child process           │
│        └─ -progress pipe:2 → events │
└─────────────────────────────────────┘
```

Render pipeline (contoh):
```bash
ffmpeg -i audio.mp3 \
  -f lavfi -i color=c=#0a0a1a:s=1920x1080:r=30:d=DURATION \
  -filter_complex "
     [1:v]format=yuv420p[bg];
     [0:a]showcqt=s=1920x540:r=30:cscheme=...[spec];
     [bg][spec]overlay=0:270[v1];
     [v1]ass='/tmp/lyrics.ass'[vout]" \
  -map "[vout]" -map 0:a \
  -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 320k -movflags +faststart \
  output.mp4
```

## Struktur folder

```
src/
├─ main/             # Electron main process
│  ├─ index.ts
│  ├─ render-service.ts   # FFmpeg orchestration
│  ├─ visualizer.ts       # Filter graph builders per style
│  ├─ background.ts       # Solid/gradient/image/video bg
│  └─ audio-info.ts
├─ preload/          # Context bridge (contextIsolated)
├─ renderer/         # React UI
│  └─ src/
│     ├─ App.tsx
│     ├─ components/...
│     └─ lib/...
└─ shared/           # Types, presets, lyric parser (LRC/SRT)
```

## Format lirik yang didukung

### LRC
```
[00:01.20]Baris pertama
[00:04.50]Baris kedua
[00:08.00]Baris ketiga
```

### SRT
```
1
00:00:01,200 --> 00:00:04,500
Baris pertama

2
00:00:04,500 --> 00:00:08,000
Baris kedua
```

## Lisensi

MIT © 2025 Basis Muhammad
