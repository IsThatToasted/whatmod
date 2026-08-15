# ScooterCast web viewer

Static GitHub Pages viewer.

Before deployment edit `config.js`.

Open with:

`/?ride=<private-share-slug>`

The viewer:
- asks the Supabase Edge Function for a subscribe-only LiveKit token
- subscribes to the rider's WebRTC tracks
- subscribes to Supabase Realtime telemetry
- renders the map with MapLibre + OpenStreetMap raster tiles
