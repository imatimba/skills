# Audio API Reference

Tab audio control — **Tampermonkey-only experimental API** *(verified 2026-08-25 — tampermonkey.net/changelog.php v5.4.0 Experimental, tampermonkey.net/documentation.php?q=GM_audio)*. Violentmonkey, Greasemonkey, and the Safari Userscripts app do not implement any `GM_audio`/`GM.audio` surface *(verified 2026-08-25 — violentmonkey.github.io/api/gm/ absence; wiki.greasespot.net/Greasemonkey_Manual:API absence)*. For portable scripts, use the fallback in [Portable Alternatives](#portable-alternatives).

---

## Overview

`GM_audio` (Tampermonkey **beta 5.4.6230** *(verified 2026-08-25 — tampermonkey.net/changelog.php beta v5.4.6230 2025-08-20 Experimental)*, stable **5.4.0** *(verified 2026-08-25 — tampermonkey.net/changelog.php v5.4.0 2025-09-15 Experimental)*+) lets a userscript:

- Mute/unmute **the current tab only** (inter-tab control is not supported — Tampermonkey issue #2472)
- Check whether the tab is currently audible
- Monitor audio-state changes

**Required grant** (both spellings are documented by Tampermonkey):

```javascript
// @grant GM_audio
// or: @grant GM.audio
```

**Feature-detect before use** — the API must degrade gracefully everywhere else:

```javascript
const canMuteTab = typeof GM_audio !== "undefined" || typeof GM?.audio !== "undefined";
if (!canMuteTab) {
  // Violentmonkey / Greasemonkey / Safari Userscripts: fall back to element-level muting
}
```

---

## GM_audio.setMute(details, callback?)

Mute or unmute the current tab.

```javascript
// @grant GM_audio

GM_audio.setMute({ isMuted: true }, function (error) {
  if (error) console.error("Failed to mute:", error);
  else console.log("Tab muted");
});
```

Promise form:

```javascript
// @grant GM.audio

await GM.audio.setMute({ isMuted: true });
```

---

## GM_audio.getState(callback)

Current audio state of the tab.

```javascript
// @grant GM_audio

GM_audio.getState(function (state) {
  if (!state) return console.error("Failed to get audio state");
  console.log(state.isMuted, state.muteReason, state.isAudible);
});

// Promise form
const state = await GM.audio.getState();
```

### State Object Properties

| Property | Type | Description |
|----------|------|-------------|
| `isMuted` | `boolean \| undefined` (optional) | Whether the tab is currently muted |
| `muteReason` | `string \| undefined` (optional — only present when muted) | Why it was muted: `user` \| `capture` \| `extension` |
| `isAudible` | `boolean \| undefined` (optional) | Whether the tab is currently playing sound |

> The mute-reason enum mirrors Chrome's `tabs.MutedInfoReason` values (`user`, `capture`, `extension`) — treat it as Tampermonkey's mapping of that browser concept. *(verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_audio GM_audio.getState muteReason)*

---

## GM_audio.addStateChangeListener(listener, callback?) / removeStateChangeListener(listener, callback?)

Register/remove an audio-state-change listener.

```javascript
// @grant GM_audio

function audioListener(event) {
  // Documented shape (tampermonkey.net GM_audio): { muted?: string | false, audible?: boolean }
  // Fields are optional — check presence before use:
  if ("muted" in event) console.log(event.muted ? "muted by " + event.muted : "unmuted");
  if ("audible" in event) console.log("audible:", event.audible);
}

GM_audio.addStateChangeListener(audioListener);

// Later:
GM_audio.removeStateChangeListener(audioListener);
```

Promise forms (`await GM.audio.addStateChangeListener(...)` / `removeStateChangeListener(...)`) exist under `@grant GM.audio`. Note the listener's field names differ from `getState`'s: the event uses `muted`/`audible`, while `getState` returns `{ isMuted?, muteReason?, isAudible? }`. Keep the presence checks above — all fields are optional in the documented shape.

---

## Common Patterns

### Auto-Mute Tab (Tampermonkey only)

```javascript
// @grant GM_audio

if (typeof GM_audio !== "undefined") GM_audio.setMute({ isMuted: true });
else muteAllMediaElements(); // portable fallback below
```

### Mute Toggle via Menu Command (Tampermonkey only)

```javascript
// @grant GM_audio
// @grant GM_registerMenuCommand

let muted = false;
async function toggleMute() {
  muted = !muted;
  await GM.audio.setMute({ isMuted: muted });
}
GM_registerMenuCommand("Toggle Mute", toggleMute);
```

### Remember Mute Preference

Storage APIs are portable; only the audio calls are Tampermonkey-specific:

```javascript
// @grant GM_audio
// @grant GM.getValue
// @grant GM.setValue

(async () => {
  const wasMuted = await GM.getValue("userMutePreference", false);
  if (typeof GM?.audio?.setMute === "function") await GM.audio.setMute({ isMuted: wasMuted });
})();
```

---

## Error Handling

The error strings shown in older drafts (`not_supported`, `permission_denied`) are **undocumented** — verified against the official Tampermonkey docs, which describe callback/promise errors only as a generic string message with no enumerated values. Log the raw error value instead of switching on assumed strings:

```javascript
GM_audio.setMute({ isMuted: true }, (error) => {
  if (error) console.error("setMute failed:", error); // inspect actual value
});
```

---

## Portable Alternatives (all managers)

A userscript cannot mute the *tab* outside Tampermonkey, but it can mute the page's media elements — usually the actual goal *(verified 2026-08-25 — MDN HTMLMediaElement.muted, HTMLMediaElement.volume; tampermonkey.net/documentation.php?q=GM_audio — GM_audio is Tampermonkey-only, no VM/GM equivalent)*:

```javascript
// Works in every manager; re-run after DOM changes or SPA navigation.
function muteAllMediaElements(muted = true) {
  document.querySelectorAll("audio, video").forEach((el) => (el.muted = muted));
}
```

Limitations vs `GM_audio`: does not change the tab's mute icon, misses WebAudio-only playback, and must be re-applied for dynamically inserted elements. See [managers.md](managers.md) §2 for the full support matrix.

---

## Autoplay Policy (Browser-Enforced)

Browsers block **audible** autoplay until a user gesture; inaudible media (muted, `volume` 0, or no audio track) is exempt. `Permissions-Policy: autoplay` defaults to `self`; blocked `element.play()` rejects with `NotAllowedError` (`DOMException`). `Navigator.getAutoplayPolicy("mediaelement" | "audiocontext" | element/context)` returns `allowed` / `allowed-muted` / `disallowed` (W3C Autoplay Detection Working Draft, verified 2026-08-24). `GM_audio` does **not** bypass this policy — tab-level mute and page autoplay allowance are orthogonal.

Source: MDN `Autoplay guide for media and Web Audio APIs` (developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), W3C `autoplay-detection` (w3.org/TR/autoplay-detection), MDN `Permissions-Policy: autoplay`, `HTMLMediaElement.play()`.

---

## HTMLMediaElement Playback Control

`element.play()` returns `Promise<void>` — handle rejection:

```javascript
// Correct handling of autoplay blocking (verified 2026-08-24 via MDN HTMLMediaElement.play)
element.play().catch((e) => {
  if (e.name === "NotAllowedError") {
    // Autoplay blocked — show a play button or prompt for interaction
  }
});
```

`volume` is `0.0`–`1.0` (`0` effectively muted); `muted` (`boolean`) is independent of `volume`; `defaultMuted` reflects the `muted` attribute only and has no dynamic effect (verified 2026-08-24 via MDN `HTMLMediaElement.volume` / `muted` / `defaultMuted`).

---

## Web Audio Autoplay & State

An `AudioContext` may start `suspended` when autoplay is blocked; resume only after a user activation: `await audioContext.resume()` (verified 2026-08-24). Observe `audioContext.state` (`suspended` | `running` | `closed` | `interrupted`) and `onstatechange`; `suspend()`/`resume()` return `Promise<void>`.

Source: MDN `BaseAudioContext.state`, `AudioContext.resume()`; MDN Autoplay guide (Web Audio API affected by autoplay blocking).

---

## Codec Support & canPlayType

Use `element.canPlayType(mimeString)` → `""` | `"maybe"` | `"probably"` to probe codecs; support varies by browser for `audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/webm`, `audio/mp4` (verified 2026-08-24 via MDN `HTMLMediaElement.canPlayType`, Media type and format guide). Chain fallbacks:

```javascript
const src = audio.canPlayType('audio/ogg; codecs="vorbis"') ? "sound.ogg"
          : audio.canPlayType('audio/mpeg') ? "sound.mp3" : "sound.wav";
```

---

## Web Audio Bridging (MediaElement → Audio Graph)

`AudioContext.createMediaElementSource(mediaEl)` routes an `<audio>`/`<video>` into the Web Audio graph; thereafter control volume via `GainNode` (`gainNode.gain.value = 0` for mute) or suspend the context (`audioContext.suspend()`). This is distinct from `element.muted` — element muting does not affect graph-routed signal if gain is not connected via the element (verified 2026-08-24 via MDN `createMediaElementSource`, `GainNode`).

```javascript
const ctx = new AudioContext();
const src = ctx.createMediaElementSource(document.querySelector("audio"));
const gain = ctx.createGain();
src.connect(gain).connect(ctx.destination);
gain.gain.value = 0; // mute via graph
```

---

## Dynamic Element Handling (MutationObserver)

The portable snippet above must be re-run for SPA navigation. Use `MutationObserver` (Baseline since July 2015, verified 2026-08-24 via MDN `MutationObserver`):

```javascript
function muteAllMediaElements(muted = true) {
  document.querySelectorAll("audio, video").forEach((el) => (el.muted = muted));
}
const observer = new MutationObserver(() => muteAllMediaElements(true));
observer.observe(document.documentElement, { childList: true, subtree: true });
// Later: observer.disconnect();
```

---

## GM_notification Silent Flag (Audio-Adjacent)

`GM_notification({ text, title, silent: true })` suppresses notification sound; `silent: boolean` — `true` = no sound (verified 2026-08-24 via tampermonkey.net/documentation.php?q=GM_notification). Relevant when your script produces audio feedback via notifications:

```javascript
// @grant GM_notification
GM_notification({ text: "Muted", title: "Audio", silent: true, timeout: 2000 });
```

`highlight: boolean` controls tab highlighting; `timeout` auto-closes the notification.

---

## Storage Preference Portability Note

`GM.getValue`/`GM.setValue` are `Promise`-based in Greasemonkey 4+ and Violentmonkey (`GM.*` aliases added VM 2.12.0, verified 2026-08-24 via wiki.greasespot.net/Greasemonkey_Manual:API, violentmonkey.github.io/api/gm/), whereas legacy `GM_getValue`/`GM_setValue` are synchronous. The file's `await GM.getValue` example is correct for modern managers but does not warn about this divergence. For maximal portability, feature-detect:

```javascript
const getVal = typeof GM?.getValue === "function" ? GM.getValue : GM_getValue;
const wasMuted = await getVal("userMutePreference", false);
```

---

## Security: CSP & Permissions-Policy Interaction

- `Content-Security-Policy: media-src` controls where `<audio>`/`<video>` may load from; absent → falls back to `default-src` (verified 2026-08-24 via MDN `CSP: media-src`).
- `Permissions-Policy: autoplay` (default `self`) can block `play()` cross-origin even after a gesture; expect `NotAllowedError` (MDN `Permissions-Policy: autoplay`).
- Cross-origin media without permissive `media-src` + autoplay allowance fails regardless of `GM_audio` state.

---

## Accessibility & UX

Tab muting does not exempt autoplay policy and does not convey state to assistive technology; element-level `muted` is DOM-visible. Do not auto-mute without user consent; expose a toggle (e.g., `GM_registerMenuCommand`) and respect user preferences — consider `prefers-reduced-motion` (`@media (prefers-reduced-motion: reduce)`, Baseline since Jan 2020, verified 2026-08-24 via MDN) for animated audio UIs and avoid unsolicited sound. Use audible indicators sparingly and honor `silent` notifications (see above).
