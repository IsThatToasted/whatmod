# Lights Out Audiobook Player

This folder is ready to publish at:

`https://whatmod.com/book/`

## Repository layout

The player is configured for this exact layout:

```text
whatmod/
├── Lights Out - 01.mp3
├── Lights Out - 02.mp3
├── Lights Out - 03.mp3
├── Lights Out - 04.mp3
├── Lights Out - 05.mp3
├── Lights Out - 06.mp3
├── Lights Out - 07.mp3
├── Lights Out - 08.mp3
├── Lights Out - 09.mp3
├── Lights Out - 10.mp3
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
