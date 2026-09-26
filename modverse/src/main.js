import * as THREE from 'three'
import { PROJECTS, SECRETS } from './data.js'

const $ = (selector) => document.querySelector(selector)
const canvas = $('#world')

const state = {
  started: false,
  simple: false,
  muted: false,
  quality: 'high',
  discovered: new Set(),
  secrets: new Set(),
  nearest: null,
  keys: new Set(),
  boost: 0,
  energy: 100,
  audio: null,
  mapOpen: false,
  panelOpen: false,
  touch: { x: 0, y: 0, boost: false },
  zone: 'THE NULL',
  zoneAccent: new THREE.Color(0x78ffd6),
  lastBoosting: false,
  firstBoost: false,
  distanceTravelled: 0,
  lastCorePosition: new THREE.Vector3(0, 0.9, 4),
}

// ---------- UI ----------
const boot = $('#boot')
const hud = $('#hud')
const mission = $('#mission')
const interactHint = $('#interactHint')
const panel = $('#panel')
const help = $('#help')
const mapOverlay = $('#mapOverlay')
const toast = $('#toast')
const touchControls = $('#touchControls')
const credit = $('#credit')
const simpleView = $('#simpleView')
const energyFill = $('#energyFill')
const zoneText = $('#zoneText')
const speedText = $('#speedText')
const fxOverlay = $('#fxOverlay')
const eventBanner = $('#eventBanner')

$('#totalCount').textContent = PROJECTS.length

loadProgress()
populateSimpleView()
updateProgressUI()

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem('modverse-progress-v1') || '{}')
    state.discovered = new Set((saved.discovered || []).filter(id => PROJECTS.some(p => p.id === id)))
    state.secrets = new Set((saved.secrets || []).filter(id => SECRETS.some(s => s.id === id)))
  } catch {}
}

function saveProgress() {
  try {
    localStorage.setItem('modverse-progress-v1', JSON.stringify({
      discovered: [...state.discovered],
      secrets: [...state.secrets],
    }))
  } catch {}
}

function updateProgressUI() {
  $('#discoveredCount').textContent = state.discovered.size
  const resume = $('#resumeNote')
  if (!resume) return
  if (state.discovered.size || state.secrets.size) {
    resume.textContent = `Previous signal memory detected · ${state.discovered.size}/${PROJECTS.length} projects · ${state.secrets.size}/${SECRETS.length} fragments`
    resume.classList.remove('hidden')
  }
}

function enterWorld() {
  state.started = true
  state.simple = false
  boot.classList.add('hidden')
  simpleView.classList.add('hidden')
  canvas.classList.remove('hidden')
  hud.classList.remove('hidden')
  mission.classList.remove('hidden')
  $('#telemetry').classList.remove('hidden')
  credit.classList.remove('hidden')
  fxOverlay.classList.remove('hidden')
  if (matchMedia('(pointer: coarse)').matches) touchControls.classList.remove('hidden')
  initAudio()
  resumeAudio()
  playChord([220, 330, 440], 0.26, 0.022)
  showEvent('CORE ONLINE', 'The Modverse is listening.')
}

function enterSimple() {
  state.simple = true
  state.started = false
  boot.classList.add('hidden')
  hud.classList.add('hidden')
  mission.classList.add('hidden')
  $('#telemetry').classList.add('hidden')
  touchControls.classList.add('hidden')
  credit.classList.add('hidden')
  fxOverlay.classList.add('hidden')
  canvas.classList.add('hidden')
  simpleView.classList.remove('hidden')
  fadeAudio(0.0001)
}

$('#enterWorld').addEventListener('click', enterWorld)
$('#viewSimple').addEventListener('click', enterSimple)
$('#return3d').addEventListener('click', enterWorld)
$('#closePanel').addEventListener('click', closePanel)
$('#panelContinue').addEventListener('click', closePanel)
$('#helpBtn').addEventListener('click', () => help.classList.remove('hidden'))
$('#mapBtn').addEventListener('click', toggleMap)
$('#audioBtn').addEventListener('click', toggleAudio)
$('#qualityBtn').addEventListener('click', toggleQuality)

$('#resetProgress')?.addEventListener('click', () => {
  localStorage.removeItem('modverse-progress-v1')
  state.discovered.clear()
  state.secrets.clear()
  secretObjects.forEach(o => { o.visible = true })
  updateProgressUI()
  showToast('SIGNAL MEMORY CLEARED')
})

document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => $('#' + button.dataset.close).classList.add('hidden'))
})

function populateSimpleView() {
  const target = $('#simpleProjects')
  PROJECTS.forEach((project) => {
    const article = document.createElement('article')
    article.className = 'simple-project glass'
    article.innerHTML = `<p class="eyebrow">${project.tag}</p><h2>${project.title}</h2><p>${project.description}</p><div class="chips">${project.skills.map(s => `<span>${s}</span>`).join('')}</div>${project.link !== '#' ? `<a class="ghost" href="${project.link}" target="_blank" rel="noreferrer">Open project</a>` : ''}`
    target.appendChild(article)
  })
}

// ---------- Three.js world ----------
let renderer, scene, camera, clock, core, coreHalo, coreInner, coreLight, trail, trailGlow, trailPoints = []
let velocity = new THREE.Vector3()
let projectObjects = []
let secretObjects = []
let particles, stars, ambientDust
let worldGroup, detailGroup, auroraGroup, reactorGroup, reactorLight, portalGroup
let animatedProps = []
let effects = []
let meteors = []
let fireflyClouds = []
const mouseLook = new THREE.Vector2()
const cameraShake = new THREE.Vector2()
const tempColor = new THREE.Color()
const baseFogColor = new THREE.Color(0x070810)
const baseBackground = new THREE.Color(0x070810)

try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
} catch (error) {
  enterSimple()
  throw error
}

renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2

scene = new THREE.Scene()
scene.background = baseBackground.clone()
scene.fog = new THREE.FogExp2(baseFogColor.clone(), 0.017)
clock = new THREE.Clock()

camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 360)
camera.position.set(0, 22, 29)

worldGroup = new THREE.Group()
detailGroup = new THREE.Group()
scene.add(worldGroup, detailGroup)

const hemi = new THREE.HemisphereLight(0x9db8ff, 0x17131f, 2.1)
scene.add(hemi)
const keyLight = new THREE.DirectionalLight(0xffffff, 2.65)
keyLight.position.set(12, 25, 16)
scene.add(keyLight)

