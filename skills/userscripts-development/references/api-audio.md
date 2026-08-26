# Audio API Reference

Tab audio control — **Tampermonkey-only experimental API** *(verified 2026-08-25 — tampermonkey.net/changelog.php v5.4.0 Experimental, tampermonkey.net/documentation.php?q=GM_audio)*. Violentmonkey, Greasemonkey, and the Safari Userscripts app do not implement any `GM_audio`/`GM.audio` surface *(verified 2026-08-25 — violentmonkey.github.io/api/gm/ absence; wiki.greasespot.net/Greasemonkey_Manual:API absence)*. For portable scripts, use the fallback in [Portable Alternatives](#portable-alternatives-all-managers).

> **Portability note:** `GM_audio` is TM-only — not part of the portable subset. The portable fallback below (element-level muting via `HTMLMediaElement.muted` / `volume`) works in every manager. If tab-level mute is central to your script (not optional enhancement), a native MV3 browser extension is the better tool. Userscripts are for portable page augmentation.

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
