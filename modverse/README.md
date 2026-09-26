# The Modverse — Interactive Portfolio

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