createSky()
createGround()
createCore()
createProjectSignals()
createSecrets()
createParticles()
createWorldArchitecture()
createAmbientLife()
createMeteors()

function createSky() {
  const starPositions = []
  for (let i = 0; i < 1800; i++) {
    const radius = 70 + Math.random() * 150
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(1.1))
    starPositions.push(
      Math.sin(phi) * Math.cos(theta) * radius,
      15 + Math.abs(Math.cos(phi)) * radius * 0.8,
      Math.sin(phi) * Math.sin(theta) * radius
    )
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
  stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.12, color: 0xdde7ff, transparent: true, opacity: 0.62, depthWrite: false }))
  scene.add(stars)

  auroraGroup = new THREE.Group()
  const auroraColors = [0x59ffd1, 0x725cff, 0xff4ecd]
  for (let j = 0; j < 4; j++) {
    const points = []
    for (let i = 0; i <= 64; i++) {
      const t = i / 64
      points.push(new THREE.Vector3(
        -55 + t * 110,
        24 + j * 3 + Math.sin(t * Math.PI * 4 + j) * (1.5 + j * 0.3),
        -48 - j * 6 + Math.cos(t * Math.PI * 2) * 4
      ))
    }
    const curve = new THREE.CatmullRomCurve3(points)
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 96, 0.13 + j * 0.035, 5, false),
      new THREE.MeshBasicMaterial({ color: auroraColors[j % auroraColors.length], transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })
    )
    tube.userData.phase = j * 1.7
    auroraGroup.add(tube)
  }
  scene.add(auroraGroup)
}

function createGround() {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(50, 128),
    new THREE.MeshStandardMaterial({ color: 0x0d1020, roughness: 0.78, metalness: 0.18 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.15
  worldGroup.add(ground)

  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x223052, transparent: true, opacity: 0.4 })
  ;[9, 18, 31, 43].forEach((radius, i) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.045, radius + 0.045, 160), ringMaterial.clone())
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -0.105
    ring.userData.speed = (i % 2 ? -1 : 1) * (0.03 + i * 0.01)
    worldGroup.add(ring)
    animatedProps.push({ object: ring, type: 'groundRing' })
  })

  const grid = new THREE.GridHelper(92, 46, 0x1a2750, 0x11182e)
  grid.position.y = -0.1
  grid.material.transparent = true
  grid.material.opacity = 0.34
  worldGroup.add(grid)

  // Radial "data lanes" connecting the districts to the origin.
  PROJECTS.filter(p => p.id !== 'about').forEach((project, i) => {
    const p = new THREE.Vector3(project.position[0], -0.08, project.position[1])
    const mid = p.clone().multiplyScalar(0.5)
    mid.y = 0.05 + (i % 2) * 0.03
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.08, 0), mid, p)
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 32, 0.025, 4, false),
      new THREE.MeshBasicMaterial({ color: project.accent, transparent: true, opacity: 0.18 })
    )
    worldGroup.add(tube)
  })
}

function createCore() {
  core = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.68, 2),
    new THREE.MeshPhysicalMaterial({ color: 0xe9f9ff, emissive: 0x2dffc0, emissiveIntensity: 1.55, metalness: 0.3, roughness: 0.16, clearcoat: 1 })
  )
  core.add(body)

  coreInner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 1),
    new THREE.MeshBasicMaterial({ color: 0xb7fff0, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending })
  )
  core.add(coreInner)

  coreHalo = new THREE.Mesh(
    new THREE.TorusGeometry(1.05, 0.045, 12, 72),
    new THREE.MeshBasicMaterial({ color: 0x78ffd6, transparent: true, opacity: 0.78 })
  )
  coreHalo.rotation.x = Math.PI / 2
  core.add(coreHalo)

  const halo2 = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.018, 8, 56),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })
  )
  halo2.rotation.y = Math.PI / 2
  core.add(halo2)
  core.userData.halo2 = halo2

  coreLight = new THREE.PointLight(0x78ffd6, 5.5, 10, 2)
  core.add(coreLight)
  core.position.copy(state.lastCorePosition)
  scene.add(core)

  trail = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: 0x6effd5, transparent: true, opacity: 0.52, blending: THREE.AdditiveBlending })
  )
  trailGlow = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending })
  )
  scene.add(trail, trailGlow)
}

function createProjectSignals() {
  PROJECTS.forEach((project, index) => {
    const group = new THREE.Group()
    group.userData = { type: 'project', project }
    group.position.set(project.position[0], 0, project.position[1])

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.35, 2.75, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0x12172a, metalness: 0.55, roughness: 0.45 })
    )
    base.position.y = 0.18
    group.add(base)

    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.55, 3.5 + (index % 3) * 0.7, 10),
      new THREE.MeshPhysicalMaterial({ color: project.accent, emissive: project.accent, emissiveIntensity: 0.85, transparent: true, opacity: 0.88, roughness: 0.22 })
    )
    beacon.position.y = 2
    group.add(beacon)

    const orbital = new THREE.Mesh(
      new THREE.TorusGeometry(1.65, 0.06, 8, 56),
      new THREE.MeshBasicMaterial({ color: project.accent, transparent: true, opacity: 0.82 })
    )
    orbital.rotation.x = Math.PI / 2
    orbital.position.y = 1.05
    group.add(orbital)

    const orbital2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.05, 0.025, 8, 64),
      new THREE.MeshBasicMaterial({ color: project.accent, transparent: true, opacity: 0.34 })
    )
    orbital2.rotation.x = Math.PI / 2
    orbital2.rotation.z = index * 0.6
    orbital2.position.y = 0.88
    group.add(orbital2)

    const label = makeTextSprite(project.title.toUpperCase(), project.accent)
    label.position.set(0, 4.6, 0)
    label.scale.set(4.8, 1.2, 1)
    group.add(label)

    const pointLight = new THREE.PointLight(project.accent, 2.4, 10, 2)
    pointLight.position.y = 2.4
    group.add(pointLight)

    createDistrictDecor(group, project, index)

    group.userData.beacon = beacon
    group.userData.orbital = orbital
    group.userData.orbital2 = orbital2
    group.userData.light = pointLight
    group.userData.baseScale = 1
    worldGroup.add(group)
    projectObjects.push(group)
  })
}

