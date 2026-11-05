import { pickDisplayText } from './locale.js'
import type { TranscriptLine, TranscriptPanel, TranscriptPayload } from './types.js'

export function emptyPanel(): TranscriptPanel {
  return { sessionId: null, finals: [], caption: null, packets: 0 }
}

/** Spoken order. `live-2` stays ahead of `live-10`. Unknown ids sort last. */
export function utteranceOrder(id: string): number {
  const match = /^(?:live|mock)-(\d+)$/.exec(id)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

export function orderedFinals(lines: TranscriptLine[]): TranscriptLine[] {
  return [...lines].sort(
    (a, b) => utteranceOrder(a.id) - utteranceOrder(b.id) || a.ts - b.ts,
  )
}

export function transcriptText(lines: TranscriptLine[]): string {
  return orderedFinals(lines)
    .map((line) => `${line.speaker}\n${line.original}\n${line.translation}`)
    .join('\n\n')
}

function toLine(payload: TranscriptPayload, viewerLocale: string): TranscriptLine {
  const pick = pickDisplayText(
    payload.original,
    payload.translation,
    payload.language,
    viewerLocale,
  )
  return {
    id: payload.id,
    speaker: payload.speaker,
    language: payload.language,
    original: payload.original,
    translation: payload.translation,
    text: pick.text,
    secondary: pick.secondary,
    ts: payload.ts,
  }
}

/**
 * Apply one caption packet.
 * A new session_id clears the panel before interim packets are ignored,
 * so an old meeting cannot remain on screen. The packet count restarts too.
 */
export function applyTranscriptPacket(
  panel: TranscriptPanel,
  payload: TranscriptPayload,
  viewerLocale: string,
): TranscriptPanel {
  const newSession = Boolean(payload.session_id && payload.session_id !== panel.sessionId)
  let next = panel
  if (newSession) {
    next = {
      sessionId: payload.session_id ?? null,
      finals: [],
      caption: null,
      packets: 0,
    }
  }
  const packets = next.packets + 1
  const line = toLine(payload, viewerLocale)
  if (payload.status !== 'final') {
    return { ...next, caption: line, packets }
  }
  const without = next.finals.filter((item) => item.id !== line.id)
  return {
    sessionId: next.sessionId,
    finals: orderedFinals([...without, line]),
    caption: next.caption?.id === line.id ? null : next.caption,
    packets,
  }
}
