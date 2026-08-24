# DOM and UI API Reference

Documentation for DOM manipulation and UI-related functions. **Canonical reference for `GM_addStyle` and `GM_addElement` — `api-sync.md` contains only a summary and links here.**

---

## Decision table

| Need | Use | Notes |
| --- | --- | --- |
| Inject CSS | `GM_addStyle(css)` / `GM.addStyle(css)` | Portable style injection; prefer over manual `<style>` where supported (see support matrix below). |
| Inject element that may be blocked by CSP (script/style/link) | `GM_addElement(tag, attrs)` / `GM_addElement(parent, tag, attrs)` — Tampermonkey & Violentmonkey only | Tampermonkey: best-effort CSP-header relaxation (not universal, Firefox may need header-modifying extension); Violentmonkey respects page CSP and falls back to content-world injection (`@inject-into auto`). Greasemonkey #2484 & Safari: not supported — fall back to `document.createElement`. |
| Read or call page JavaScript variables/functions | `unsafeWindow` | **Not available in Safari "Userscripts" app at all**; grant matrix below. If you only manipulate DOM, use `document` instead. |

Source of truth: `managers.md` §2 DOM & UI, §4 Sandbox/Injection. Cross-reference: `browser-compatibility.md`.

---

## unsafeWindow

Access the page's actual `window` object, bypassing the sandbox.

### Availability and grant matrix

| Manager | `unsafeWindow` available? | Grant behaviour |
| --- | --- | --- |
| Tampermonkey | ✅ | Needs explicit `// @grant unsafeWindow` **when any other `@grant` is present**; otherwise check `GM_info.sandboxMode`. |
| Violentmonkey | ✅ exposed without grant | Exposed even without grant; sandbox is **off only with `// @grant none`** (since Violentmonkey 2.32) — any other grant keeps minimal sandbox (`GM_info` + `unsafeWindow` only). |
| Greasemonkey 4+ | ✅ (`window.wrappedJSObject` equivalent via Xray) | Exposed; Firefox Xray — use `cloneInto`/`exportFunction` to share objects/functions (see `browser-compatibility.md`). |
| Safari "Userscripts" app | ❌ **none at all** | Any `@grant` forces content-world execution; page-world access is impossible — design without `unsafeWindow` on Safari (see `managers.md` §2, §4). |

> **Violentmonkey worked example:** create a script with `// @grant unsafeWindow` and `// @match https://example.com/*`, open Violentmonkey Dashboard → your script → Editor, add `console.log(unsafeWindow === window, unsafeWindow.pageVar)`, save, reload the page, and inspect the console — `unsafeWindow` points at the page world even where `window` is the isolated sandbox.

```javascript
// @grant unsafeWindow

// Access page variables
const config = unsafeWindow.pageConfig;
const userData = unsafeWindow.APP.user;

// Call page functions
unsafeWindow.showModal('Hello from userscript!');
unsafeWindow.analytics.track('userscript_loaded');

// Modify page globals
unsafeWindow.DEBUG_MODE = true;
unsafeWindow.featureFlags.newUI = true;

// Listen to page events
unsafeWindow.addEventListener('customEvent', (e) => {
    console.log('Page event:', e.detail);
});
```

### When to Use unsafeWindow

| Scenario | Use unsafeWindow? |
|----------|-------------------|
| Read page JavaScript variables | Yes (not Safari) |
| Call page-defined functions | Yes (not Safari) |
| Access page's jQuery/React/Vue | Yes (not Safari) |
| DOM manipulation | No (use `document`) |
| Add event listeners to elements | No |
| Create/modify elements | No |

Requires `unsafeWindow` — on Safari, this pattern is impossible; use DOM-only alternatives or `GM_addElement` fallbacks.

### Security Considerations

```javascript
// Safe — reading data
const token = unsafeWindow.authToken;

// Dangerous — executing untrusted code
// unsafeWindow.eval(userInput);  // DON'T DO THIS

// Be careful with callbacks — runs in page context
unsafeWindow.someFunction({
    callback: function() {
        // This runs in page context — be careful!
    }
});

// Firefox Xray sharing (Greasemonkey / Violentmonkey on Firefox)
if (typeof cloneInto !== 'undefined') {
    unsafeWindow.myData = cloneInto({ count: 42 }, unsafeWindow, { cloneFunctions: true });
}
if (typeof exportFunction !== 'undefined') {
    unsafeWindow.myFunc = exportFunction(() => console.log('from userscript'), unsafeWindow);
}
```

