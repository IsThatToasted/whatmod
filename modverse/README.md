# The Modverse — Living World V0.3 — Interactive Portfolio

An original explorable 3D portfolio concept inspired by the playful-web philosophy of interactive portfolios such as Bruno Simon's, without copying its car, world layout, assets, or visual identity.

## What is included

- Small explorable Three.js world
- Floating "Mod Core" player instead of a vehicle
- Six portfolio signal locations
- Project interaction cards
- Keyboard + touch controls
- Mobile virtual joystick
- World map / discovery tracking
- Three hidden collectible fragments
- Procedural WebAudio feedback
- Quality toggle
- Accessible/simple 2D portfolio fallback
- GitHub Pages-friendly relative build paths
- Responsive UI and reduced-motion support

## Deployment modes

This project now supports both:

- **Direct static hosting / GitHub Pages source hosting** — `index.html` loads CSS with a relative path and resolves Three.js through an import map.
- **Vite builds** — `npm run build` still produces an optimized `dist/` folder using the installed `three` dependency.

Do not change `./src/main.js` or `./src/style.css` to root-absolute `/src/...` paths when deploying in a subdirectory.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Upload the contents of `dist/` to any static host, or use it inside a GitHub Pages workflow. `vite.config.js` uses `base: './'`, so the project works from a subdirectory.

## Controls

- WASD / arrow keys — move
- Shift — pulse boost
- E / Enter — interact
- M — map
- Escape — close overlays
- Touch — joystick + ACT button

## Customize

Edit `src/data.js` to change projects, descriptions, links, positions, labels and accent values.

The starting project data intentionally includes examples from the WhatMod ecosystem. Replace or expand them as the portfolio evolves.

## Originality / tribute note

The experience is a tribute to creators who made personal websites feel like worlds. It deliberately uses a different player metaphor, world structure, UI, progression system, navigation and art direction rather than recreating Bruno Simon's portfolio.


## V0.3 — Living World

This pass turns the prototype into a more reactive miniature world while keeping the project asset-light:

- Procedural ambient synth, movement/boost engine tone, district hums, UI chords and boost whooshes
- Dynamic zone lighting, fog tint, Core glow and HUD accent based on the nearest project district
- Energy-limited pulse drive with camera FOV kick, shake, shockwave and longer additive trail
- Animated project-specific micro-biomes: floating life cards, travel route rings + aircraft, Wildform crystals, construction cranes, Lab torus knots and origin pylons
- Orbiting drones, firefly particles, moving skyline atmosphere, aurora ribbons and meteor streaks
- Project/secret particle bursts, world celebration events and animated event banners
- Persistent project and secret discovery using localStorage
- Mobile PULSE control in addition to joystick + ACT
- Low-quality mode disables the more expensive decorative world layer

Audio starts only after the visitor presses Enter, which keeps it compatible with normal browser autoplay policies. No external sound files are required.

### Static hosting note

`index.html`, `src/style.css`, and `src/main.js` use relative paths so the project can live inside a GitHub Pages subdirectory. The browser import map currently loads Three.js from jsDelivr when running the raw source directly. A Vite production build will bundle the npm `three` dependency instead.
