import { createTranscript } from './client.js'
import { parseTranscript } from './parse.js'
import {
  isLateAttach,
  LATE_ATTACH_WARNING,
  LIVE_SPEECH_TOPIC,
  type CaptionRoom,
  type DataReceivedListener,
} from './room.js'
import type { TranscriptPanel } from './types.js'
import { mountPanel, type PanelView } from './view.js'

/**
 * What the host's invite call returns to the SDK.
 *
 * The host backend is the only caller of `POST /api/v1/meetings/{room}/invite`.
 * It holds `LIVE_SPEECH_API_KEY`. This object is the JSON that route returns
 * to the page. The SDK reads `session_id` and ignores every other field, so a
 * key accidentally included in the JSON is not stored, displayed, or logged.
 */
export interface InviteResult {
  /**
   * Session minted for this invite, for example `ses_` plus hex.
   * A missing or empty id is shown as "The invite did not start a session."
   * The panel still waits for packets. It does not clear until a packet
   * names a different `session_id`.
   */
  session_id?: string | null
}

/**
 * Options for `LiveSpeech.attach`.
 *
 * The room is a separate argument. These options describe the div, the
 * viewer, and who is allowed to ask the host to invite the agent.
 */
export interface AttachOptions {
  /**
   * The div the host placed in the meeting page.
   *
   * Its children are replaced by the caption panel. Pass the element itself,
   * not a selector. `document.querySelector` is accepted and throws a
   * `TypeError` when it returns `null` or a non-HTML element, so a missing
   * div fails immediately instead of attaching a listener with nowhere to paint.
   */
  element: Element | null
  /**
   * BCP-47 tag of the person looking at this page.
   * Defaults to `en`. Only the primary language is compared with the speaker.
   * Pass `navigator.language` unless the host has its own locale.
   */
  locale?: string
  /**
   * Whether this participant is allowed to see **Start captions**.
   *
   * The host decides. A viewer who is not a moderator should pass `false`.
   * The button is also hidden when `invite` is omitted, even if this is `true`,
   * because a button with nobody to call would invite nothing.
   */
  canInvite?: boolean
  /**
   * Ask the host backend to invite the agent into this meeting.
   *
   * Called only when the allowed person presses **Start captions**. It must
   * `fetch` the host's own route. That route adds `LIVE_SPEECH_API_KEY` and
   * calls Live Speech. The function must resolve to `{ session_id }` on
   * success and reject with an `Error` whose `message` can be shown in the
   * panel when the invite fails. The SDK does not retry.
   *
   * A second press, after the first invite has finished, calls this again.
   * The server mints a new session for that invite. Presses while a call is
   * in flight are ignored.
   */
  invite?: () => Promise<InviteResult>
}

/**
 * The attachment created by `LiveSpeech.attach`.
 *
 * Keep it for the life of the meeting page. Call `stop` when the page leaves
 * the room, including from a React effect cleanup. Stopping removes the
 * data listener and the panel. It does not disconnect LiveKit and it does not
 * tell the worker to leave.
 */
export interface LiveSpeechHandle {
  /**
   * The transcript after the last accepted packet on topic `live-speech`.
   * The same object `createTranscript` would expose. Do not mutate it.
   */
  readonly state: TranscriptPanel
  /**
   * Plain text of the finals now on screen, in spoken order.
   * Speaker, original, and translation for each line. Empty when there are
   * no finals. This is what Copy writes to the clipboard and what Save downloads.
   */
  text(): string
  /**
   * Remove the data listener and the panel.
   *
   * Safe to call more than once. Packets that arrive after `stop` are ignored.
   * An invite that is still in flight will not update the page after this.
   */
  stop(): void
}