---

## GM_addStyle(css)

Add CSS styles to the document. Useful for customising page appearance. **Canonical reference — `api-sync.md` links here.**

### Support matrix

| Manager | Sync `GM_addStyle(css)` | Promise `GM.addStyle(css)` | Notes |
| --- | --- | --- | --- |
| Tampermonkey | ✅ returns `<style>` | ✅ | Full support. |
| Violentmonkey | ✅ returns `<style>` | ✅ since 2.12.0 | Full support. |
| Greasemonkey 4+ | ❌ removed | ❌ polyfill only (`gm4-polyfill.js`) | Provide fallback via `document.createElement('style')`. |
| Safari "Userscripts" | ❌ deprecated | ✅ partial impl | Limited; test before relying. |

```javascript
// @grant GM_addStyle

// Basic styling
GM_addStyle(`
    .my-class {
        background: #f0f0f0;
        padding: 10px;
        border-radius: 5px;
    }
`);

// Hide elements
GM_addStyle(`
    #annoying-banner,
    .popup-overlay,
    .cookie-notice {
        display: none !important;
    }
`);

// Dark mode
GM_addStyle(`
    body {
        background-color: #1a1a1a !important;
        color: #e0e0e0 !important;
    }

    a {
        color: #6db3f2 !important;
    }

    img {
        filter: brightness(0.9);
    }
`);

// Returns the style element
const styleEl = GM_addStyle('body { font-size: 16px; }');
console.log('Style element:', styleEl);

// Promise form
await GM.addStyle('body { font-size: 16px; }');

// Fallback for managers without support
function addStyleFallback(css) {
    if (typeof GM_addStyle !== 'undefined') return GM_addStyle(css);
    if (typeof GM !== 'undefined' && typeof GM.addStyle === 'function') return GM.addStyle(css);
    const el = document.createElement('style');
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el); // VM auto-parents style into head
    return el;
}
```

### Dynamic Styles

