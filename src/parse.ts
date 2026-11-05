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

/** Accept a v1 transcript packet. Anything else is ignored. */
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
