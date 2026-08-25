# WeTrack V3.4 — Automatic Slideshow + Soundtracks

## Full slideshow
- Automatically advances every 8 seconds.
- Back / Pause-Resume / Next controls below the image.
- Progress bar resets for each 8-second slide.
- Opening a photo thumbnail starts the full slideshow on that exact photo.
- Clicking the rotating completed-trip preview opens the full slideshow on that photo.
- Autoplay continues after opening from a preview.

## Soundtrack
Trip-level soundtrack options:
- WeTrack Ambience
- Uploaded MP3
- YouTube soundtrack via official embedded YouTube playback
- No soundtrack

MP3 uploads are stored in the existing `trip-memories` bucket under the current
trip/user path.

WeTrack does not download or convert YouTube videos to MP3. A saved YouTube
link is played through YouTube's embedded player instead.

## Database
Run `v34_slideshow_soundtrack.sql` once.
It only adds four soundtrack fields to `itinerary_trips`.

Cache/build: v560 / V3.4.
