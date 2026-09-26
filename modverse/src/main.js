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
  audio: null,
  mapOpen: false,
  panelOpen: false,
  touch: { x: 0, y: 0 },
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

$('#totalCount').textContent = PROJECTS.length

function enterWorld() {
  state.started = true
  state.simple = false
  boot.classList.add('hidden')
  simpleView.classList.add('hidden')
  canvas.classList.remove('hidden')
  hud.classList.remove('hidden')
  mission.classList.remove('hidden')
  credit.classList.remove('hidden')
  if (matchMedia('(pointer: coarse)').matches) touchControls.classList.remove('hidden')
  initAudio()
  playTone(220, 0.08, 0.04)
}

function enterSimple() {
  state.simple = true
  state.started = false
  boot.classList.add('hidden')
  hud.classList.add('hidden')
  mission.classList.add('hidden')
  touchControls.classList.add('hidden')
  credit.classList.add('hidden')
  canvas.classList.add('hidden')
  simpleView.classList.remove('hidden')
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
populateSimpleView()

// ---------- Three.js world ----------
let renderer, scene, camera, clock, core, coreHalo, trail, trailPoints = []
let velocity = new THREE.Vector3()
let projectObjects = []
let secretObjects = []
let particles
let worldGroup
const mouseLook = new THREE.Vector2()

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
renderer.toneMappingExposure = 1.15

scene = new THREE.Scene()
scene.background = new THREE.Color(0x070810)
scene.fog = new THREE.FogExp2(0x070810, 0.018)
clock = new THREE.Clock()

camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 300)
camera.position.set(0, 22, 29)

worldGroup = new THREE.Group()
scene.add(worldGroup)

const hemi = new THREE.HemisphereLight(0x9db8ff, 0x17131f, 2.2)
scene.add(hemi)
const keyLight = new THREE.DirectionalLight(0xffffff, 2.8)
keyLight.position.set(12, 25, 16)
scene.add(keyLight)

createGround()
createCore()
createProjectSignals()
createSecrets()
createParticles()
createWorldArchitecture()

function createGround() {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(50, 96),
    new THREE.MeshStandardMaterial({ color: 0x0d1020, roughness: 0.78, metalness: 0.18 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.15
  worldGroup.add(ground)

  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x223052, transparent: true, opacity: 0.36 })
  ;[9, 18, 31, 43].forEach((radius) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.035, radius + 0.035, 128), ringMaterial)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -0.11
    worldGroup.add(ring)
  })

  const grid = new THREE.GridHelper(92, 46, 0x1a2750, 0x11182e)
  grid.position.y = -0.1
  grid.material.transparent = true
  grid.material.opacity = 0.38
  worldGroup.add(grid)
}

function createCore() {
  core = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.68, 2),
    new THREE.MeshPhysicalMaterial({ color: 0xe9f9ff, emissive: 0x2dffc0, emissiveIntensity: 1.4, metalness: 0.28, roughness: 0.18, clearcoat: 1 })
  )
  core.add(body)
  coreHalo = new THREE.Mesh(
    new THREE.TorusGeometry(1.05, 0.045, 12, 64),
    new THREE.MeshBasicMaterial({ color: 0x78ffd6, transparent: true, opacity: 0.75 })
  )
  coreHalo.rotation.x = Math.PI / 2
  core.add(coreHalo)
  core.position.set(0, 0.9, 4)
  scene.add(core)

  const trailGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
  trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0x6effd5, transparent: true, opacity: 0.42 }))
  scene.add(trail)
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
      new THREE.MeshPhysicalMaterial({ color: project.accent, emissive: project.accent, emissiveIntensity: 0.8, transparent: true, opacity: 0.88, roughness: 0.22 })
    )
    beacon.position.y = 2
    group.add(beacon)

    const orbital = new THREE.Mesh(
      new THREE.TorusGeometry(1.65, 0.06, 8, 48),
      new THREE.MeshBasicMaterial({ color: project.accent, transparent: true, opacity: 0.8 })
    )
    orbital.rotation.x = Math.PI / 2
    orbital.position.y = 1.05
    group.add(orbital)

    const label = makeTextSprite(project.title.toUpperCase(), project.accent)
    label.position.set(0, 4.6, 0)
    label.scale.set(4.8, 1.2, 1)
    group.add(label)

    group.userData.beacon = beacon
    group.userData.orbital = orbital
    worldGroup.add(group)
    projectObjects.push(group)
  })
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
  SECRETS.forEach((secret) => {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.48, 0),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xff4ecd, emissiveIntensity: 2.8, metalness: 0.25, roughness: 0.1 })
    )
    mesh.position.set(secret.position[0], 0.75, secret.position[1])
    mesh.userData = { type: 'secret', secret }
    worldGroup.add(mesh)
    secretObjects.push(mesh)
  })
}

