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
      list.replaceChildren(...panel.finals.map((line) => renderLine(doc, line, false)))
      empty.hidden = panel.finals.length > 0 || panel.caption !== null
      renderCaption(doc, caption, panel.caption)
      const finals = panel.finals.length
      count.textContent =
        panel.packets > 0 ? `${panel.packets} packets · ${finals} final lines` : 'No packets yet'
      const hasFinals = finals > 0
      copy.disabled = !hasFinals
      save.disabled = !hasFinals
      if (panel.finals.length > 0) {
        body.scrollTop = body.scrollHeight
      }
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
