# @live-speech/sdk

JavaScript client for Live Speech captions and the transcript panel. This repository is the SDK a host installs in its meeting page. The agent, the invite API, the API key, and the transcript store live in the Live Speech service. This package never opens that API itself.

The host places a div in the meeting. The SDK paints a caption strip and the finished lines into that div. It can also show a **Start captions** button. The button does not invite the agent by itself. It calls a function the host passed in, and that function calls the host backend. The backend holds `LIVE_SPEECH_API_KEY` and is the only place that calls `POST /api/v1/meetings/{room}/invite`. A key in the browser can be copied by anyone in the meeting and used to invite other rooms, so the SDK does not accept one.

Spoken text stays in the browser. The SDK does not post lines to the host application server, and it does not download the Word file. Copy and Save build a text file from the finals already on the page.

## Install and call

The package is not on npm yet. A host can install this Git repository. `npm install` runs `prepare`, which compiles `dist/index.js` and `dist/index.d.ts`. `exports` points at those files. They are not committed. An install that skips `prepare` leaves the import path unresolved.

Two ways to use it:

- `LiveSpeech.attach` listens to a LiveKit room and paints the panel. This is the call for a meeting page.
- `createTranscript` and `parseTranscript` apply the same packet rules with no DOM. Use these when the host draws its own captions.

```ts
import { LiveSpeech } from '@live-speech/sdk'

// Call before room.connect(). LiveKit does not buffer data packets, so a
// listener added later misses the replay of lines spoken before this page joined.
const speech = LiveSpeech.attach(room, {
  element: document.querySelector('#live-speech'),
  locale: navigator.language,
  canInvite: isModerator,
  invite: () =>
    fetch('/api/live-speech/invite', { method: 'POST' }).then((response) => response.json()),
})

await room.connect(url, token)
```

`/api/live-speech/invite` is the host's route, not a Live Speech route. It adds the API key, calls Live Speech with the room id, and returns JSON that includes `session_id`. The SDK reads `session_id` and ignores every other field.

`room` is the LiveKit room the page is already creating. The SDK does not construct a room, does not fetch a token, and does not connect. It only needs `on('dataReceived')` and `off('dataReceived')`, so it is not pinned to one `livekit-client` version.

Call `speech.stop()` when the view leaves the meeting. That removes the data listener and the panel. It does not disconnect LiveKit, and it does not ask the worker to leave.

## When to attach

Attach before `room.connect()`.

The worker stores each final, then publishes it on the data topic. When a participant becomes able to receive data, the worker replays that session's finals to that participant only. LiveKit does not keep those packets for a subscriber who did not exist yet. A listener registered after the replay has nothing to catch up on. Later live packets still arrive.

`room.state` of `connected`, `reconnecting`, or `signalReconnecting` means that replay may already have been sent. `attach` still listens, and it writes one console warning. `connecting` is in time, because the worker has not yet been told this participant can receive data. A room object that does not expose `state` does not warn.

If the invite turned transcription storage off, there is nothing to replay. The panel shows only finals that arrive while the page is listening.

## What the panel does

The host element is emptied and replaced by the panel. Give `attach` an empty div that the meeting layout already sized.

The panel shows:

- **Start captions**, only when `canInvite` is true and `invite` is a function. The host decides who that is. A viewer who must not invite the agent passes `canInvite: false`, and the button is not rendered.
- The finished lines, in spoken order, with the speaker and the wording chosen for this viewer.
- A caption strip for the interim line. Interims are not kept in the list.
- Copy and Save text. Both stay disabled until there is at least one final. Copy writes `speech.text()` to the clipboard and, when the browser blocks it, shows "Copy was blocked by the browser." Save downloads `transcript.txt` built in the page. Each final is the speaker, the original, and the translation.

While `invite` is running the button reads "Starting…" and ignores further clicks. A resolved result with a non-empty `session_id` shows "Captions started." A resolved result without one shows "The invite did not start a session." A rejection shows the error message. The button can be pressed again after the call finishes. A second invite mints a new session on the server. The panel does not clear at the click. It clears when the first packet of that new session arrives, so a failed invite cannot wipe the lines already on screen.

## How a packet is applied

The worker publishes JSON on LiveKit topic `live-speech`. Any other topic is ignored. The payload must be a version 1 transcript:

- `v` is `1` and `type` is `"transcript"`.
- `id`, `status`, `speaker`, `language`, `original`, `translation`, `target_language`, and a finite `ts` are present.
- `status` is `interim` or `final`.
- `session_id` is a string, `null`, or absent.

Anything else is dropped, including `meeting_status`, invalid JSON, and a transcript with a non-string `session_id`. Dropped payloads do not change the panel and do not increment the packet count. Spoken text is not written to the console.

For an accepted packet:

- A new non-empty `session_id` clears the caption, the finals, and the packet count before the packet is displayed. This happens even when that packet is an interim, so the previous meeting cannot remain on screen, in Copy, or in Save.
- The packet that opens a session counts as packet 1.
- The same session keeps its finals.
- An interim replaces the caption strip and is not added to the list.
- A final is kept. The same `id` replaces that line instead of adding a second copy. A replay uses the original id, so a late joiner does not see duplicates.
- Finals are ordered by the number in `live-N` or `mock-N`. `live-2` stays ahead of `live-10`. The order is the order the phrase was heard, not the order the translation finished. An id without that shape sorts last.

The viewer's locale decides which wording is the main line. Only the primary language is compared, so `en-GB` matches `en`. The translation is the line when `target_language` is the viewer's language and the speaker's is not. A Dutch line translated into English stays Dutch for a French reader, with the English kept as the secondary line. The original is the line when the viewer speaks it, when the translation is empty, or when that translation is for a different language. Copy and Save still include both wordings.

The panel follows the latest line while the reader is at the bottom. Scrolling up to read earlier finals keeps that position through later interims. A new `session_id` replaces the list and brings the new session into view.

## A host that draws its own captions

Skip the div and apply packets yourself. The rules above are the same.

```ts
import { createTranscript, parseTranscript } from '@live-speech/sdk'

const speech = createTranscript(navigator.language)

room.on('dataReceived', (payload, _participant, _kind, topic) => {
  if (topic !== 'live-speech') return
  const packet = parseTranscript(payload)
  if (!packet) return
  speech.apply(packet)
})
```

Register that listener before `room.connect()` for the same replay reason. `speech.state.caption` is the interim line. `speech.state.finals` is the transcript, already ordered. `speech.state.sessionId` is the session on screen. `speech.state.packets` counts accepted packets for that session. `speech.text()` is the Copy and Save body.

## What this package does not do

- It does not contain `LIVE_SPEECH_API_KEY`, and it does not call the Live Speech invite API.
- It does not join LiveKit. The host page does.
- It does not open the Live Speech socket. That socket is the transport for a meeting system that cannot carry a data packet. Licode is the first case, and neither the socket nor the Licode connector is built. LiveKit meetings do not use it.
- It does not ship a meeting screen. `web/` in the Live Speech service is a demo of this behavior, not the product a participant uses.
