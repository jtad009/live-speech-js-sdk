import { describe, expect, it } from 'vitest'
import { createTranscript } from './client.js'
import { parseTranscript } from './parse.js'
import type { TranscriptPayload } from './types.js'

function packet(
  id: string,
  status: TranscriptPayload['status'],
  original: string,
  sessionId: string | null = 'ses_a',
): TranscriptPayload {
  return {
    v: 1,
    type: 'transcript',
    id,
    session_id: sessionId,
    status,
    speaker: 'Sofia',
    language: 'nl',
    original,
    translation: `en:${original}`,
    target_language: 'en',
    ts: 1_730_000_000,
  }
}

describe('createTranscript', () => {
  it('keeps finals for the same session and replaces a repeated id', () => {
    const client = createTranscript('en')
    client.apply(packet('live-1', 'interim', 'Goedemorgen'))
    client.apply(packet('live-1', 'final', 'Goedemorgen'))
    client.apply(packet('live-2', 'final', 'later'))
    client.apply(packet('live-1', 'final', 'Goedemorgen allemaal'))

    expect(client.state.caption).toBeNull()
    expect(client.state.finals.map((line) => line.original)).toEqual([
      'Goedemorgen allemaal',
      'later',
    ])
    expect(client.state.packets).toBe(4)
    expect(client.state.finals[0]?.text).toBe('en:Goedemorgen allemaal')
  })

  it('clears finals and restarts the packet count when the session changes', () => {
    const client = createTranscript('en')
    client.apply(packet('live-1', 'final', 'one'))
    client.apply(packet('live-2', 'final', 'two'))
    client.apply(packet('live-1', 'interim', 'next', 'ses_b'))

    expect(client.state.sessionId).toBe('ses_b')
    expect(client.state.finals).toEqual([])
    expect(client.state.caption?.original).toBe('next')
    expect(client.state.packets).toBe(1)
  })

  it('orders a later translation behind the earlier utterance', () => {
    const client = createTranscript('nl')
    client.apply(packet('live-2', 'final', 'second'))
    client.apply(packet('live-1', 'final', 'first'))
    expect(client.state.finals.map((line) => line.id)).toEqual(['live-1', 'live-2'])
    expect(client.state.finals[0]?.text).toBe('first')
  })
})

describe('parseTranscript', () => {
  it('accepts a v1 transcript and ignores other packets', () => {
    const raw = JSON.stringify(packet('live-3', 'final', 'hello'))
    expect(parseTranscript(raw)?.id).toBe('live-3')
    expect(parseTranscript('{"v":1,"type":"meeting_status"}')).toBeNull()
    expect(parseTranscript('not-json')).toBeNull()
    expect(parseTranscript(new TextEncoder().encode(raw))?.session_id).toBe('ses_a')
  })
})
