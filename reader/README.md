# Voxleaf with Kokoro AI Narrator

Voxleaf is a polished, static reading app for GitHub Pages. Paste text or import TXT, Markdown, HTML, and EPUB files, then listen with either the open-source Kokoro neural narrator or the browser's built-in device voices.

## No API key or backend is required

The default **AI Narrator** mode runs Kokoro locally in a Web Worker using ONNX Runtime Web. The page itself remains a static GitHub Pages site.

- Default voice: **Emma (`bf_emma`)**, British female.
- Other included British female choices: Isabella, Alice, and Lily.
- Model quantization: optimized `q8` on WebAssembly for broad browser compatibility.
- First AI use downloads roughly 92 MB of model data plus supporting runtime files.
- The model and voice assets are cached by the browser, so later sessions normally start much faster.
- Reading text is processed inside the browser and is not sent to a paid speech API.
- A network connection is still needed the first time the Kokoro model is downloaded.

**Chrome or Edge on a modern desktop is recommended for the first test.** Kokoro can run without WebGPU, but older phones and low-memory devices may generate audio slowly. Voxleaf automatically retains the original Device Voice mode as a fast fallback.

## Features

- Kokoro neural narration generated locally in a background worker
- British female AI voices, with Emma selected by default
- Device/browser voice fallback
- Background model preparation and ahead-of-playback audio generation to reduce waiting and gaps
- Long-text chunking and saved reading progress
- Speed and volume controls for AI narration
- Speed, pitch, and volume controls for device voices
- Pause, resume, stop, paragraph skip, progress scrubber, and sleep timer
- Current passage highlighting
- Local IndexedDB library
- TXT, Markdown, HTML, and EPUB import
- TXT export
- Responsive light/dark interface
- Installable PWA app shell
- No build process, account, database, or private API key

## Deploy at `/reader` in the WhatMod repository

Delete the old `reader` folder and upload this entire replacement folder to the root of the repository:

```text
reader/
  index.html
  app.js
  styles.css
  kokoro-worker.js
  sw.js
  manifest.webmanifest
  .nojekyll
  assets/
    icon-192.png
    icon-512.png
  vendor/
    kokoro.web.js
    KOKORO-LICENSE.txt
```

Then open:

```text
https://whatmod.com/reader/
```

Use the trailing slash. After deploying, perform a hard refresh. When replacing an older PWA version, it may also help to unregister the old service worker and clear site data once.

## What GitHub Pages hosts

GitHub Pages hosts the application files, the Kokoro JavaScript runtime bundle, and the Web Worker. The large neural model is downloaded directly by the user's browser from the public Hugging Face model repository on first use. This avoids placing a roughly 92 MB binary in the WhatMod Git repository and avoids GitHub Pages bandwidth being used for every model download.

## Local testing

Do not open `index.html` using a `file://` URL. Module workers and service workers require an HTTP origin.

From the directory containing the `reader` folder:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080/reader/
```

## Open-source components

- Kokoro.js 1.2.1 — Apache-2.0
- Kokoro-82M-v1.0-ONNX model — Apache-2.0
- Transformers.js / ONNX Runtime Web — browser inference dependencies bundled by Kokoro.js
- JSZip 3.10.1 — MIT or GPL-3.0-or-later
- EPUB.js 0.3.93 — FreeBSD/BSD-style license
- DM Sans and Fraunces — SIL Open Font License

The Voxleaf application code is provided under the MIT License. The Kokoro Apache-2.0 notice is included in `vendor/KOKORO-LICENSE.txt`.


## Performance changes in this build

- Corrected the model choice from `q4` to `q8`. In this Kokoro ONNX repository, the `q4` file is about 305 MB, while the optimized 8-bit model is about 92 MB.
- Begins downloading and initializing Kokoro during browser idle time on normal connections instead of waiting for Read Now.
- Pre-generates the current passage after text settles and queues the next passages.
- Uses shorter narration chunks for faster time-to-first-audio.
- Serializes background generation to avoid multiple inference jobs fighting for the same CPU.
- Keeps Data Saver and very slow connections from automatically downloading the model.
- Fixes the document menu stacking order so it remains above the editor and reading text.
