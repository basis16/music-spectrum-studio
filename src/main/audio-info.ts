import { parseFile } from 'music-metadata'
import type { AudioInfo } from '../shared/types'

export async function getAudioInfo(path: string): Promise<AudioInfo> {
  const meta = await parseFile(path, { duration: true })
  let coverDataUrl: string | undefined
  if (meta.common.picture && meta.common.picture[0]) {
    const pic = meta.common.picture[0]
    coverDataUrl = `data:${pic.format};base64,${Buffer.from(pic.data).toString('base64')}`
  }
  return {
    path,
    durationSec: meta.format.duration ?? 0,
    sampleRate: meta.format.sampleRate ?? 44100,
    channels: meta.format.numberOfChannels ?? 2,
    format: meta.format.container ?? 'unknown',
    bitrate: meta.format.bitrate,
    title: meta.common.title,
    artist: meta.common.artist,
    album: meta.common.album,
    coverDataUrl
  }
}