function createDistrictDecor(group, project, index) {
  const accent = project.accent
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x151a2f, metalness: 0.38, roughness: 0.5 })
  const glowMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending })

  if (project.kind === 'life') {
    for (let i = 0; i < 7; i++) {
      const card = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.72), i % 3 === 0 ? glowMat.clone() : darkMat.clone())
      const a = (i / 7) * Math.PI * 2
      card.position.set(Math.cos(a) * (3.3 + (i % 2) * 0.5), 0.8 + (i % 3) * 0.55, Math.sin(a) * (3.3 + (i % 2) * 0.5))
      card.rotation.y = -a + Math.PI / 2
      group.add(card)
      animatedProps.push({ object: card, type: 'floatCard', phase: i * 0.7, originY: card.position.y })
    }
  } else if (project.kind === 'journey') {
    for (let i = 0; i < 4; i++) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(2.8 + i * 0.45, 0.025, 6, 56), glowMat.clone())
      hoop.rotation.x = Math.PI / 2
      hoop.position.y = 0.08 + i * 0.05
      group.add(hoop)
      animatedProps.push({ object: hoop, type: 'routeRing', phase: i })
    }
    const plane = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.22), darkMat.clone())
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 1.2), glowMat.clone())
    plane.add(body, wing)
    plane.position.y = 3.2
    group.add(plane)
    animatedProps.push({ object: plane, type: 'orbitPlane', phase: index })
  } else if (project.kind === 'game') {
    for (let i = 0; i < 11; i++) {
      const h = 0.5 + Math.random() * 2.2
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.22 + Math.random() * 0.25, h, 5), i % 3 === 0 ? glowMat.clone() : darkMat.clone())
      const a = (i / 11) * Math.PI * 2
      const r = 3 + Math.random() * 2
      crystal.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r)
      crystal.rotation.z = THREE.MathUtils.randFloatSpread(0.22)
      group.add(crystal)
      animatedProps.push({ object: crystal, type: 'crystal', phase: i * 0.5, originY: crystal.position.y })
    }
  } else if (project.kind === 'build') {
    for (let i = 0; i < 5; i++) {
      const h = 1.6 + i * 0.55
      const tower = new THREE.Group()
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.18, h, 0.18), darkMat.clone())
      mast.position.y = h / 2
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5 + i * 0.18, 0.1, 0.1), glowMat.clone())
      arm.position.set(0.65, h, 0)
      tower.add(mast, arm)
      const a = (i / 5) * Math.PI * 2
      tower.position.set(Math.cos(a) * 4, 0, Math.sin(a) * 4)
      tower.rotation.y = -a
      group.add(tower)
      animatedProps.push({ object: arm, type: 'crane', phase: i })
    }
  } else if (project.kind === 'lab') {
    for (let i = 0; i < 5; i++) {
      const cage = new THREE.Mesh(new THREE.TorusKnotGeometry(0.55 + i * 0.12, 0.035, 64, 8, 2 + (i % 2), 3), glowMat.clone())
      const a = (i / 5) * Math.PI * 2
      cage.position.set(Math.cos(a) * 3.8, 1.2 + (i % 2) * 1.0, Math.sin(a) * 3.8)
      cage.scale.setScalar(0.8)
      group.add(cage)
      animatedProps.push({ object: cage, type: 'labKnot', phase: i * 0.8 })
    }
  } else if (project.kind === 'origin') {
    for (let i = 0; i < 6; i++) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.2 + i * 0.15, 0.18), i % 2 ? darkMat.clone() : glowMat.clone())
      const a = (i / 6) * Math.PI * 2
      pylon.position.set(Math.cos(a) * 3.2, 0.7, Math.sin(a) * 3.2)
      group.add(pylon)
      animatedProps.push({ object: pylon, type: 'pylon', phase: i })
    }
  }

  // Every district gets a tiny orbiting drone.
  const drone = new THREE.Group()
  const droneBody = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), glowMat.clone())
  const droneRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.018, 5, 24), glowMat.clone())
  droneRing.rotation.x = Math.PI / 2
  drone.add(droneBody, droneRing)
  group.add(drone)
  animatedProps.push({ object: drone, type: 'drone', phase: index * 0.9, radius: 3 + (index % 2) * 0.7 })
}

function makeTextSprite(text, accent) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.font = '700 76px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowBlur = 30
  ctx.shadowColor = '#' + new THREE.Color(accent).getHexString()
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, c.width / 2, c.height / 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
}

function createSecrets() {
  SECRETS.forEach((secret, index) => {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.48, 0),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xff4ecd, emissiveIntensity: 2.8, metalness: 0.25, roughness: 0.1 })
    )
    mesh.position.set(secret.position[0], 0.75, secret.position[1])
    mesh.userData = { type: 'secret', secret, index }
    mesh.visible = !state.secrets.has(secret.id)
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.018, 6, 40),
      new THREE.MeshBasicMaterial({ color: 0xff4ecd, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending })
    )
    halo.rotation.x = Math.PI / 2
    mesh.add(halo)
    mesh.userData.halo = halo
    worldGroup.add(mesh)
    secretObjects.push(mesh)
  })
}

function createParticles() {
  const positions = []
  for (let i = 0; i < 1000; i++) {
    const radius = 8 + Math.random() * 72
    const theta = Math.random() * Math.PI * 2
    positions.push(Math.cos(theta) * radius, Math.random() * 20 + 1.5, Math.sin(theta) * radius)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  particles = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.05, color: 0xc7d3ff, transparent: true, opacity: 0.5, depthWrite: false }))
  scene.add(particles)

  const dustPositions = []
  for (let i = 0; i < 350; i++) {
    dustPositions.push(THREE.MathUtils.randFloatSpread(90), Math.random() * 5 + 0.2, THREE.MathUtils.randFloatSpread(90))
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3))
  ambientDust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.035, color: 0x78ffd6, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }))
  detailGroup.add(ambientDust)
}

