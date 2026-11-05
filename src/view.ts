import { ensureStyles } from './styles.js'
import type { TranscriptLine, TranscriptPanel } from './types.js'

export interface PanelView {
  setPending(pending: boolean): void
  setNotice(message: string): void
  render(panel: TranscriptPanel): void
  destroy(): void
}

export interface PanelActions {
  canInvite: boolean
  onInvite: () => void
  onCopy: () => void
  onSave: () => void
}

/** How close to the bottom still counts as following the live caption, in pixels. */
const BOTTOM_SLACK_PX = 32

/**
 * Keep the latest line in view only when the reader has not moved away from it,
 * or when a new session has replaced the list they were reading.
 *
 * Interims arrive many times a second. Forcing the scroll on each one makes
 * earlier finals unreachable. A session change is the exception: the old
 * meeting is gone, and the new one should start in view.
 */
export function shouldFollowLiveUpdate(wasAtBottom: boolean, sessionOpened: boolean): boolean {
  return wasAtBottom || sessionOpened
}

/** True when the reader is at the bottom, or the list is too short to scroll. */
export function isNearBottom(element: HTMLElement, slack = BOTTOM_SLACK_PX): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= slack
}

export function mountPanel(element: HTMLElement, actions: PanelActions): PanelView {
  const doc = element.ownerDocument
  ensureStyles(doc)

  const root = doc.createElement('div')
  root.className = 'live-speech-panel'
  root.dataset.liveSpeech = 'panel'

  const toolbar = doc.createElement('div')
  toolbar.className = 'live-speech-toolbar'

  let start: HTMLButtonElement | null = null
  if (actions.canInvite) {
    start = doc.createElement('button')
    start.type = 'button'
    start.className = 'live-speech-button live-speech-start'
    start.dataset.liveSpeech = 'start'
    start.textContent = 'Start captions'
    start.addEventListener('click', actions.onInvite)
    toolbar.appendChild(start)
  }

  const copy = doc.createElement('button')
  copy.type = 'button'
  copy.className = 'live-speech-button live-speech-ghost'
  copy.dataset.liveSpeech = 'copy'
  copy.textContent = 'Copy'
  copy.disabled = true
  copy.addEventListener('click', actions.onCopy)

  const save = doc.createElement('button')
  save.type = 'button'
  save.className = 'live-speech-button live-speech-ghost'
  save.dataset.liveSpeech = 'save'
  save.textContent = 'Save text'
  save.disabled = true
  save.addEventListener('click', actions.onSave)

  toolbar.append(copy, save)

  const body = doc.createElement('div')
  body.className = 'live-speech-body'

  const empty = doc.createElement('p')
  empty.className = 'live-speech-empty'
  empty.dataset.liveSpeech = 'empty'
  empty.textContent = 'Captions will appear here.'

  const list = doc.createElement('ol')
  list.className = 'live-speech-finals'
  list.dataset.liveSpeech = 'finals'
  body.append(empty, list)

  const caption = doc.createElement('div')
  caption.className = 'live-speech-caption'
  caption.dataset.liveSpeech = 'caption'
  caption.setAttribute('aria-live', 'polite')
  caption.hidden = true

  const foot = doc.createElement('div')
  foot.className = 'live-speech-foot'
  const count = doc.createElement('span')
  count.dataset.liveSpeech = 'count'
  count.textContent = 'No packets yet'
  const notice = doc.createElement('span')
  notice.className = 'live-speech-notice'
  notice.dataset.liveSpeech = 'notice'
  notice.setAttribute('aria-live', 'polite')
  foot.append(count, notice)

  root.append(toolbar, body, caption, foot)
  element.replaceChildren(root)
  let seenSession: string | null = null

  return {
    setPending(pending: boolean) {
      if (!start) return
      start.disabled = pending
      start.textContent = pending ? 'Starting…' : 'Start captions'
    },
    setNotice(message: string) {
      notice.textContent = message
    },
    render(panel: TranscriptPanel) {
      const sessionOpened = panel.sessionId !== seenSession
      const follow = shouldFollowLiveUpdate(isNearBottom(body), sessionOpened)
      seenSession = panel.sessionId
      list.replaceChildren(...panel.finals.map((line) => renderLine(doc, line, false)))
      empty.hidden = panel.finals.length > 0 || panel.caption !== null
      renderCaption(doc, caption, panel.caption)
      const finals = panel.finals.length
      count.textContent =
        panel.packets > 0 ? `${panel.packets} packets · ${finals} final lines` : 'No packets yet'
      const hasFinals = finals > 0
      copy.disabled = !hasFinals
      save.disabled = !hasFinals
      if (follow) body.scrollTop = body.scrollHeight
    },
    destroy() {
      if (start) start.removeEventListener('click', actions.onInvite)
      copy.removeEventListener('click', actions.onCopy)
      save.removeEventListener('click', actions.onSave)
      root.remove()
    },
  }
}

function renderCaption(doc: Document, caption: HTMLElement, line: TranscriptLine | null): void {
  caption.replaceChildren()
  if (!line) {
    caption.hidden = true
    return
  }
  caption.hidden = false
  caption.append(renderLine(doc, line, true))
}

function renderLine(doc: Document, line: TranscriptLine, live: boolean): HTMLElement {
  const item = doc.createElement(live ? 'div' : 'li')
  item.className = 'live-speech-line'
  if (!live) item.dataset.id = line.id

  const meta = doc.createElement('div')
  meta.className = 'live-speech-meta'
  const speaker = doc.createElement('span')
  speaker.className = 'live-speech-speaker'
  speaker.textContent = line.speaker
  meta.appendChild(speaker)
  if (live) {
    const tag = doc.createElement('span')
    tag.className = 'live-speech-live'
    tag.textContent = 'live'
    meta.appendChild(tag)
  } else {
    const lang = doc.createElement('span')
    lang.textContent = line.language
    meta.appendChild(lang)
  }

  const text = doc.createElement('p')
  text.className = 'live-speech-text'
  text.textContent = line.text

  item.append(meta, text)
  if (line.secondary) {
    const secondary = doc.createElement('p')
    secondary.className = 'live-speech-secondary'
    secondary.textContent = line.secondary
    item.appendChild(secondary)
  }
  return item
}
