# TripForge Advanced Trip Planner

A self-contained local web app for route planning, fuel-stop discovery, fuel cost estimates, and a timeslot-based day planner with overlap and closing-time conflict detection.

## What is included

- OpenStreetMap/Leaflet map
- OSRM demo routing through Leaflet Routing Machine
- Start/destination geocoding through Nominatim
- Gas/fuel stop search along the route through Overpass
- Address resolving for fuel stops when OpenStreetMap station tags are incomplete
- External navigation links for:
  - Google Maps
  - Apple Maps
  - Waze
- Start/end route launching into Google Maps, Apple Maps, or Waze
- Per-station external navigation buttons and map-popup links
- Event planner with custom events, travel, food, hotel, fuel, and custom blocks
- Overlap warnings
- Opening/closing time warnings
- Manual fuel prices and MPG-based fuel-cost estimates
- Local autosave
- JSON import/export

## How to run

Open `index.html` in a modern browser.

For best reliability, especially with browser security rules, run it from a tiny local server:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Notes

This version uses public demo/community services. They are good for local testing and personal planning, but production traffic should use your own hosted routing/geocoding service or paid APIs.

Real station-level gas prices usually require a paid/partner data provider. This app finds stations along the route and lets you enter prices manually, while keeping the exact station addresses and coordinates ready for navigation apps.