function createWorldArchitecture() {
  reactorGroup = new THREE.Group()
  for (let i = 0; i < 12; i++) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(0.45 + (i % 3) * 0.1, 0.25 + Math.random() * 0.5, 3 + Math.random() * 3),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0x182040 : 0x12182f, metalness: 0.45, roughness: 0.4 })
    )
    slab.position.set(Math.sin(i * 2.2) * (3.5 + i * 0.22), 0.25, Math.cos(i * 1.9) * (3.5 + i * 0.22))
    slab.rotation.y = i * 0.63
    reactorGroup.add(slab)
  }
  const reactorCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 18, 12),
    new THREE.MeshBasicMaterial({ color: 0x9ef01a, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending })
  )
  reactorCore.position.y = 0.6
  reactorGroup.add(reactorCore)
  reactorLight = new THREE.PointLight(0x9ef01a, 4, 14, 2)
  reactorLight.position.y = 1
  reactorGroup.add(reactorLight)
  worldGroup.add(reactorGroup)

  // Procedural distant skyline.
  for (let i = 0; i < 110; i++) {
    const a = (i / 110) * Math.PI * 2 + Math.random() * 0.1
    const r = 36 + Math.random() * 10
    const h = 0.8 + Math.random() * 6.5
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(0.5 + Math.random() * 1.2, h, 0.5 + Math.random() * 1.2),
      new THREE.MeshStandardMaterial({ color: 0x11162b, emissive: 0x10152b, emissiveIntensity: 0.3, roughness: 0.75 })
    )
    tower.position.set(Math.cos(a) * r, h / 2 - 0.05, Math.sin(a) * r)
    tower.rotation.y = Math.random() * Math.PI
    detailGroup.add(tower)
  }

  // Outer world portal / horizon ring.
  portalGroup = new THREE.Group()
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(47 + i * 1.2, 0.035, 6, 160),
      new THREE.MeshBasicMaterial({ color: i === 0 ? 0x2e4cff : i === 1 ? 0x78ffd6 : 0xff4ecd, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending })
    )
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.15 + i * 0.14
    ring.userData.spin = (i % 2 ? -1 : 1) * (0.02 + i * 0.01)
    portalGroup.add(ring)
  }
  detailGroup.add(portalGroup)
}

function createAmbientLife() {
  PROJECTS.forEach((project, idx) => {
    const positions = []
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 2 + Math.random() * 4
      positions.push(project.position[0] + Math.cos(a) * r, 0.4 + Math.random() * 3.5, project.position[1] + Math.sin(a) * r)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const cloud = new THREE.Points(geo, new THREE.PointsMaterial({ color: project.accent, size: 0.075, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false }))
    cloud.userData = { center: new THREE.Vector3(project.position[0], 0, project.position[1]), phase: idx }
    detailGroup.add(cloud)
    fireflyClouds.push(cloud)
  })
}

function createMeteors() {
  for (let i = 0; i < 5; i++) {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(-4, 2, 0)])
    const meteor = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: i % 2 ? 0x78ffd6 : 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }))
    meteor.userData = { speed: 18 + Math.random() * 18, delay: 3 + Math.random() * 22, active: false }
    resetMeteor(meteor, true)
    scene.add(meteor)
    meteors.push(meteor)
  }
}

function resetMeteor(meteor, initial = false) {
  meteor.position.set(-70 + Math.random() * 45, 35 + Math.random() * 30, -60 + Math.random() * 45)
  meteor.userData.delay = initial ? Math.random() * 20 : 8 + Math.random() * 24
  meteor.userData.active = false
  meteor.material.opacity = 0
}

// ---------- Movement and interaction ----------
window.addEventListener('keydown', (event) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
  state.keys.add(event.code)
  if (event.code === 'KeyE' || event.code === 'Enter') interact()
  if (event.code === 'KeyM') toggleMap()
  if (event.code === 'Escape') {
    closePanel()
    help.classList.add('hidden')
    mapOverlay.classList.add('hidden')
  }
})
window.addEventListener('keyup', (event) => state.keys.delete(event.code))

window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return
  mouseLook.x = (event.clientX / innerWidth - 0.5) * 2
  mouseLook.y = (event.clientY / innerHeight - 0.5) * 2
})

function getInput() {
  let x = state.touch.x
  let y = state.touch.y
  if (state.keys.has('KeyA') || state.keys.has('ArrowLeft')) x -= 1
  if (state.keys.has('KeyD') || state.keys.has('ArrowRight')) x += 1
  if (state.keys.has('KeyW') || state.keys.has('ArrowUp')) y -= 1
  if (state.keys.has('KeyS') || state.keys.has('ArrowDown')) y += 1
  const len = Math.hypot(x, y)
  if (len > 1) { x /= len; y /= len }
  return { x, y }
}

function interact() {
  if (!state.started || state.panelOpen) return
  if (state.nearest?.type === 'project') openProject(state.nearest.project)
}

function openProject(project) {
  state.panelOpen = true
  const firstDiscovery = !state.discovered.has(project.id)
  state.discovered.add(project.id)
  saveProgress()
  $('#panelTag').textContent = project.tag
  $('#panelTitle').textContent = project.title
  $('#panelDescription').textContent = project.description
  $('#panelMeta').innerHTML = project.skills.map(s => `<span>${s}</span>`).join('')
  const link = $('#panelLink')
  if (project.link === '#') link.classList.add('hidden')
  else { link.classList.remove('hidden'); link.href = project.link }
  panel.style.setProperty('--panel-accent', '#' + new THREE.Color(project.accent).getHexString())
  panel.classList.remove('hidden')
  updateProgressUI()
  $('#missionText').textContent = state.discovered.size === PROJECTS.length ? 'All primary signals found — hunt the fragments' : `Signals found ${state.discovered.size}/${PROJECTS.length}`
  playChord([projectFrequency(project.id), projectFrequency(project.id) * 1.5], 0.2, 0.025)
  pulseProject(project.id)
  spawnBurst(core.position, project.accent, 30)
  spawnShockwave(project.accent, 0.8)
  if (firstDiscovery) showEvent('NEW SIGNAL LOGGED', project.title)
  if (state.discovered.size === PROJECTS.length) {
    showToast('ACHIEVEMENT · WORLD READER — every primary signal discovered')
    worldCelebration()
  }
}

function closePanel() {
  state.panelOpen = false
  panel.classList.add('hidden')
}

function pulseProject(id) {
  const obj = projectObjects.find(o => o.userData.project.id === id)
  if (!obj) return
  obj.userData.orbital.scale.setScalar(1.45)
  obj.userData.orbital2.scale.setScalar(0.75)
  setTimeout(() => {
    obj.userData.orbital.scale.setScalar(1)
    obj.userData.orbital2.scale.setScalar(1)
  }, 420)
}

