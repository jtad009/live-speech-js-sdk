const STYLE_ID = 'live-speech-sdk-styles'

const CSS = `
.live-speech-panel {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 16rem;
  max-height: 100%;
  height: 100%;
  color: #e8f6f2;
  background: #062422;
  border: 1px solid rgba(232, 246, 242, 0.14);
  border-radius: 12px;
  overflow: hidden;
  font-family: "Source Sans 3", "Segoe UI", sans-serif;
  font-size: 1rem;
  line-height: 1.45;
}
.live-speech-panel *, .live-speech-panel *::before, .live-speech-panel *::after {
  box-sizing: border-box;
}
.live-speech-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem 0.9rem;
  border-bottom: 1px solid rgba(232, 246, 242, 0.14);
}
.live-speech-button {
  appearance: none;
  border: 0;
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.live-speech-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.live-speech-start {
  color: #062422;
  background: #f0b429;
}
.live-speech-ghost {
  color: #e8f6f2;
  background: transparent;
  border: 1px solid rgba(232, 246, 242, 0.28);
}
.live-speech-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.9rem;
}
.live-speech-empty {
  margin: 0;
  color: #b7d7d0;
}
.live-speech-finals {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.live-speech-line {
  margin: 0;
}
.live-speech-meta {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  margin-bottom: 0.15rem;
  color: #b7d7d0;
  font-size: 0.82rem;
}
.live-speech-speaker {
  font-weight: 700;
  color: #f3efe4;
}
.live-speech-text {
  margin: 0;
}
.live-speech-secondary {
  margin: 0.15rem 0 0;
  color: #b7d7d0;
}
.live-speech-caption {
  margin: 0;
  padding: 0.75rem 0.9rem;
  background: #0b3d3a;
  border-top: 1px solid rgba(232, 246, 242, 0.14);
}
.live-speech-caption[hidden] {
  display: none;
}
.live-speech-live {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #f0b429;
}
.live-speech-foot {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.45rem 0.9rem 0.6rem;
  color: #b7d7d0;
  font-size: 0.82rem;
}
.live-speech-notice:empty {
  display: none;
}
`

export function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  doc.head.appendChild(style)
}
