import { pickDisplayText } from './locale.js'
import type { TranscriptLine, TranscriptPanel, TranscriptPayload } from './types.js'

/**
 * An empty panel: no session, no finals, no caption, and a packet count of 0.
 * This is the state before the first accepted packet, and the state a new
 * session is cleared back to before that session's opening packet is applied.
 */
export function emptyPanel(): TranscriptPanel {
  return { sessionId: null, finals: [], caption: null, packets: 0 }
}

/**
 * Spoken position of an utterance id.
 *
 * `live-1` is 1 and `live-10` is 10, so `live-2` sorts ahead of `live-10`.
 * `mock-N` uses the same number for the local demo. Any other id sorts last,
 * and two unknown ids then fall back to timestamp.
 *
 * @param id - Packet id, such as `live-4`.
 * @returns The spoken number, or `Number.MAX_SAFE_INTEGER` when the id has no number.
 */
export function utteranceOrder(id: string): number {
  const match = /^(?:live|mock)-(\d+)$/.exec(id)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

/**
 * Copy of `lines` sorted into spoken order.
 *
 * The input is not modified. Order is `utteranceOrder`, then `ts` when two
 * ids have no spoken number. Translation finishing out of order must not
 * change this sequence: the worker assigns `live-N` when the phrase is heard.
 *
 * @param lines - Finals in any order.
 * @returns A new array in spoken order.
 */
export function orderedFinals(lines: TranscriptLine[]): TranscriptLine[] {
  return [...lines].sort(
    (a, b) => utteranceOrder(a.id) - utteranceOrder(b.id) || a.ts - b.ts,
  )
}

/**
 * Plain-text body for Copy and Save.
 *
 * Finals are written in spoken order. Each one is three lines: speaker,
 * original, translation. Lines are separated by a blank line. The viewer's
 * preferred wording is not substituted here, so a saved file still contains
 * both languages. Empty when `lines` is empty.
 *
 * @param lines - Finals for the current session only.
 * @returns The text a participant can copy or download. Built in the browser.
 */
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
    payload.target_language,
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
 * Apply one caption packet to a panel and return the next panel.
 *
 * Session check happens first. If `payload.session_id` is a non-empty string
 * and it is not the panel's session, finals and the caption are discarded and
 * the packet count goes back to 0 before this packet is added. That is true
 * for an interim. An old meeting must not stay on screen, in Copy, or in Save.
 *
 * After that, the packet counts as one. An interim becomes `caption` and is
 * not added to `finals`. A final is inserted or, when the same `id` is already
 * present, replaces that line in place. A final for the id currently on the
 * caption strip clears the strip. Finals are returned in spoken order.
 *
 * The previous panel is not mutated.
 *
 * @param panel - The panel currently on screen.
 * @param payload - A packet `parseTranscript` has already accepted.
 * @param viewerLocale - BCP-47 tag of the reader. Selects `text` and `secondary`.
 * @returns The next panel. The packet that opens a session is packet 1.
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