function findNearestInteractable() {
  let nearest = null
  let best = Infinity
  projectObjects.forEach((obj) => {
    const d = Math.hypot(core.position.x - obj.position.x, core.position.z - obj.position.z)
    if (d < best && d < 4.35) {
      best = d
      nearest = { type: 'project', project: obj.userData.project, object: obj, distance: d }
    }
  })
  state.nearest = nearest
  interactHint.classList.toggle('hidden', !nearest || state.panelOpen)
  if (nearest) interactHint.innerHTML = `Press <kbd>E</kbd> · ${nearest.project.title}`
}

function collectSecrets(elapsed) {
  secretObjects.forEach((obj) => {
    if (!obj.visible) return
    obj.rotation.x += 0.015
    obj.rotation.y += 0.024
    obj.userData.halo.rotation.z += 0.02
    obj.position.y = 0.85 + Math.sin(elapsed * 2.4 + obj.position.x) * 0.16
    const d = Math.hypot(core.position.x - obj.position.x, core.position.z - obj.position.z)
    if (d < 1.3) {
      obj.visible = false
      state.secrets.add(obj.userData.secret.id)
      saveProgress()
      updateProgressUI()
      playChord([740 + state.secrets.size * 110, 1110 + state.secrets.size * 70], 0.34, 0.035)
      spawnBurst(obj.position, 0xff4ecd, 55)
      spawnShockwave(0xff4ecd, 1.2)
      showToast(`SECRET FOUND · ${obj.userData.secret.label} · ${state.secrets.size}/${SECRETS.length}`)
      if (state.secrets.size === SECRETS.length) {
        showEvent('MOD ARCHIVIST', 'Hidden signal complete. The world remembers you.')
        worldCelebration()
      }
    }
  })
}

function updateZone() {
  let nearestProject = null
  let distance = Infinity
  projectObjects.forEach((obj) => {
    const d = Math.hypot(core.position.x - obj.position.x, core.position.z - obj.position.z)
    if (d < distance) { distance = d; nearestProject = obj.userData.project }
  })

  const targetAccent = nearestProject && distance < 11 ? new THREE.Color(nearestProject.accent) : new THREE.Color(0x78ffd6)
  state.zoneAccent.lerp(targetAccent, 0.025)
  const nextZone = nearestProject && distance < 9 ? nearestProject.title.toUpperCase() : 'THE NULL'
  if (nextZone !== state.zone) {
    state.zone = nextZone
    zoneText.textContent = nextZone
    zoneText.animate([{ opacity: .25, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 420 })
  }

  tempColor.copy(baseFogColor).lerp(state.zoneAccent, 0.11)
  scene.fog.color.lerp(tempColor, 0.025)
  tempColor.copy(baseBackground).lerp(state.zoneAccent, 0.035)
  scene.background.lerp(tempColor, 0.018)
  coreLight.color.lerp(state.zoneAccent, 0.035)
  trail.material.color.lerp(state.zoneAccent, 0.045)
  ambientDust.material.color.lerp(state.zoneAccent, 0.02)
  document.documentElement.style.setProperty('--zone-accent', '#' + state.zoneAccent.getHexString())

  updateBeaconAudio(nearestProject, distance)
}

// ---------- Visual effects ----------
function spawnShockwave(color = 0x78ffd6, strength = 1) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.8, 64),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.copy(core.position)
  mesh.position.y = 0.14
  scene.add(mesh)
  effects.push({ type: 'shockwave', object: mesh, life: 0, maxLife: 0.7 + strength * 0.15, strength })
}

function spawnBurst(position, color = 0xffffff, count = 24) {
  const positions = new Float32Array(count * 3)
  const velocities = []
  for (let i = 0; i < count; i++) {
    positions[i * 3] = position.x
    positions[i * 3 + 1] = Math.max(0.4, position.y)
    positions[i * 3 + 2] = position.z
    const v = new THREE.Vector3(THREE.MathUtils.randFloatSpread(1), Math.random() * 0.85 + 0.2, THREE.MathUtils.randFloatSpread(1)).normalize().multiplyScalar(2 + Math.random() * 5)
    velocities.push(v)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.11, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }))
  scene.add(points)
  effects.push({ type: 'burst', object: points, velocities, life: 0, maxLife: 1.1 })
}

function updateEffects(dt) {
  effects = effects.filter(effect => {
    effect.life += dt
    const t = effect.life / effect.maxLife
    if (effect.type === 'shockwave') {
      const scale = 1 + t * 9 * effect.strength
      effect.object.scale.setScalar(scale)
      effect.object.material.opacity = (1 - t) * 0.65
    } else if (effect.type === 'burst') {
      const arr = effect.object.geometry.attributes.position.array
      effect.velocities.forEach((v, i) => {
        v.y -= 4.5 * dt
        arr[i * 3] += v.x * dt
        arr[i * 3 + 1] += v.y * dt
        arr[i * 3 + 2] += v.z * dt
      })
      effect.object.geometry.attributes.position.needsUpdate = true
      effect.object.material.opacity = 1 - t
    }
    if (t >= 1) {
      scene.remove(effect.object)
      effect.object.geometry?.dispose?.()
      effect.object.material?.dispose?.()
      return false
    }
    return true
  })
}

function worldCelebration() {
  playChord([220, 277.18, 329.63, 440, 554.37], 0.75, 0.02)
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const p = new THREE.Vector3(THREE.MathUtils.randFloatSpread(24), 1 + Math.random() * 3, THREE.MathUtils.randFloatSpread(24))
      spawnBurst(p, [0x78ffd6, 0xff4ecd, 0x7de2ff, 0xffd166][i % 4], 45)
    }, i * 180)
  }
  renderer.toneMappingExposure = 1.5
  setTimeout(() => { renderer.toneMappingExposure = 1.2 }, 1200)
}

