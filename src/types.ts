export type UtteranceStatus = 'interim' | 'final'

/** Packet published on topic `live-speech` or on a Live Speech socket. */
export interface TranscriptPayload {
  v: 1
  type: 'transcript'
  id: string
  session_id?: string | null
  status: UtteranceStatus
  speaker: string
  language: string
  original: string
  translation: string
  target_language: string
  ts: number
}

export interface TranscriptLine {
  id: string
  speaker: string
  language: string
  original: string
  translation: string
  text: string
  secondary?: string
  ts: number
}

export interface TranscriptPanel {
  sessionId: string | null
  finals: TranscriptLine[]
  caption: TranscriptLine | null
  packets: number
}
