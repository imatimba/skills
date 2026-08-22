# Audio API Reference

Tab audio control — **Tampermonkey-only experimental API**. Violentmonkey, Greasemonkey, and the Safari Userscripts app do not implement any `GM_audio`/`GM.audio` surface (verified against their official API docs). For portable scripts, use the fallback in [Portable Alternatives](#portable-alternatives).

---

## Overview

`GM_audio` (Tampermonkey **beta 5.3.6230**, stable **5.4**+) lets a userscript:

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
| `isMuted` | boolean | Whether the tab is currently muted |
| `muteReason` | string | Why it was muted: `user` \| `capture` \| `extension` |
| `isAudible` | boolean | Whether the tab is currently playing sound |

> The mute-reason enum mirrors Chrome's `tabs.MutedInfoReason` values (`user`, `capture`, `extension`) — treat it as Tampermonkey's mapping of that browser concept.

---

## GM_audio.addStateChangeListener(listener, callback?) / removeStateChangeListener(listener, callback?)

Register/remove an audio-state-change listener.

```javascript
// @grant GM_audio

function audioListener(event) {
  // Event shape below is UNVERIFIED against official docs — log it once to confirm
  // before depending on specific fields:
  if ("muted" in event) console.log(event.muted ? "muted" : "unmuted");
  if ("audible" in event) console.log("audible:", event.audible);
}

GM_audio.addStateChangeListener(audioListener);

// Later:
GM_audio.removeStateChangeListener(audioListener);
```

Promise forms (`await GM.audio.addStateChangeListener(...)` / `removeStateChangeListener(...)`) exist under `@grant GM.audio`. The exact event object fields are **UNVERIFIED** — feature-detect fields (`"muted" in event`, `"audible" in event`) rather than assuming shapes.

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

The error strings shown in older drafts (`not_supported`, `permission_denied`) are **UNVERIFIED** — no official documentation confirms them. Log the raw error value instead of switching on assumed strings:

```javascript
GM_audio.setMute({ isMuted: true }, (error) => {
  if (error) console.error("setMute failed:", error); // inspect actual value
});
```

---

## Portable Alternatives (all managers)

A userscript cannot mute the *tab* outside Tampermonkey, but it can mute the page's media elements — usually the actual goal:

```javascript
// Works in every manager; re-run after DOM changes or SPA navigation.
function muteAllMediaElements(muted = true) {
  document.querySelectorAll("audio, video").forEach((el) => (el.muted = muted));
}
```

Limitations vs `GM_audio`: does not change the tab's mute icon, misses WebAudio-only playback, and must be re-applied for dynamically inserted elements. See [managers.md](managers.md) §2 for the full support matrix.
