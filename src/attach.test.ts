// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { attach } from './attach.js'
import { LATE_ATTACH_WARNING, type CaptionRoom, type DataReceivedListener } from './room.js'
import { isNearBottom, shouldFollowLiveUpdate } from './view.js'
import type { TranscriptPayload } from './types.js'

class FakeRoom implements CaptionRoom {
  state?: string
  readonly listeners = new Set<DataReceivedListener>()

  on(_event: 'dataReceived', listener: DataReceivedListener): void {
    this.listeners.add(listener)
  }

  off(_event: 'dataReceived', listener: DataReceivedListener): void {
    this.listeners.delete(listener)
  }

  emit(payload: unknown, topic?: string): void {
    const bytes = new TextEncoder().encode(JSON.stringify(payload))
    for (const listener of this.listeners) listener(bytes, undefined, undefined, topic)
  }
}

function packet(
  id: string,
  status: TranscriptPayload['status'],
  original: string,
  sessionId: string,
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

function mount(): HTMLDivElement {
  const element = document.createElement('div')
  document.body.appendChild(element)
  return element
}

describe('LiveSpeech.attach', () => {
  afterEach(() => {
    document.body.replaceChildren()
    document.getElementById('live-speech-sdk-styles')?.remove()
  })

  it('paints finals in spoken order and keeps the interim on the caption strip', () => {
    const room = new FakeRoom()
    const element = mount()
    const speech = attach(room, { element, locale: 'en' })

    room.emit(packet('live-2', 'final', 'second', 'ses_a'), 'live-speech')
    room.emit(packet('live-1', 'interim', 'first', 'ses_a'), 'live-speech')
    room.emit(packet('live-1', 'final', 'first', 'ses_a'), 'live-speech')

    const ids = [...element.querySelectorAll('.live-speech-line')].map((node) =>
      node instanceof HTMLElement ? node.dataset.id : undefined,
    )
    expect(ids.filter(Boolean)).toEqual(['live-1', 'live-2'])
    expect(element.querySelector('[data-live-speech="caption"]')?.textContent).not.toContain('first')
    expect(speech.state.finals.map((line) => line.text)).toEqual(['en:first', 'en:second'])
    expect(element.querySelector('[data-live-speech="count"]')?.textContent).toBe(
      '3 packets · 2 final lines',
    )
    speech.stop()
  })

  it('ignores other topics and packets that are not transcripts', () => {
    const room = new FakeRoom()
    const element = mount()
    const speech = attach(room, { element })

    room.emit({ v: 1, type: 'meeting_status' }, 'live-speech')
    room.emit(packet('live-1', 'final', 'hello', 'ses_a'), 'chat')
    room.emit('not-json', 'live-speech')

    expect(speech.state.packets).toBe(0)
    expect(element.querySelectorAll('li')).toHaveLength(0)
    speech.stop()
  })

  it('clears the list when a packet names a new session', () => {
    const room = new FakeRoom()
    const element = mount()
    const speech = attach(room, { element, locale: 'en' })

    room.emit(packet('live-1', 'final', 'one', 'ses_a'), 'live-speech')
    room.emit(packet('live-1', 'interim', 'next', 'ses_b'), 'live-speech')

    expect(element.querySelectorAll('li')).toHaveLength(0)
    expect(element.querySelector('[data-live-speech="caption"]')?.textContent).toContain('en:next')
    expect(speech.state.packets).toBe(1)
    speech.stop()
  })

  it('calls the host invite function and never sends an API key', async () => {
    const room = new FakeRoom()
    const element = mount()
    let release: (value: { session_id: string }) => void = () => {}
    const invite = vi.fn(
      () =>
        new Promise<{ session_id: string }>((resolve) => {
          release = resolve
        }),
    )
    const speech = attach(room, { element, canInvite: true, invite })
    const button = element.querySelector<HTMLButtonElement>('[data-live-speech="start"]')
    expect(button?.textContent).toBe('Start captions')

    button?.click()
    button?.click()
    expect(invite).toHaveBeenCalledTimes(1)
    expect(button?.disabled).toBe(true)
    expect(button?.textContent).toBe('Starting…')

    release({ session_id: 'ses_new' })
    await vi.waitFor(() => expect(button?.disabled).toBe(false))
    expect(element.querySelector('[data-live-speech="notice"]')?.textContent).toBe('Captions started.')
    expect(JSON.stringify(invite.mock.calls)).not.toContain('LIVE_SPEECH_API_KEY')
    speech.stop()
  })

  it('hides the start button when the host does not allow an invite', () => {
    const element = mount()
    const speech = attach(new FakeRoom(), {
      element,
      canInvite: false,
      invite: () => Promise.resolve({ session_id: 'ses_hidden' }),
    })
    expect(element.querySelector('[data-live-speech="start"]')).toBeNull()
    speech.stop()
  })

  it('reports an invite that does not return a session', async () => {
    const element = mount()
    const speech = attach(new FakeRoom(), {
      element,
      canInvite: true,
      invite: () => Promise.resolve({}),
    })
    element.querySelector<HTMLButtonElement>('[data-live-speech="start"]')?.click()
    await vi.waitFor(() =>
      expect(element.querySelector('[data-live-speech="notice"]')?.textContent).toBe(
        'The invite did not start a session.',
      ),
    )
    speech.stop()
  })

  it('warns when the room is already connected', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const room = new FakeRoom()
    room.state = 'connected'
    const speech = attach(room, { element: mount() })
    expect(warn).toHaveBeenCalledWith(LATE_ATTACH_WARNING)
    speech.stop()
    warn.mockRestore()
  })

  it('stops listening when the handle is stopped', () => {
    const room = new FakeRoom()
    const element = mount()
    const speech = attach(room, { element })
    speech.stop()
    room.emit(packet('live-1', 'final', 'after', 'ses_a'), 'live-speech')
    expect(speech.state.packets).toBe(0)
    expect(element.childElementCount).toBe(0)
  })

  it('copies the finals from the page', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    const room = new FakeRoom()
    const element = mount()
    const speech = attach(room, { element, locale: 'nl' })
    room.emit(packet('live-1', 'final', 'Goedemorgen', 'ses_a'), 'live-speech')

    element.querySelector<HTMLButtonElement>('[data-live-speech="copy"]')?.click()
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0]?.[0]).toContain('Sofia')
    expect(writeText.mock.calls[0]?.[0]).toContain('Goedemorgen')
    speech.stop()
  })

  it('does not pull the reader to the bottom while they are reading earlier lines', () => {
    const room = new FakeRoom()
    const element = mount()
    const speech = attach(room, { element, locale: 'en' })
    room.emit(packet('live-1', 'final', 'first', 'ses_a'), 'live-speech')

    const body = element.querySelector<HTMLElement>('.live-speech-body')
    expect(body).not.toBeNull()
    Object.defineProperty(body, 'scrollHeight', { configurable: true, get: () => 800 })
    Object.defineProperty(body, 'clientHeight', { configurable: true, get: () => 200 })
    body!.scrollTop = 40

    room.emit(packet('live-2', 'interim', 'still talking', 'ses_a'), 'live-speech')
    expect(body!.scrollTop).toBe(40)

    room.emit(packet('live-2', 'interim', 'next meeting', 'ses_b'), 'live-speech')
    expect(body!.scrollTop).toBe(800)
    speech.stop()
  })
})

describe('scroll position', () => {
  it('follows live lines only from the bottom, and always when a session opens', () => {
    expect(shouldFollowLiveUpdate(true, false)).toBe(true)
    expect(shouldFollowLiveUpdate(false, false)).toBe(false)
    expect(shouldFollowLiveUpdate(false, true)).toBe(true)
  })

  it('treats a short list as already at the bottom', () => {
    const element = document.createElement('div')
    Object.defineProperty(element, 'scrollHeight', { configurable: true, get: () => 120 })
    Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => 200 })
    element.scrollTop = 0
    expect(isNearBottom(element)).toBe(true)
  })
})
