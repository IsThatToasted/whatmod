# Wildform Studio

A focused Windows creature assembly, rigging and animation editor for **Wildform** — the walking RPG where the player *is* the evolving creature.

## Current prototype features

- Desktop Electron application with a production-oriented editor layout.
- 2D creature viewport with a standard Wildform biped rig.
- Image import for PNG/JPG/WebP/GIF.
- Automatic alpha analysis for transparent images.
- Automatic sprite-sheet cell detection using transparent gutters.
- Connected-alpha component detection for pre-separated creature parts.
- Heuristic part-role recognition (head/body/arms/legs) with editable regions.
- Manual bone selection and transform editing.
- Auto-keying into animation clips.
- Timeline with per-bone tracks and keyframe visualization.
- Procedural animation recipes: Idle, Walk, Run, Jump, Celebrate, Attack.
- Animation event data support (attack recipe demonstrates damage-window events).
- 2D ground guide and a foot-lock project setting ready for solver expansion.
- GLB / glTF / OBJ 3D model preview powered by Three.js.
- Native project save/load (`.wildform.json`).
- Animation export (`.wildanim.json`).
- Windows portable executable + ZIP build through GitHub Actions.

## Why the image "auto rig" is assistive

A flat image has no real skeleton or depth information. The prototype analyzes transparency, separate connected regions, likely sprite cells and position-based body roles, then overlays the **Wildform standard rig**. This gives a useful starting point while leaving every bone editable. Future versions can add optional ML segmentation / pose estimation without changing the project format.

## Run locally

```bash
npm install
npm run dev
```

## Build Windows

```bash
npm run build
```

Artifacts are written to `release/`.

## GitHub repository placement

This ZIP is structured as a standalone repository. Extract/upload its **contents** at repository root so `.github/workflows/build-windows.yml` is located at the repository root workflow path. The workflow can then be run manually from GitHub Actions and also runs on pushes to `main`.

If you want to keep Studio inside a larger monorepo instead, move the Studio source into a folder and update the workflow working directory/path filters accordingly.

## Roadmap

The architecture is deliberately aimed at Wildform rather than becoming a generic Maya clone. Good next milestones are weighted sprite-to-bone binding, region/pivot editor, IK/FK switching, automatic foot-lock solving, curve editor, animation layers, pose library, retargeting between creature proportions, quadruped/flying rig templates, blend/state-machine preview, secondary-motion tails/ears, evolution-stage preview, atlas export, and runtime-ready animation packages.