// ---------- Audio ----------
function initAudio() {
  if (state.audio) return
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const master = ctx.createGain()
    master.gain.value = state.muted ? 0.0001 : 0.48
    master.connect(ctx.destination)

    const ambientGain = ctx.createGain()
    ambientGain.gain.value = 0.035
    ambientGain.connect(master)

    const engineGain = ctx.createGain()
    engineGain.gain.value = 0.0001
    engineGain.connect(master)

    const beaconGain = ctx.createGain()
    beaconGain.gain.value = 0.0001
    beaconGain.connect(master)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 680
    filter.Q.value = 0.7
    filter.connect(ambientGain)

    const drone1 = ctx.createOscillator()
    drone1.type = 'sine'
    drone1.frequency.value = 55
    const drone2 = ctx.createOscillator()
    drone2.type = 'triangle'
    drone2.frequency.value = 82.5
    const drone2Gain = ctx.createGain()
    drone2Gain.gain.value = 0.32
    drone1.connect(filter)
    drone2.connect(drone2Gain).connect(filter)

    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.09
    lfoGain.gain.value = 180
    lfo.connect(lfoGain).connect(filter.frequency)

    const engineOsc = ctx.createOscillator()
    engineOsc.type = 'sawtooth'
    engineOsc.frequency.value = 52
    const engineFilter = ctx.createBiquadFilter()
    engineFilter.type = 'lowpass'
    engineFilter.frequency.value = 420
    engineOsc.connect(engineFilter).connect(engineGain)

    const beaconOsc = ctx.createOscillator()
    beaconOsc.type = 'sine'
    beaconOsc.frequency.value = 220
    beaconOsc.connect(beaconGain)

    ;[drone1, drone2, lfo, engineOsc, beaconOsc].forEach(o => o.start())
    state.audio = { ctx, master, ambientGain, engineGain, beaconGain, filter, drone1, drone2, lfo, engineOsc, engineFilter, beaconOsc }
  } catch {}
}

function resumeAudio() {
  if (!state.audio) return
  state.audio.ctx.resume?.()
  fadeAudio(state.muted ? 0.0001 : 0.48)
}

function fadeAudio(value) {
  if (!state.audio) return
  const { ctx, master } = state.audio
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setTargetAtTime(value, ctx.currentTime, 0.08)
}

function playTone(freq, duration, volume = 0.04, type = 'sine') {
  if (state.muted || !state.audio) return
  const { ctx, master } = state.audio
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, ctx.currentTime)
  gain.gain.setValueAtTime(Math.max(0.0001, volume), ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
  osc.connect(gain).connect(master)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}

function playChord(freqs, duration, volume = 0.03) {
  freqs.forEach((freq, i) => setTimeout(() => playTone(freq, duration, volume / Math.max(1, freqs.length * 0.58), i % 2 ? 'triangle' : 'sine'), i * 28))
}

function playWhoosh() {
  if (state.muted || !state.audio) return
  const { ctx, master } = state.audio
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.22), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  const src = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  src.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(420, ctx.currentTime)
  filter.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.2)
  filter.Q.value = 0.6
  gain.gain.value = 0.032
  src.connect(filter).connect(gain).connect(master)
  src.start()
}

function updateAudio(speed, boosting) {
  if (!state.audio) return
  const { ctx, engineGain, engineOsc, engineFilter, filter } = state.audio
  const normalized = Math.min(1, speed / 13)
  engineGain.gain.setTargetAtTime(state.started && !state.muted ? 0.003 + normalized * 0.018 + (boosting ? 0.012 : 0) : 0.0001, ctx.currentTime, 0.05)
  engineOsc.frequency.setTargetAtTime(48 + speed * 7.5 + (boosting ? 20 : 0), ctx.currentTime, 0.045)
  engineFilter.frequency.setTargetAtTime(320 + speed * 48 + (boosting ? 450 : 0), ctx.currentTime, 0.08)
  filter.frequency.setTargetAtTime(620 + Math.sin(clock.elapsedTime * 0.14) * 170, ctx.currentTime, 0.4)
}

function updateBeaconAudio(project, distance) {
  if (!state.audio) return
  const { ctx, beaconGain, beaconOsc } = state.audio
  const near = project && distance < 12
  beaconGain.gain.setTargetAtTime(near && !state.muted ? Math.max(0, (1 - distance / 12)) * 0.013 : 0.0001, ctx.currentTime, 0.15)
  if (project) beaconOsc.frequency.setTargetAtTime(projectFrequency(project.id), ctx.currentTime, 0.2)
}

function projectFrequency(id) {
  const notes = [174.61, 196, 220, 246.94, 277.18, 329.63]
  const index = Math.max(0, PROJECTS.findIndex(p => p.id === id))
  return notes[index % notes.length]
}

function toggleAudio() {
  state.muted = !state.muted
  $('#audioBtn').textContent = state.muted ? 'MUTED' : 'AUDIO'
  initAudio()
  fadeAudio(state.muted ? 0.0001 : 0.48)
  if (!state.muted) playChord([220, 330], .1, .03)
}

function toggleQuality() {
  state.quality = state.quality === 'high' ? 'low' : 'high'
  renderer.setPixelRatio(state.quality === 'high' ? Math.min(devicePixelRatio, 2) : 1)
  $('#qualityBtn').textContent = state.quality.toUpperCase()
  particles.visible = state.quality === 'high'
  ambientDust.visible = state.quality === 'high'
  detailGroup.visible = state.quality === 'high'
  auroraGroup.visible = state.quality === 'high'
  meteors.forEach(m => m.visible = state.quality === 'high')
}

// ---------- Map ----------
function toggleMap() {
  if (!state.started) return
  state.mapOpen = mapOverlay.classList.contains('hidden')
  mapOverlay.classList.toggle('hidden')
  drawMap()
}

function drawMap() {
  const c = $('#miniMap')
  const ctx = c.getContext('2d')
  const w = c.width, h = c.height
  ctx.clearRect(0, 0, w, h)
  const grd = ctx.createRadialGradient(w/2, h/2, 10, w/2, h/2, w * .6)
  grd.addColorStop(0, '#11172c')
  grd.addColorStop(1, '#070812')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, w, h)
  const scale = 7.2
  const tx = (x) => w / 2 + x * scale
  const ty = (z) => h / 2 + z * scale
  ctx.strokeStyle = 'rgba(130,160,255,.13)'
  ctx.lineWidth = 1
  for (let r = 9; r <= 40; r += 9) {
    ctx.beginPath(); ctx.arc(w/2, h/2, r*scale, 0, Math.PI*2); ctx.stroke()
  }
  PROJECTS.forEach(p => {
    ctx.beginPath(); ctx.fillStyle = '#' + new THREE.Color(p.accent).getHexString(); ctx.arc(tx(p.position[0]), ty(p.position[1]), state.discovered.has(p.id) ? 8 : 5, 0, Math.PI*2); ctx.fill()
    if (state.discovered.has(p.id)) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.stroke() }
    ctx.fillStyle = '#eaf0ff'; ctx.font = '600 13px system-ui'; ctx.fillText(p.title, tx(p.position[0]) + 12, ty(p.position[1]) + 4)
  })
  SECRETS.forEach(s => {
    if (!state.secrets.has(s.id)) return
    ctx.fillStyle = '#ff4ecd'
    ctx.fillRect(tx(s.position[0]) - 3, ty(s.position[1]) - 3, 6, 6)
  })
  ctx.beginPath(); ctx.fillStyle = '#ffffff'; ctx.arc(tx(core.position.x), ty(core.position.z), 6, 0, Math.PI*2); ctx.fill()
}

