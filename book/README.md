# Lights Out Audiobook Player

This folder is ready to publish at:

`https://whatmod.com/book/`

## Repository layout

The player is configured for this exact layout:

```text
whatmod/
├── Lights Out - 01.mp3   # Introduction
├── Lights Out - 02.mp3   # Chapter 1
├── ...
├── Lights Out - 28.mp3   # Chapter 27
├── Lights Out - 29.mp3   # Chapter 28
└── book/
    ├── index.html
    ├── styles.css
    ├── app.js
    └── cover.jpg
```

Place your real cover image in this folder and name it exactly `cover.jpg`.
If the cover is missing, the page automatically shows a built-in “LIGHTS OUT” fallback cover.

## Features

- Play and pause
- Drag through the current chapter
- Skip backward or forward 15 seconds
- Previous and next chapter buttons
- Chapter list
- Automatic transition to the next chapter
- Playback speed control
- Volume control
- Saves chapter, position, speed, and volume in the browser
- Lock-screen and hardware media controls where supported
- Keyboard controls: Space to play/pause, left/right arrows to skip
- Responsive mobile and desktop layout

## GitHub Pages

Commit the `book` folder to the root of the same GitHub repository that contains the MP3 files. No build process is required.

The MP3 filenames must match exactly, including spaces and capitalization.

The player contains 29 tracks total:

- `Lights Out - 01.mp3` is displayed as **Introduction**.
- `Lights Out - 02.mp3` is displayed as **Chapter 1**.
- The numbering continues through `Lights Out - 29.mp3`, displayed as **Chapter 28**.
