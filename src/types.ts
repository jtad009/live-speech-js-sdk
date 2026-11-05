/**
 * Whether this packet is still being spoken or is safe to keep.
 *
 * An `interim` updates the caption strip and is replaced by the next interim
 * or by the matching `final`. A `final` is one finished utterance. Finals are
 * the only lines that stay in the transcript, and the only lines Copy and
 * Save include. Partials are never stored by the Live Speech service, so a
 * page that joins late is replayed finals only.
 */
export type UtteranceStatus = 'interim' | 'final'

/**
 * One caption packet, version 1.
 *
 * The Live Speech worker publishes this JSON on the LiveKit data topic
 * `live-speech`. A future Live Speech socket will send the same JSON. The
 * host application server is not on that path: the meeting page receives the
 * packet directly.
 *
 * `parseTranscript` accepts this shape and rejects everything else, including
 * `meeting_status`, a different `v`, and a payload that is not JSON.
 */
export interface TranscriptPayload {
  /** Packet version. Only `1` is accepted. */
  v: 1
  /** Packet kind. Only `transcript` is a caption. Other types are ignored. */
  type: 'transcript'
  /**
   * Utterance id, assigned when the worker hears the phrase.
   *
   * Live utterances use `live-1`, `live-2`, and so on. The number is the
   * spoken order, not the order the translation finished. A replay sends the
   * same id again, and the panel replaces that line instead of adding a copy.
   * The local mock uses `mock-N` and follows the same rule.
   */
  id: string
  /**
   * The invite this packet belongs to.
   *
   * Each invite mints a new `session_id`. The first packet whose `session_id`
   * differs from the one on screen clears the caption and the finals before
   * anything else is done, including when that packet is only an interim.
   * Absent on older packets. A missing id does not clear the panel.
   */
  session_id?: string | null
  /** `interim` while the phrase is still changing, `final` when it is kept. */
  status: UtteranceStatus
  /** Display name of the person who spoke. May be empty. Never logged by the SDK. */
  speaker: string
  /**
   * BCP-47 tag of the spoken language, for example `nl` or `nl-NL`.
   * Compared with the viewer locale by primary language only.
   */
  language: string
  /** What was said, in the speaker's language. May be empty while an interim starts. */
  original: string
  /**
   * Translation into `target_language`. Empty when the worker has not
   * translated this phrase. An empty translation is not shown as the main line.
   */
  translation: string
  /** BCP-47 tag the translation was written in. */
  target_language: string
  /** Unix milliseconds when the worker published the packet. */
  ts: number
}

/**
 * One line ready to render.
 *
 * `text` is the line the viewer should read. `secondary` is the other
 * wording, shown smaller, and is omitted when there is nothing extra to show.
 * `original` and `translation` are always kept so Copy and Save can write
 * both, independent of which one `text` chose.
 */
export interface TranscriptLine {
  /** Same id as the packet. The panel replaces a line when this id arrives again. */
  id: string
  /** Display name from the packet. */
  speaker: string
  /** Spoken-language tag from the packet. */
  language: string
  /** Spoken wording. */
  original: string
  /** Translated wording. Empty when the packet had no translation. */
  translation: string
  /**
   * The wording to show as the line.
   * The translation, when `target_language` is the viewer's language and the
   * speaker's language is not.
   * The original, when the viewer speaks it, when no translation was sent, or
   * when the translation was written for a different language.
   */
  text: string
  /**
   * The other wording, when it differs from `text`.
   * Omitted when it would repeat `text` or when no translation exists.
   */
  secondary?: string
  /** Unix milliseconds from the packet. */
  ts: number
}

/**
 * The transcript currently on screen.
 *
 * One panel belongs to one `sessionId`. A packet from a different session
 * replaces the whole panel. Finals stay in spoken order. The caption is the
 * single interim line, or `null` when nothing is in progress.
 */
export interface TranscriptPanel {
  /**
   * `session_id` of the packets now on screen.
   * `null` before the first packet that names a session.
   */
  sessionId: string | null
  /**
   * Finished lines for this session, in spoken order.
   * `live-2` stays ahead of `live-10`. A repeated id replaces its line and
   * does not move it.
   */
  finals: TranscriptLine[]
  /**
   * The interim line, shown on the caption strip.
   * `null` when the latest packet for that id was a final, or when no interim
   * has arrived for this session.
   */
  caption: TranscriptLine | null
  /**
   * How many accepted packets belong to the current session.
   * Restarts at 1 on the packet that opens a new session, so that packet counts.
   * Packets that `parseTranscript` rejects are not counted.
   */
  packets: number
}