```javascript
// Toggle styles
let darkModeStyle = null;

function toggleDarkMode() {
    if (darkModeStyle) {
        darkModeStyle.remove();
        darkModeStyle = null;
    } else {
        darkModeStyle = GM_addStyle(`
            body { background: #1a1a1a; color: #fff; }
        `);
    }
}

GM_registerMenuCommand('Toggle Dark Mode', toggleDarkMode);
```

---

## GM_addElement(tag_name, attributes)
## GM_addElement(parent_node, tag_name, attributes)

Create and inject HTML elements. **Canonical reference — `api-sync.md` links here.**

### Support matrix

| Manager | Sync `GM_addElement` | Promise `GM.addElement` | Notes |
| --- | --- | --- | --- |
| Tampermonkey | ✅ returns element (since Tampermonkey 5.5.0) | ✅ | CSP bypass supported (best-effort header relaxation; do not rely on universal bypass). |
| Violentmonkey | ✅ sync | ✅ since Violentmonkey 2.13.1 | Supports both sync and async; **respects page CSP** — if page CSP blocks page-world injection, Violentmonkey falls back to content-world injection (no stripping). |
| Greasemonkey 4+ | ❌ (issue #2484) | ❌ | Not supported — use `document.createElement` fallback. |
| Safari "Userscripts" | ❌ | ❌ | Not supported. |

> **CSP:** `GM_addElement` helps bypass strict CSP **only in Tampermonkey and Violentmonkey**, and even there it is not universal. Violentmonkey explicitly respects page CSP and degrades to content-world injection if page injection fails (see `managers.md` §4). **Do not promise universal CSP bypass** — always provide a `document.createElement` fallback.

### Add Script

```javascript
// @grant GM_addElement

// Inline script
GM_addElement('script', {
    textContent: `
        window.myGlobal = 'injected';
        console.log('Script injected!');
    `
});

// External script
GM_addElement('script', {
    src: 'https://example.com/library.js',
    type: 'text/javascript'
});

// Module script
GM_addElement('script', {
    src: 'https://example.com/module.mjs',
    type: 'module'
});

// Promise form
await GM.addElement('script', { textContent: 'console.log("via promise")' });
```

### Add Styles

```javascript
// Inline styles
GM_addElement('style', {
    textContent: `
        body { font-family: Arial; }
        .highlight { background: yellow; }
    `
});

// External stylesheet
GM_addElement('link', {
    rel: 'stylesheet',
    href: 'https://example.com/style.css'
});
```

### Add to Specific Parent

```javascript
// Add to body
GM_addElement(document.body, 'div', {
    id: 'my-container',
    className: 'userscript-ui'
});

// Add to specific element
const container = document.querySelector('#main');
GM_addElement(container, 'button', {
    textContent: 'Click Me',
    onclick: () => alert('Clicked!')
});

// Add to Shadow DOM
const shadowRoot = element.shadowRoot;
GM_addElement(shadowRoot, 'style', {
    textContent: 'div { color: blue; }'
});

// Fallback for unsupported managers
function addElementFallback(parentOrTag, tagOrAttrs, maybeAttrs) {
    if (typeof GM_addElement !== 'undefined') return GM_addElement(parentOrTag, tagOrAttrs, maybeAttrs);
    if (typeof GM !== 'undefined' && typeof GM.addElement === 'function') return GM.addElement(parentOrTag, tagOrAttrs, maybeAttrs);
    // Manual fallback
    const hasParent = maybeAttrs !== undefined;
    const parent = hasParent ? parentOrTag : document.head;
    const tag = hasParent ? tagOrAttrs : parentOrTag;
    const attrs = hasParent ? maybeAttrs : tagOrAttrs;
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'textContent') el.textContent = v;
        else el.setAttribute(k, v); // class vs className, style-string vs CSSStyleDeclaration: use attribute
    }
    parent.appendChild(el);
    return el;
}
```

### Add Images

```javascript
GM_addElement('img', {
    src: 'https://example.com/image.png',
    alt: 'Description',
    width: 100,
    height: 100,
    style: 'border-radius: 50%;'
});
```

### CSP-aware usage

```javascript
// Sites with strict CSP may block inline scripts — GM_addElement helps only in TM/VM
// and Violentmonkey will fall back to content-world injection if blocked.

// Instead of (may be blocked by CSP):
const script = document.createElement('script');
script.textContent = 'console.log("blocked")';
document.head.appendChild(script);

// Prefer (Tampermonkey/Violentmonkey — with fallback):
if (typeof GM_addElement !== 'undefined') {
    GM_addElement('script', { textContent: 'console.log("via GM_addElement")' });
} else {
    // Greasemonkey/Safari fallback — may still be blocked by CSP
    const s = document.createElement('script');
    s.textContent = 'console.log("fallback")';
    document.head.appendChild(s);
}
```

---

## Creating Custom UI

> Compressed to minimal examples. For extended variants (themed panels, animated toasts, draggable constraints), see `patterns.md` (Page Load Detection, Element Manipulation, Mutation Observation).

### Minimal Floating Panel

```javascript
// @grant GM_addStyle
// @grant GM_registerMenuCommand

function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'userscript-panel';
    panel.innerHTML = `
        <div class="panel-header"><span>My Script</span><button class="close-btn">&times;</button></div>
        <div class="panel-content">
            <label><input type="checkbox" id="feature1"> Enable Feature 1</label>
        </div>`;
    document.body.appendChild(panel);
    GM_addStyle(`#userscript-panel{position:fixed;top:20px;right:20px;width:250px;background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:999999;font-family:system-ui,sans-serif}#userscript-panel .panel-header{display:flex;justify-content:space-between;align-items:center;padding:10px 15px;background:#f5f5f5;border-bottom:1px solid #e0e0e0}#userscript-panel .close-btn{background:none;border:none;font-size:20px;cursor:pointer}`);
    panel.querySelector('.close-btn').onclick = () => panel.remove();
    return panel;
}
GM_registerMenuCommand('Open Panel', createPanel);
```

### Minimal Toast

```javascript
// @grant GM_addStyle
GM_addStyle(`.userscript-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(100px);background:#333;color:#fff;padding:12px 24px;border-radius:4px;z-index:999999;opacity:0;transition:all .3s}.userscript-toast.show{transform:translateX(-50%) translateY(0);opacity:1}`);
function showToast(msg, ms=3000){
    const t=document.createElement('div'); t.className='userscript-toast'; t.textContent=msg;
    document.body.appendChild(t); setTimeout(()=>t.classList.add('show'),10);
    setTimeout(()=>{t.classList.remove('show'); setTimeout(()=>t.remove(),300);},ms);
}
showToast('Settings saved!');
```

### Minimal Draggable

```javascript
function makeDraggable(el){
    // Initial positioning: clear right and ensure top/left are explicit before dragging
    el.style.right = 'auto';
    if (!el.style.top) el.style.top = el.offsetTop + 'px';
    if (!el.style.left) el.style.left = el.offsetLeft + 'px';
    const header=el.querySelector('.panel-header')||el; header.style.cursor='move';
    let x=0,y=0, sx=0,sy=0;
    header.onmousedown=e=>{e.preventDefault(); sx=e.clientX; sy=e.clientY; document.onmousemove=drag; document.onmouseup=()=>{document.onmousemove=null; document.onmouseup=null;}};
    function drag(e){e.preventDefault(); x=sx-e.clientX; y=sy-e.clientY; sx=e.clientX; sy=e.clientY; el.style.top=(el.offsetTop-y)+'px'; el.style.left=(el.offsetLeft-x)+'px'; el.style.right='auto';}
}
makeDraggable(createPanel());
```

Full themed/animated variants: `patterns.md` (Element Manipulation, DOM Mutation Observation).

---

## Interacting with Page Frameworks

> All framework access below **requires `unsafeWindow`** and is **impossible on Safari "Userscripts" app** (no page-world access). On Firefox, use `cloneInto`/`exportFunction` to share values. Version labels are manager-qualified framework versions, not manager versions.

### React

| React version | How to find fiber/state | Notes |
| --- | --- | --- |
| React ≤17 | `__reactInternalInstance$` prefix on DOM node | `element.__reactInternalInstance$...` → `fiber.return` chain → `memoizedState` |
| React 18+ | `__reactFiber$` / `__reactProps$` prefixes | Keys start with `__reactFiber$` (fiber node) and `__reactProps$` (props); traverse `fiber.return` |

```javascript
// @grant unsafeWindow
// Requires unsafeWindow — not available on Safari

function waitForReact(callback) {
    const interval = setInterval(() => {
        if (unsafeWindow.React && unsafeWindow.ReactDOM) {
            clearInterval(interval);
            callback(unsafeWindow.React, unsafeWindow.ReactDOM);
        }
    }, 100);
}

// React ≤17 and 18+ compatible
function getReactState(element) {
    const fiberKey = Object.keys(element).find(k =>
        k.startsWith('__reactInternalInstance') || k.startsWith('__reactFiber$')
    );
    if (!fiberKey) return null;
    let fiber = element[fiberKey];
    while (fiber) {
        if (fiber.memoizedState) return fiber.memoizedState;
        fiber = fiber.return;
    }
    return null;
}
```

### Vue

| Vue version | Access | Notes |
| --- | --- | --- |
| Vue 2 | `element.__vue__` | Direct instance; `$data`, `$props` |
| Vue 3 | `element.__vueParentComponent` (or `__vue_app__` on mount root) | Component instance via `__vueParentComponent.ctx` / `.setupState` |

```javascript
// @grant unsafeWindow
// Requires unsafeWindow — not available on Safari

// Vue 2
const vue2El = document.querySelector('#app');
const vue2 = vue2El && vue2El.__vue__;
if (vue2) {
    console.log('Vue 2 data:', vue2.$data);
    vue2.someProperty = 'new value';
}

// Vue 3
const vue3El = document.querySelector('#app');
const vue3 = vue3El && (vue3El.__vueParentComponent || vue3El.__vue_app__);
if (vue3) {
    // Vue 3 instance shape differs — inspect ctx/setupState
    console.log('Vue 3 instance:', vue3);
}
```

### Angular

| Variant | Access | Notes |
| --- | --- | --- |
| AngularJS (1.x) | `angular.element(el).scope()` | Legacy; requires `unsafeWindow.angular` — AngularJS only |
| Angular 2+ | Debug tools (`ng.getComponent`) if `ng` exposed | Modern Angular does not expose `angular.element` the same way |

```javascript
// @grant unsafeWindow
// Requires unsafeWindow — not available on Safari
// AngularJS (1.x) only — legacy

const element = document.querySelector('[ng-controller]');
if (element && unsafeWindow.angular) {
    const scope = unsafeWindow.angular.element(element).scope();
    if (scope) {
        scope.$apply(() => { scope.someValue = 'modified'; });
    }
}

// Angular 2+ — only if page exposes ng (not guaranteed)
if (unsafeWindow.ng) {
    const comp = unsafeWindow.ng.getComponent(document.querySelector('my-component'));
    console.log('Angular component:', comp);
}
```

Cross-reference: `managers.md` §2 DOM & UI, §4 Sandbox/Injection; `browser-compatibility.md` (Firefox `cloneInto`); `api-sync.md` (summary only — this file is canonical).
