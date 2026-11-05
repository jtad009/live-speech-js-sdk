import { applyTranscriptPacket, emptyPanel, transcriptText } from './transcript.js'
import type { TranscriptPanel, TranscriptPayload } from './types.js'

/**
 * A transcript with no DOM.
 *
 * Use this when the host meeting page draws its own captions and wants the
 * session rules without the built-in panel. Feed it packets from
 * `parseTranscript`. `LiveSpeech.attach` uses one of these internally.
 *
 * The locale is fixed for the life of the client. A line's `text` is the
 * translation only when the packet's `target_language` matches this locale.
 * A translation into some other language stays secondary. The client does
 * not translate anything itself. The worker already did that.
 */
export interface TranscriptClient {
  /**
   * The panel after the last accepted packet.
   * Replaced as a whole on each `apply`. Do not mutate it.
   */
  readonly state: TranscriptPanel
  /**
   * Apply one already-parsed packet and return the panel it produced.
   *
   * A new `session_id` clears finals, the caption, and the packet count
   * before the packet is shown. The same session keeps finals. The same `id`
   * replaces that line. An interim updates `state.caption` and does not join
   * `state.finals`.
   */
  apply(payload: TranscriptPayload): TranscriptPanel
  /**
   * Plain text of the current finals, in spoken order.
   *
   * Each line is the speaker, the original, and the translation, separated by
   * newlines. Sessions are not mixed: a cleared session contributes nothing.
   * Empty when there are no finals. This is the Copy and Save body.
   */
  text(): string
}

/**
 * Start an empty transcript for one viewer.
 *
 * @param viewerLocale - BCP-47 tag of the person reading the page, such as
 * `navigator.language`. Only the primary language is compared (`en` from
 * `en-GB`). The translation is the line they read only when the packet was
 * translated into that language. Defaults to `en`.
 * @returns A client with no session, no finals, and no caption.
 *
 * @example
 * ```ts
 * import { createTranscript, parseTranscript } from '@live-speech/sdk'
 *
 * const speech = createTranscript(navigator.language)
 * const packet = parseTranscript(raw)
 * if (packet) speech.apply(packet)
 * ```
 */
export function createTranscript(viewerLocale = 'en'): TranscriptClient {
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
