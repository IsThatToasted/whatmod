# Wildform Studio — Development Roadmap

Wildform Studio is not intended to become a general DCC package. Every major editor feature should shorten the path from **creature concept -> modular creature -> rig -> animation -> evolution -> runtime-ready Wildform asset**.

## Phase 1 — Creator Core (prototype in this repository)
- Desktop project shell and native file dialogs.
- Image and sprite-sheet import.
- Transparent gutter/cell detection.
- Connected alpha-region detection for separated parts.
- Heuristic role recognition and standard biped rig overlay.
- Manual bone transforms and auto-keying.
- Editable timeline and animation events.
- Procedural animation recipes.
- GLB/glTF/OBJ preview.
- Project and animation JSON formats.

## Phase 2 — 2D Creature Production
- Region editor: split/merge/crop detected parts.
- Pivot/attachment socket editor.
- Layer ordering and mirrored parts.
- Bone-to-sprite binding.
- Mesh deformation / weighted 2D skinning.
- IK/FK arms and legs.
- Foot planting and anti-slide solver.
- Onion skin and pose ghosts.
- Pose library and animation mirroring.
- Atlas packing + sprite-sheet export.
- Runtime preview at target game scale.

## Phase 3 — Wildform Modular Creature Builder
- Standard socket schema: root, pelvis, torso, neck, head, limbs, tail, wings, horns, ears, accessories.
- Part library with tags/species/material/evolution metadata.
- Live part swapping while animation continues.
- Symmetry rules and left/right generation.
- Per-part tint/material channels.
- Evolution-stage variants and growth curves.
- Compatibility checks for sockets and skeleton types.
- Creature randomizer constrained by biome/evolution family.

## Phase 4 — Animation Suite
- Graph/curve editor.
- Animation layers and additive motion.
- Blend preview: idle -> walk -> run -> sprint.
- Retargeting between creature proportions.
- Root motion extraction.
- Look-at and aim constraints.
- Tail/ear/antenna secondary motion.
- Motion trails and attack hit arcs.
- Audio/event tracks.
- Animation compression and validation.

## Phase 5 — Rig Templates
- Biped.
- Quadruped.
- Serpentine.
- Flying biped.
- Winged quadruped.
- Floating/no-leg creature.
- Multi-tail and multi-arm extensions.
- Custom rig authoring.

## Phase 6 — 3D Production
- Full GLB/glTF scene hierarchy inspection.
- Mesh/material browser.
- Existing skeleton recognition.
- Bone mapping to Wildform standard rigs.
- Auto-rig assist for unrigged models.
- Weight painting / heat-weight initialization.
- IK controls.
- Morph targets for facial/evolution changes.
- LOD preview and generation hooks.
- Collision/hitbox editor.

## Phase 7 — Evolution Lab
- Stage timeline (juvenile/base/evolved/ascended/etc.).
- Size/proportion interpolation.
- Part replacement at thresholds.
- Horn/spike/tail growth curves.
- Color/material evolution.
- Morph target preview.
- Animation compatibility audit across stages.
- Evolution cinematic preview.

## Phase 8 — Gameplay Animation Authoring
- State-machine editor.
- Conditions: speed, grounded, combat, swimming, flying, injured, interaction state.
- Blend trees.
- Attack combo windows.
- Hit/hurt boxes by frame.
- Footstep/material events.
- VFX and sound markers.
- Camera/cinematic tracks.
- Game-speed and low-FPS simulation.

## Phase 9 — Procedural / Assisted Motion
- Walk/run generation parameterized by body proportions.
- Personality modifiers: playful, shy, aggressive, tired, heavy, energetic.
- Terrain-aware foot placement.
- Head/eye interest targeting.
- Breathing and idle variation.
- Rule-based animation remixing.
- Optional ML-assisted segmentation/pose estimation as an add-on, never required for core editing.

## Phase 10 — Wildform Runtime Pipeline
- One-click validation.
- Export creature manifest + rig + clips + events + part metadata.
- Atlas/texture optimization.
- 3D GLB export and mobile budget report.
- Versioned asset packages.
- Backward-compatible runtime schema.
- Diffable JSON manifests for Git.
- Automated CI validation of creature assets.

## UX principles
1. Simple Mode must always be useful without knowing animation terminology.
2. Advanced Mode exposes the actual rig/keyframes rather than hiding generated data.
3. Any automatic recognition result must be editable.
4. Wildform standard sockets/rigs are the interoperability layer.
5. Destructive operations should create undoable commands.
6. The editor should preview the same constraints the mobile game will use.