// ---------- Touch joystick ----------
const joystick = $('#joystick')
const stick = $('#stick')
let joystickPointer = null

function updateStick(event) {
  const rect = joystick.getBoundingClientRect()
  const dx = event.clientX - (rect.left + rect.width / 2)
  const dy = event.clientY - (rect.top + rect.height / 2)
  const max = rect.width * 0.32
  const len = Math.hypot(dx, dy) || 1
  const scale = Math.min(1, max / len)
  const x = dx * scale
  const y = dy * scale
  stick.style.transform = `translate(${x}px, ${y}px)`
  state.touch.x = x / max
  state.touch.y = y / max
}
joystick.addEventListener('pointerdown', (e) => { joystickPointer = e.pointerId; joystick.setPointerCapture(e.pointerId); updateStick(e) })
joystick.addEventListener('pointermove', (e) => { if (e.pointerId === joystickPointer) updateStick(e) })
function clearStick(e) { if (joystickPointer !== null && (!e || e.pointerId === joystickPointer)) { joystickPointer = null; state.touch.x = 0; state.touch.y = 0; stick.style.transform = 'translate(0,0)' } }
joystick.addEventListener('pointerup', clearStick)
joystick.addEventListener('pointercancel', clearStick)
const touchPulse = $('#touchPulse')
touchPulse.addEventListener('pointerdown', (e) => { e.preventDefault(); state.touch.boost = true; touchPulse.setPointerCapture?.(e.pointerId) })
touchPulse.addEventListener('pointerup', () => { state.touch.boost = false })
touchPulse.addEventListener('pointercancel', () => { state.touch.boost = false })
touchPulse.addEventListener('pointerleave', () => { state.touch.boost = false })
$('#touchInteract').addEventListener('pointerdown', interact)

// ---------- Feedback ----------
let toastTimer
function showToast(message) {
  clearTimeout(toastTimer)
  toast.textContent = message
  toast.classList.remove('hidden')
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3100)
}

let eventTimer
function showEvent(title, copy) {
  clearTimeout(eventTimer)
  $('#eventTitle').textContent = title
  $('#eventCopy').textContent = copy
  eventBanner.classList.remove('hidden')
  eventBanner.animate([
    { opacity: 0, transform: 'translate(-50%, -14px) scale(.96)' },
    { opacity: 1, transform: 'translate(-50%, 0) scale(1)' }
  ], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' })
  eventTimer = setTimeout(() => eventBanner.classList.add('hidden'), 3500)
}

// ---------- Animation ----------
function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.033)
  const elapsed = clock.elapsedTime

  let boosting = false
  if (state.started && !state.panelOpen && mapOverlay.classList.contains('hidden') && help.classList.contains('hidden')) {
    const input = getInput()
    const boostRequested = state.keys.has('ShiftLeft') || state.keys.has('ShiftRight') || state.touch.boost
    boosting = boostRequested && state.energy > 2 && (Math.abs(input.x) + Math.abs(input.y) > 0.05)
    const accel = boosting ? 19.5 : 11
    velocity.x += input.x * accel * dt
    velocity.z += input.y * accel * dt
    const damping = Math.pow(0.045, dt)
    velocity.x *= damping
    velocity.z *= damping
    const maxSpeed = boosting ? 14 : 7.5
    if (velocity.length() > maxSpeed) velocity.setLength(maxSpeed)
    core.position.x += velocity.x * dt
    core.position.z += velocity.z * dt

    if (boosting) state.energy = Math.max(0, state.energy - dt * 22)
    else state.energy = Math.min(100, state.energy + dt * 10)

    const r = Math.hypot(core.position.x, core.position.z)
    if (r > 44) {
      core.position.x *= 44 / r
      core.position.z *= 44 / r
      velocity.multiplyScalar(-0.2)
      spawnShockwave(0x6f86ff, 0.45)
      playTone(130, 0.08, 0.025, 'triangle')
    }

    if (velocity.lengthSq() > 0.1) {
      core.rotation.y = THREE.MathUtils.lerp(core.rotation.y, Math.atan2(velocity.x, velocity.z), 0.13)
    }
    state.boost = THREE.MathUtils.lerp(state.boost, boosting ? 1 : 0, 0.12)

    if (boosting && !state.lastBoosting) {
      spawnShockwave(state.zoneAccent.getHex(), 0.7)
      playWhoosh()
      cameraShake.x = 0.28
      cameraShake.y = 0.17
      if (!state.firstBoost) {
        state.firstBoost = true
        showToast('PULSE DRIVE ENGAGED · hold SHIFT while moving')
      }
    }
    state.lastBoosting = boosting
  } else {
    state.boost = THREE.MathUtils.lerp(state.boost, 0, 0.14)
  }

  const speed = velocity.length()
  state.distanceTravelled += core.position.distanceTo(state.lastCorePosition)
  state.lastCorePosition.copy(core.position)
  energyFill.style.transform = `scaleX(${state.energy / 100})`
  speedText.textContent = `${Math.round(speed * 10)} u/s`
  document.body.classList.toggle('boosting', boosting)

  core.position.y = 0.92 + Math.sin(elapsed * 3.1) * 0.07 + state.boost * 0.04
  coreHalo.rotation.z += dt * (0.75 + state.boost * 4.2)
  core.userData.halo2.rotation.x += dt * (0.55 + state.boost * 2)
  core.userData.halo2.rotation.z -= dt * 0.35
  coreHalo.scale.setScalar(1 + state.boost * 0.38)
  coreInner.rotation.x += dt * 0.65
  coreInner.rotation.y -= dt * 0.8
  coreInner.scale.setScalar(0.95 + Math.sin(elapsed * 5.5) * 0.05 + state.boost * 0.15)
  coreLight.intensity = 5 + state.boost * 8

  projectObjects.forEach((obj, i) => {
    obj.userData.orbital.rotation.z += dt * (0.4 + i * 0.04)
    obj.userData.orbital2.rotation.z -= dt * (0.22 + i * 0.025)
    const discoveredBoost = state.discovered.has(obj.userData.project.id) ? 0.85 : 0
    obj.userData.beacon.material.emissiveIntensity = 0.65 + Math.sin(elapsed * 2 + i) * 0.23 + discoveredBoost
    obj.userData.light.intensity = 1.5 + Math.sin(elapsed * 1.4 + i) * 0.55 + discoveredBoost * 1.7
  })

  animatedProps.forEach(item => animateProp(item, elapsed, dt))
  reactorGroup.rotation.y += dt * 0.035
  reactorLight.intensity = 3.5 + Math.sin(elapsed * 2.2) * 1.5 + state.discovered.size * 0.25
  portalGroup.children.forEach(ring => ring.rotation.z += dt * ring.userData.spin)

  auroraGroup.children.forEach((tube, i) => {
    tube.material.opacity = 0.085 + Math.sin(elapsed * 0.35 + tube.userData.phase) * 0.035
    tube.position.x = Math.sin(elapsed * 0.08 + i) * 2.5
  })
  stars.rotation.y += dt * 0.0018
  particles.rotation.y += dt * 0.007
  ambientDust.rotation.y -= dt * 0.009
  ambientDust.position.y = Math.sin(elapsed * 0.3) * 0.15
  fireflyClouds.forEach((cloud, i) => {
    cloud.rotation.y += dt * (0.06 + i * 0.006)
    cloud.position.y = Math.sin(elapsed * 0.7 + i) * 0.15
    cloud.material.opacity = 0.3 + Math.sin(elapsed * 1.4 + i) * 0.11
  })

  updateMeteors(dt)
  updateEffects(dt)
  collectSecrets(elapsed)
  if (state.started) {
    findNearestInteractable()
    updateZone()
  }

  // Trail: longer and brighter at boost speed.
  trailPoints.unshift(core.position.clone().add(new THREE.Vector3(0, -0.2, 0)))
  trailPoints = trailPoints.slice(0, 20 + Math.round(state.boost * 20))
  if (trailPoints.length > 1) {
    trail.geometry.setFromPoints(trailPoints)
    trailGlow.geometry.setFromPoints(trailPoints)
  }
  trail.material.opacity = 0.26 + Math.min(0.5, speed / 18) + state.boost * 0.2
  trailGlow.material.opacity = state.boost * 0.34

  // Camera follows from an elevated cinematic angle with mouse parallax + tiny boost shake.
  cameraShake.multiplyScalar(Math.pow(0.02, dt))
  const targetCam = new THREE.Vector3(
    core.position.x + mouseLook.x * 2.2 + cameraShake.x * Math.sin(elapsed * 48),
    18 + mouseLook.y * -1.2 + cameraShake.y * Math.cos(elapsed * 53) - state.boost * 0.7,
    core.position.z + 24 + state.boost * 2.4
  )
  camera.position.lerp(targetCam, 1 - Math.pow(0.001, dt))
  camera.lookAt(core.position.x, 0, core.position.z - 2.5 - state.boost * 2)
  camera.fov = THREE.MathUtils.lerp(camera.fov, 48 + state.boost * 5, 0.08)
  camera.updateProjectionMatrix()

  updateAudio(speed, boosting)
  renderer.render(scene, camera)
}
animate()

