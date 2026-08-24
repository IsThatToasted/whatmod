# WeTrack V3.3.1 — Memory Freeze Fix

## Root cause
V3.3 installed a MutationObserver on the entire document body. Its callback
changed textContent on buttons inside the same observed subtree, which generated
new childList mutations and could repeatedly trigger itself.

That could peg Chrome/WKWebView's main thread and result in the browser
"Wait / Exit page" warning.

## Fix
- Observer no longer mutates on every page DOM change.
- Sync is requestAnimationFrame-debounced.
- It reacts only when completed-trip memory controls are actually inserted.
- Button text is changed only when the value really differs.
- Slideshow click binding happens only once.
- Normal memory list rendering directly queues the small completed-trip sync.

No Supabase changes.
Cache/build: v551 / V3.3.1.
