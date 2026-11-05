import { applyTranscriptPacket, emptyPanel, transcriptText } from './transcript.js'
import type { TranscriptPanel, TranscriptPayload } from './types.js'

/** Headless transcript. The host renders it, or a later mount helper will. */
export function createTranscript(viewerLocale = 'en') {
  let panel = emptyPanel()
  return {
    get state(): TranscriptPanel {
      return panel
    },
    apply(payload: TranscriptPayload): TranscriptPanel {
      panel = applyTranscriptPacket(panel, payload, viewerLocale)
      return panel
    },
    text(): string {
      return transcriptText(panel.finals)
    },
  }
}

export type TranscriptClient = ReturnType<typeof createTranscript>