function animateProp(item, elapsed, dt) {
  const o = item.object
  const phase = item.phase || 0
  if (item.type === 'floatCard') {
    o.position.y = item.originY + Math.sin(elapsed * 1.2 + phase) * 0.22
    o.rotation.z = Math.sin(elapsed * 0.5 + phase) * 0.08
  } else if (item.type === 'routeRing') {
    o.rotation.z += dt * (0.08 + phase * 0.018)
    o.material.opacity = 0.16 + Math.sin(elapsed * 1.2 + phase) * 0.08
  } else if (item.type === 'orbitPlane') {
    const a = elapsed * 0.42 + phase
    o.position.x = Math.cos(a) * 4.4
    o.position.z = Math.sin(a) * 4.4
    o.position.y = 2.7 + Math.sin(a * 2) * 0.7
    o.rotation.y = -a
    o.rotation.z = Math.sin(a) * 0.18
  } else if (item.type === 'crystal') {
    o.position.y = item.originY + Math.sin(elapsed * 1.6 + phase) * 0.12
    o.rotation.y += dt * 0.12
  } else if (item.type === 'crane') {
    o.rotation.y = Math.sin(elapsed * 0.25 + phase) * 0.5
  } else if (item.type === 'labKnot') {
    o.rotation.x += dt * (0.25 + phase * 0.02)
    o.rotation.y -= dt * 0.35
    o.scale.setScalar(0.75 + Math.sin(elapsed * 1.3 + phase) * 0.1)
  } else if (item.type === 'pylon') {
    o.scale.y = 0.8 + Math.sin(elapsed * 2 + phase) * 0.18
  } else if (item.type === 'drone') {
    const a = elapsed * 0.6 + phase
    o.position.set(Math.cos(a) * item.radius, 2.5 + Math.sin(a * 2) * 0.5, Math.sin(a) * item.radius)
    o.rotation.y = -a
  } else if (item.type === 'groundRing') {
    o.rotation.z += dt * (o.userData.speed || 0.02)
  }
}

function updateMeteors(dt) {
  meteors.forEach(meteor => {
    if (!meteor.visible) return
    if (!meteor.userData.active) {
      meteor.userData.delay -= dt
      if (meteor.userData.delay <= 0) {
        meteor.userData.active = true
        meteor.material.opacity = 0.5 + Math.random() * 0.4
      }
      return
    }
    meteor.position.x += meteor.userData.speed * dt
    meteor.position.y -= meteor.userData.speed * 0.45 * dt
    if (meteor.position.x > 80 || meteor.position.y < 5) resetMeteor(meteor)
  })
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

// Open the origin signal as the player's first breadcrumb.
setTimeout(() => {
  if (!state.simple) $('#missionText').textContent = state.discovered.size ? `Signal memory restored · ${state.discovered.size}/${PROJECTS.length}` : 'Find the glowing signals. Start at the center.'
}, 1200)
