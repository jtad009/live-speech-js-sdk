import type { TranscriptPayload, UtteranceStatus } from './types.js'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asStatus(value: unknown): UtteranceStatus | null {
  return value === 'interim' || value === 'final' ? value : null
}

/**
 * Read one data-channel payload and return a caption packet, or `null`.
 *
 * Accepts a UTF-8 JSON string or the `Uint8Array` LiveKit passes to
 * `DataReceived`. Returns `null` for malformed JSON, for any packet whose
 * `v` is not `1` or whose `type` is not `"transcript"`, and for a transcript
 * that is missing a required string or has a `ts` that is not a finite
 * number. `session_id` may be absent or `null`. Any other type for
 * `session_id` rejects the packet.
 *
 * A `null` result must be ignored. Do not throw, and do not clear the panel.
 * `meeting_status` and any future non-caption message take this path.
 * Rejected packets are not counted.
 *
 * The spoken text is not logged.
 *
 * @param raw - JSON text, or the bytes from the LiveKit data callback.
 * @returns The packet, or `null` when the payload is not a v1 transcript.
 *
 * @example
 * ```ts
 * const packet = parseTranscript(payload)
 * if (!packet) return
 * speech.apply(packet)
 * ```
 */
export function parseTranscript(raw: string | Uint8Array): TranscriptPayload | null {
  const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  const data = asRecord(parsed)
  if (!data) return null
  if (data.v !== 1 || data.type !== 'transcript') return null
  const id = asString(data.id)
  const status = asStatus(data.status)
  const speaker = asString(data.speaker)
  const language = asString(data.language)
  const original = asString(data.original)
  const translation = asString(data.translation)
  const target = asString(data.target_language)
  if (!id || !status || speaker === null || !language || original === null || translation === null || !target) {
    return null
  }
  if (typeof data.ts !== 'number' || !Number.isFinite(data.ts)) return null
  const sessionId = data.session_id
  if (sessionId != null && typeof sessionId !== 'string') return null
  return {
    v: 1,
    type: 'transcript',
    id,
    session_id: typeof sessionId === 'string' ? sessionId : undefined,
    status,
    speaker,
    language,
    original,
    translation,
    target_language: target,
    ts: data.ts,
  }
}
