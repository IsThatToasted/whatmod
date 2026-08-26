# WeTrack V3.4.1 — Slideshow Volume + YouTube Autoplay

- Adds a compact full-slideshow volume slider.
- Default level is 20%.
- The volume preference persists locally on each device.
- Uploaded MP3 playback starts at the selected volume.
- Built-in ambience is reduced to about 20% of its previous level.
- YouTube embeds use enablejsapi=1.
- When Full Slideshow is opened and the trip has a YouTube soundtrack,
  WeTrack automatically issues play + volume commands from that user gesture.
- YouTube autoplay can still be subject to browser/iOS autoplay policies,
  but this uses the most reliable user-gesture path available.

No new SQL is required beyond the V3.4 soundtrack migration.
Cache/build: v561 / V3.4.1.