/**
 * Listen for captions on a LiveKit room and paint them into a host div.
 *
 * Call this before `room.connect()`. LiveKit does not buffer data packets.
 * The worker replays this session's stored finals when the participant can
 * receive data, on topic `live-speech`, and only to that participant. A
 * listener added after the replay misses those lines. If the invite turned
 * storage off, there is no replay. The panel then shows only finals that
 * arrive while the page is listening.
 *
 * The listener ignores every topic other than `live-speech`, and ignores
 * payloads `parseTranscript` rejects. Accepted packets follow the session
 * rules: a new `session_id` clears the div, the same `id` replaces a line,
 * finals stay in spoken order, and interims stay on the caption strip.
 *
 * **Start captions** is rendered only when both `canInvite` and `invite` are
 * set. The button calls `invite`. It does not call Live Speech, and it does
 * not send an API key. Copy and Save are built in the browser from the finals.
 * Spoken text is not logged.
 *
 * If `room.state` is already `connected`, `reconnecting`, or
 * `signalReconnecting`, a warning is written to the console. The listener is
 * still registered.
 *
 * @param room - The LiveKit room the page is about to join. Not a URL.
 * @param options - The div, the viewer locale, and the host invite callback.
 * @returns A handle. Call `stop` when the view unmounts.
 * @throws {TypeError} When `element` is missing or not an `HTMLElement`.
 * @throws {TypeError} When `room` has no `on` and `off` methods.
 *
 * @example
 * ```ts
 * import { LiveSpeech } from '@live-speech/sdk'
 *
 * // Before room.connect(), or the late-join replay is missed.
 * const speech = LiveSpeech.attach(room, {
 *   element: document.querySelector('#live-speech'),
 *   locale: navigator.language,
 *   canInvite: isModerator,
 *   invite: () =>
 *     fetch('/api/live-speech/invite', { method: 'POST' }).then((response) => response.json()),
 * })
 *
 * await room.connect(url, token)
 * ```
 */
export function attach(room: CaptionRoom, options: AttachOptions): LiveSpeechHandle {
  if (!(options.element instanceof HTMLElement)) {
    throw new TypeError('LiveSpeech.attach needs an element to mount into.')
  }
  const element: HTMLElement = options.element
  if (!room || typeof room.on !== 'function' || typeof room.off !== 'function') {
    throw new TypeError('LiveSpeech.attach needs the LiveKit room the page is joining.')
  }
  if (isLateAttach(room.state)) {
    console.warn(LATE_ATTACH_WARNING)
  }

  const client = createTranscript(options.locale ?? 'en')
  let stopped = false
  let inviting = false
  let view: PanelView | null = null

  const onData: DataReceivedListener = (payload, _participant, _kind, topic) => {
    if (topic !== LIVE_SPEECH_TOPIC) return
    const packet = parseTranscript(payload)
    if (!packet) return
    view?.render(client.apply(packet))
  }

  async function onInvite(): Promise<void> {
    if (stopped || inviting || !options.invite) return
    inviting = true
    view?.setPending(true)
    view?.setNotice('')
    try {
      const result = await options.invite()
      if (stopped) return
      if (!result || typeof result.session_id !== 'string' || result.session_id.length === 0) {
        view?.setNotice('The invite did not start a session.')
        return
      }
      view?.setNotice('Captions started.')
    } catch (error) {
      if (stopped) return
      const message = error instanceof Error && error.message ? error.message : 'The invite failed.'
      view?.setNotice(message)
    } finally {
      inviting = false
      if (!stopped) view?.setPending(false)
    }
  }

  async function onCopy(): Promise<void> {
    const body = client.text()
    if (!body) return
    try {
      await navigator.clipboard.writeText(body)
      if (!stopped) view?.setNotice('Copied.')
    } catch {
      if (!stopped) view?.setNotice('Copy was blocked by the browser.')
    }
  }

  function onSave(): void {
    const body = client.text()
    if (!body) return
    const doc = element.ownerDocument
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }))
    const link = doc.createElement('a')
    link.href = url
    link.download = 'transcript.txt'
    link.hidden = true
    doc.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  view = mountPanel(element, {
    canInvite: Boolean(options.canInvite && options.invite),
    onInvite: () => {
      void onInvite()
    },
    onCopy: () => {
      void onCopy()
    },
    onSave,
  })
  room.on('dataReceived', onData)

  return {
    get state() {
      return client.state
    },
    text() {
      return client.text()
    },
    stop() {
      if (stopped) return
      stopped = true
      room.off('dataReceived', onData)
      view?.destroy()
      view = null
    },
  }
}

/**
 * The host-facing entry point.
 *
 * `LiveSpeech.attach` is the call a meeting page makes. The headless helpers
 * (`createTranscript`, `parseTranscript`) are for a host that draws its own
 * markup and does not want this panel.
 */
export const LiveSpeech = {
  /**
   * Listen on topic `live-speech` and paint the caption panel.
   * See `attach` for the timing, the invite button, and the session rules.
   */
  attach,
}
