# Voxleaf

A polished, static text-to-speech web app designed for GitHub Pages. Paste text or import TXT, Markdown, HTML, and EPUB files, choose an installed voice, and listen with saved progress.

## What works without an API

Voxleaf uses the browser's built-in Web Speech API. There is no required account, server, database, or API key. Available voices depend on the device, browser, and operating system.

- Local voices are preferred and are marked **Local** in the voice picker.
- Some browser/OS voices are marked **Online** and may be processed by that provider.
- Chrome and Edge on Windows generally provide the broadest voice selection.
- EPUB import loads the open-source JSZip and EPUB.js libraries from jsDelivr the first time it is used, then the service worker caches them when possible.

## Features

- Long-text speech chunking for improved reliability
- Multiple installed voices with search and preview
- Speed, pitch, and volume controls
- Pause, resume, stop, paragraph skip, progress scrubber, and sleep timer
- Reading view with current passage highlighting
- Local IndexedDB library and saved reading position
- TXT, Markdown, HTML, and EPUB import
- TXT export
- Light/dark themes
- Mobile-responsive design
- Installable Progressive Web App with offline app-shell support
- No backend and no build step

## Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Upload every file and folder from this package to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select your default branch and the `/ (root)` folder, then save.
6. Open the GitHub Pages URL after deployment completes.

All app paths are relative, so it works at either a custom domain or a repository subpath such as `username.github.io/voxleaf/`.

## Local testing

Service workers do not run correctly when `index.html` is opened directly from disk. Start a local static server instead:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Optional premium voice API later

A cloud TTS provider is only needed when you want the exact same high-end voices on every device, downloadable audio files, or server-side audiobook generation. GitHub Pages cannot safely hide a private API key, so that version should use a small serverless function (for example, Cloudflare Workers, Netlify Functions, Vercel Functions, or Supabase Edge Functions) as a protected proxy.

## Open-source components

- JSZip 3.10.1 — MIT or GPL-3.0-or-later
- EPUB.js 0.3.93 — FreeBSD/BSD-style license
- DM Sans and Fraunces — SIL Open Font License via Google Fonts

The Voxleaf application code in this package is provided under the MIT License.