function createParticles() {
  const positions = []
  for (let i = 0; i < 800; i++) {
    const radius = 10 + Math.random() * 70
    const theta = Math.random() * Math.PI * 2
    positions.push(Math.cos(theta) * radius, Math.random() * 18 + 2, Math.sin(theta) * radius)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  particles = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.045, color: 0xc7d3ff, transparent: true, opacity: 0.55 }))
  scene.add(particles)
}

function createWorldArchitecture() {
  // Central "mod reactor"
  const reactor = new THREE.Group()
  for (let i = 0; i < 10; i++) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(0.45 + (i % 3) * 0.1, 0.25 + Math.random() * 0.5, 3 + Math.random() * 3),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0x182040 : 0x12182f, metalness: 0.45, roughness: 0.4 })
    )
    slab.position.set(Math.sin(i * 2.2) * (3.5 + i * 0.22), 0.25, Math.cos(i * 1.9) * (3.5 + i * 0.22))
    slab.rotation.y = i * 0.63
    reactor.add(slab)
  }
  worldGroup.add(reactor)

  // Procedural distant skyline to make the portfolio feel like a tiny "world" rather than a room.
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2 + Math.random() * 0.1
    const r = 36 + Math.random() * 9
    const h = 0.8 + Math.random() * 5
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(0.5 + Math.random() * 1.2, h, 0.5 + Math.random() * 1.2),
      new THREE.MeshStandardMaterial({ color: 0x11162b, emissive: 0x10152b, emissiveIntensity: 0.3, roughness: 0.75 })
    )
    tower.position.set(Math.cos(a) * r, h / 2 - 0.05, Math.sin(a) * r)
    tower.rotation.y = Math.random() * Math.PI
    worldGroup.add(tower)
  }
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
  state.discovered.add(project.id)
  $('#panelTag').textContent = project.tag
  $('#panelTitle').textContent = project.title
  $('#panelDescription').textContent = project.description
  $('#panelMeta').innerHTML = project.skills.map(s => `<span>${s}</span>`).join('')
  const link = $('#panelLink')
  if (project.link === '#') link.classList.add('hidden')
  else { link.classList.remove('hidden'); link.href = project.link }
  panel.classList.remove('hidden')
  $('#discoveredCount').textContent = state.discovered.size
  $('#missionText').textContent = state.discovered.size === PROJECTS.length ? 'All primary signals found — hunt the fragments' : `Signals found ${state.discovered.size}/${PROJECTS.length}`
  playTone(420, 0.12, 0.06)
  pulseProject(project.id)
  if (state.discovered.size === PROJECTS.length) showToast('ACHIEVEMENT · WORLD READER — every primary signal discovered')
}

function closePanel() {
  state.panelOpen = false
  panel.classList.add('hidden')
}

function pulseProject(id) {
  const obj = projectObjects.find(o => o.userData.project.id === id)
  if (!obj) return
  obj.userData.orbital.scale.setScalar(1.45)
  setTimeout(() => obj.userData.orbital.scale.setScalar(1), 350)
}

