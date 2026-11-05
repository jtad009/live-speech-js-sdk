/**
 * LiveKit data topic the worker publishes captions on.
 *
 * `LiveSpeech.attach` ignores every other topic. The page must already be
 * joining this room. The SDK does not open its own LiveKit connection, and it
 * does not subscribe to a second room.
 */
export const LIVE_SPEECH_TOPIC = 'live-speech'

/**
 * The piece of a LiveKit `Room` this package needs.
 *
 * Pass the room the host page already created. Any object with these methods
 * is accepted, so the package does not depend on a particular `livekit-client`
 * version. The host still owns `connect`, the token, and the microphone.
 *
 * Register with `LiveSpeech.attach` before `room.connect()`. LiveKit does not
 * buffer data packets. The worker replays stored finals once the participant
 * can receive data. A listener attached after that replay never sees it.
 */
export interface CaptionRoom {
  /**
   * LiveKit connection state, when the room exposes it.
   *
   * `connected`, `reconnecting`, and `signalReconnecting` mean the replay may
   * already have been sent, and `attach` warns. `disconnected` and
   * `connecting` do not warn. An object that omits `state` does not warn.
   */
  state?: string
  /**
   * Subscribe to LiveKit `RoomEvent.DataReceived` (`'dataReceived'`).
   * The listener receives the raw bytes, the participant, the packet kind,
   * and the topic. Only the bytes and the topic are read.
   */
  on(event: 'dataReceived', listener: DataReceivedListener): unknown
  /** Remove the listener registered by `attach`. `stop` calls this once. */
  off(event: 'dataReceived', listener: DataReceivedListener): unknown
}

/**
 * LiveKit `RoomEvent.DataReceived`.
 * The topic is the fourth argument. Payload is UTF-8 JSON bytes.
 */
export type DataReceivedListener = (
  payload: Uint8Array,
  participant: unknown,
  kind: unknown,
  topic?: string,
) => void

/**
 * Whether `attach` is too late to be sure of the late-join replay.
 *
 * `connecting` is still in time: `connect()` has started, but the worker has
 * not yet been told this participant can receive data. `connected` and the
 * two reconnecting states are treated as late.
 */
export function isLateAttach(state: string | undefined): boolean {
  return state === 'connected' || state === 'reconnecting' || state === 'signalReconnecting'
}

/** Warned once when `attach` sees a room that is already connected. */
export const LATE_ATTACH_WARNING =
  'LiveSpeech.attach was called after the room connected. LiveKit does not buffer data packets, so the late-join replay may already have been missed. Call attach before room.connect().'
