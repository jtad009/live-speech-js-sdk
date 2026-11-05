# @live-speech/sdk

JavaScript client for Live Speech captions and the transcript panel. This repository is the SDK. The agent, the invite API, and the transcript store live in the Live Speech service.

The package does not hold `LIVE_SPEECH_API_KEY`. A host backend invites the agent. The SDK can call a host `invite` function from a button, then paint the packets that come back.

## What works now

The headless transcript client:

- parses a v1 `transcript` packet and ignores anything else
- clears lines when `session_id` changes, including on an interim
- keeps finals when the same session continues
- replaces a line when the same `id` arrives again
- orders `live-N` and `mock-N` by spoken number, not by arrival time
- restarts the packet count on a new session
- shows the translation when the viewer locale differs from the speaker

```ts
import { createTranscript, parseTranscript } from '@live-speech/sdk'

const speech = createTranscript(navigator.language)
const packet = parseTranscript(raw)
if (packet) speech.apply(packet)
```

`speech.state.caption` is the live line. `speech.state.finals` is the transcript. `speech.text()` is the copy and save body.

## Next

- Attach to a LiveKit `Room` on topic `live-speech` before `room.connect()`.
- Mount the caption strip and the transcript into a host element, with a start button that calls the host's `invite` function.
- Open a Live Speech socket for a `session_id` when the meeting system cannot carry the packet. That ships with the Licode connector.

LiveKit does not buffer data packets. The listener has to be attached before connect so the late-join replay is not missed.