function findNearestInteractable() {
  let nearest = null
  let best = Infinity
  projectObjects.forEach((obj) => {
    const d = Math.hypot(core.position.x - obj.position.x, core.position.z - obj.position.z)
    if (d < best && d < 4.2) {
      best = d
      nearest = { type: 'project', project: obj.userData.project, object: obj }
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
    obj.position.y = 0.85 + Math.sin(elapsed * 2.4 + obj.position.x) * 0.16
    const d = Math.hypot(core.position.x - obj.position.x, core.position.z - obj.position.z)
    if (d < 1.3) {
      obj.visible = false
      state.secrets.add(obj.userData.secret.id)
      playTone(740 + state.secrets.size * 110, 0.18, 0.08)
      showToast(`SECRET FOUND · ${obj.userData.secret.label} · ${state.secrets.size}/3`)
      if (state.secrets.size === SECRETS.length) showToast('ACHIEVEMENT · MOD ARCHIVIST — hidden signal complete')
    }
  })
}

// ---------- Audio ----------
function initAudio() {
  if (state.audio) return
  try { state.audio = new (window.AudioContext || window.webkitAudioContext)() } catch {}
}
function playTone(freq, duration, volume = 0.04) {
  if (state.muted || !state.audio) return
  const osc = state.audio.createOscillator()
  const gain = state.audio.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(volume, state.audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, state.audio.currentTime + duration)
  osc.connect(gain).connect(state.audio.destination)
  osc.start()
  osc.stop(state.audio.currentTime + duration)
}
function toggleAudio() {
  state.muted = !state.muted
  $('#audioBtn').textContent = state.muted ? 'MUTED' : 'AUDIO'
  if (!state.muted) { initAudio(); playTone(300, .08) }
}

function toggleQuality() {
  state.quality = state.quality === 'high' ? 'low' : 'high'
  renderer.setPixelRatio(state.quality === 'high' ? Math.min(devicePixelRatio, 2) : 1)
  $('#qualityBtn').textContent = state.quality.toUpperCase()
  particles.visible = state.quality === 'high'
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
  ctx.fillStyle = '#090b16'
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
    ctx.fillStyle = '#eaf0ff'; ctx.font = '600 13px system-ui'; ctx.fillText(p.title, tx(p.position[0]) + 12, ty(p.position[1]) + 4)
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
$('#touchInteract').addEventListener('pointerdown', interact)

// ---------- Toast ----------
let toastTimer
function showToast(message) {
  clearTimeout(toastTimer)
  toast.textContent = message
  toast.classList.remove('hidden')
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3100)
}

// ---------- Animation ----------
function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.033)
  const elapsed = clock.elapsedTime

  if (state.started && !state.panelOpen && mapOverlay.classList.contains('hidden') && help.classList.contains('hidden')) {
    const input = getInput()
    const boosting = state.keys.has('ShiftLeft') || state.keys.has('ShiftRight')
    const accel = boosting ? 18 : 11
    velocity.x += input.x * accel * dt
    velocity.z += input.y * accel * dt
    const damping = Math.pow(0.045, dt)
    velocity.x *= damping
    velocity.z *= damping
    const maxSpeed = boosting ? 13 : 7.5
    if (velocity.length() > maxSpeed) velocity.setLength(maxSpeed)
    core.position.x += velocity.x * dt
    core.position.z += velocity.z * dt

    const r = Math.hypot(core.position.x, core.position.z)
    if (r > 44) {
      core.position.x *= 44 / r
      core.position.z *= 44 / r
      velocity.multiplyScalar(-0.2)
    }

    if (velocity.lengthSq() > 0.1) {
      core.rotation.y = THREE.MathUtils.lerp(core.rotation.y, Math.atan2(velocity.x, velocity.z), 0.13)
    }
    state.boost = THREE.MathUtils.lerp(state.boost, boosting && velocity.length() > 1 ? 1 : 0, 0.12)
  }

  core.position.y = 0.92 + Math.sin(elapsed * 3.1) * 0.07
  coreHalo.rotation.z += dt * (0.75 + state.boost * 3.4)
  coreHalo.scale.setScalar(1 + state.boost * 0.32)

  projectObjects.forEach((obj, i) => {
    obj.userData.orbital.rotation.z += dt * (0.4 + i * 0.04)
    obj.userData.beacon.material.emissiveIntensity = 0.65 + Math.sin(elapsed * 2 + i) * 0.23 + (state.discovered.has(obj.userData.project.id) ? 0.75 : 0)
  })

  particles.rotation.y += dt * 0.007
  collectSecrets(elapsed)
  if (state.started) findNearestInteractable()

  // Trail
  trailPoints.unshift(core.position.clone().add(new THREE.Vector3(0, -0.2, 0)))
  trailPoints = trailPoints.slice(0, 18)
  if (trailPoints.length > 1) trail.geometry.setFromPoints(trailPoints)

  // Camera follows from an elevated cinematic angle with subtle mouse parallax.
  const targetCam = new THREE.Vector3(core.position.x + mouseLook.x * 2.2, 18 + mouseLook.y * -1.2, core.position.z + 24)
  camera.position.lerp(targetCam, 1 - Math.pow(0.001, dt))
  camera.lookAt(core.position.x, 0, core.position.z - 2.5)

  renderer.render(scene, camera)
}
animate()

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

// Open the origin signal as the player's first breadcrumb.
setTimeout(() => {
  if (!state.simple) $('#missionText').textContent = 'Find the glowing signals. Start at the center.'
}, 1200)
