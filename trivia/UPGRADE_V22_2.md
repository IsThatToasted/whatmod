# V22.2 Mobile Dock Hotfix

No SQL migration is required.

Fixes:
- Nova mobile dock now sits flush with the mobile viewport bottom instead of floating too high.
- Safe-area space is handled inside the dock and page padding rather than as body padding.
- Removed iOS/Safari tap highlight from dock buttons.
- Active tab no longer fills/lights the whole button; it uses a small cyan marker instead.
- Added dynamic-viewport sizing for Safari address/tool bar changes.
- Bumped service-worker cache to `whatmod-trivia-v22.2` and cache-busted CSS/JS references.
