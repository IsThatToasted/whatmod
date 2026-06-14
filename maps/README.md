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


## v3 Google Maps waypoint routing

Gas stations now have a **Route stop** checkbox. Selected stations are sorted by their position along the planned route and inserted into the **Google Maps** full-route URL as waypoints. Apple Maps and Waze remain available for single-stop navigation/fallback links because their webpage URL schemes do not reliably preload full multi-stop routes.

## v4 waypoint behavior
Google Maps web links now send gas stations as latitude/longitude waypoints, which is more reliable than long station addresses. Google Maps route URLs are still limited; this planner sends up to 8 gas stops in one full-route link, plus the start and final destination. Extra selected gas stops remain available as individual Google/Apple/Waze navigation buttons.

## v5 update

Fuel stops are now planned automatically. After you plan a route and click **Find along route**, the app uses your route distance, MPG, and tank size to pick a small practical set of fuel stops. Those planned stops are sent to Google Maps as waypoint coordinates automatically. Nearby backup stations are still shown, but they are not included in the full Google route unless you use the price override button.
