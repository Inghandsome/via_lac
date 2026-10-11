import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createPlanets, updatePlanets } from './planets.js'
import { createAstronaut } from './astronaut.js'
import { createSurface } from './surface.js'
import { createAlienExpedition } from './aliens.js'
import './style.css'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)
scene.add(new THREE.HemisphereLight(0xc9dcff, 0x171326, 1.1))

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
)
camera.position.set(0, 18, 22)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.minDistance = 8
controls.maxDistance = 60

// Dibuja un campo de estrellas lejanas con posiciones aleatorias.
const backgroundPositions = new Float32Array(3000 * 3)
for (let i = 0; i < 3000; i += 1) {
  const direction = new THREE.Vector3().randomDirection()
  const radius = 120 + Math.random() * 150
  backgroundPositions[i * 3] = direction.x * radius
  backgroundPositions[i * 3 + 1] = direction.y * radius
  backgroundPositions[i * 3 + 2] = direction.z * radius
}
const backgroundGeometry = new THREE.BufferGeometry()
backgroundGeometry.setAttribute(
  'position',
  new THREE.BufferAttribute(backgroundPositions, 3),
)
const starField = new THREE.Points(
  backgroundGeometry,
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.55, sizeAttenuation: true }),
)
scene.add(starField)

// Prepara una textura radial compartida para brillos y destellos.
const glowCanvas = document.createElement('canvas')
glowCanvas.width = 128
glowCanvas.height = 128
const glowContext = glowCanvas.getContext('2d')
if (!glowContext) throw new Error('No se pudo crear la textura de brillo.')
const glowGradient = glowContext.createRadialGradient(64, 64, 0, 64, 64, 64)
glowGradient.addColorStop(0, 'rgba(255,255,255,1)')
glowGradient.addColorStop(0.18, 'rgba(255,226,150,0.8)')
glowGradient.addColorStop(1, 'rgba(255,190,80,0)')
glowContext.fillStyle = glowGradient
glowContext.fillRect(0, 0, 128, 128)
const glowTexture = new THREE.CanvasTexture(glowCanvas)
glowTexture.colorSpace = THREE.SRGBColorSpace

// Crea un sprite luminoso de color y tamaño ajustables.
function createGlow(color, size) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }))
  sprite.scale.set(size, size, 1)
  return sprite
}

const galaxy = new THREE.Group()
galaxy.name = 'galaxy'
scene.add(galaxy)

const core = new THREE.Mesh(
  new THREE.SphereGeometry(0.55, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffd36a }),
)
galaxy.add(core)
galaxy.add(createGlow(0xffbd4a, 5))

const fibonacci = [1, 1]
while (fibonacci.length < 10) {
  fibonacci.push(fibonacci[fibonacci.length - 1] + fibonacci[fibonacci.length - 2])
}

// Distribuye los espacios en la espiral áurea sin cambiar las rondas originales.
const totalSlots = fibonacci.reduce((sum, value) => sum + value, 0)
const slots = []
const goldenAngle = Math.PI * (3 - Math.sqrt(5))
for (let i = 0; i < totalSlots; i += 1) {
  const angle = i * goldenAngle
  const radius = 1.2 * Math.sqrt(i + 1)
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  )
  const pulseGlow = createGlow(0xffd76b, 0.85)
  pulseGlow.visible = false
  mesh.add(pulseGlow)
  mesh.position.set(
    Math.cos(angle) * radius,
    Math.sin(i * 0.72) * 0.28,
    Math.sin(angle) * radius,
  )
  mesh.visible = false
  galaxy.add(mesh)
  slots.push({ mesh, placed: false, glow: null, pulseGlow })
}

const planets = createPlanets(galaxy)
const player = createAstronaut(scene)
controls.target.copy(player.getPosition())
camera.position.z += 5
controls.update()

// Reparte estrellas recogibles de forma reproducible por todo el sistema.
const collectibleGroup = new THREE.Group()
scene.add(collectibleGroup)
const collectibles = []
let randomSeed = 20260419
function random() {
  randomSeed = (randomSeed * 16807) % 2147483647
  return (randomSeed - 1) / 2147483646
}
for (let i = 0; i < 180; i += 1) {
  const angle = random() * Math.PI * 2
  const radius = 6 + random() * 38
  const y = (random() - 0.5) * 4
  const star = new THREE.Group()
  star.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.2, 1),
    new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.12 + random() * 0.09, 1, 0.68) }),
  )
  star.add(orb)
  star.add(createGlow('#ffd76c', 1.05))
  star.userData.orb = orb
  collectibleGroup.add(star)
  collectibles.push(star)
}

const seqElement = document.querySelector('#seq')
const taskElement = document.querySelector('#task')
const scoreElement = document.querySelector('#score')
const inventoryElement = document.querySelector('#inventory')
const explorationElement = document.querySelector('#exploration')
const messageElement = document.querySelector('#msg')
const actionButton = document.querySelector('#action-button')
const scanButton = document.querySelector('#scan-button')
const jumpButton = document.querySelector('#jump-button')

let roundIndex = 0
let roundStartIndex = 0
let placedInRound = 0
let score = 0
let inventory = 0
let advancing = false
let finished = false
let currentPlanet = null
let currentSurface = null
let currentExpedition = null
let savedGalaxyPosition = null
let savedCameraDistance = 28
let toastText = ''
let toastUntil = 0
const planetProgress = new Map()
const visitedPlanets = new Set()
const flashes = []

// Actualiza el HUD, la secuencia activa y las pistas según el lugar actual.
function updateHud() {
  const sequence = fibonacci
    .map((value, index) => (index === roundIndex ? `[${value}]` : value))
    .join(' · ')
  seqElement.textContent = `Secuencia: ${sequence}`

  if (finished) {
    taskElement.textContent = '¡Todas las estrellas están en su lugar!'
  } else if (advancing) {
    taskElement.textContent = 'Ronda completada · preparando la siguiente…'
  } else if (performance.now() < toastUntil) {
    taskElement.textContent = toastText
  } else if (currentSurface) {
    taskElement.textContent = `En ${currentPlanet.name}: F para escanear · E para saludar · Espacio para saltar`
  } else {
    const nearby = getNearestPlanet()
    taskElement.textContent = nearby
      ? `¡${nearby.name} está cerca! Presiona E para aterrizar`
      : 'WASD para volar · recoge estrellas · clic en los espacios brillantes'
  }

  const remaining = roundIndex < fibonacci.length
    ? fibonacci[roundIndex] - placedInRound
    : 0
  if (!finished) {
    scoreElement.textContent = currentSurface
      ? `Puntos: ${score} · Ronda ${roundIndex + 1}: faltan ${remaining}`
      : `Ronda ${roundIndex + 1}: faltan ${remaining} estrellas · Puntos: ${score}`
  } else {
    scoreElement.textContent = `Puntos: ${score}`
  }
  inventoryElement.textContent = `Estrellas: ${inventory}`
  const alienCount = [...planetProgress.values()]
    .reduce((total, progress) => total + progress.talkedCount, 0)
  explorationElement.textContent = `Planetas: ${visitedPlanets.size}/8 · Aliens: ${alienCount}`
}

// Muestra una felicitación corta en la línea de ayuda del HUD.
function showToast(text) {
  toastText = text
  toastUntil = performance.now() + 3600
  updateHud()
}

// Activa el bloque consecutivo de espacios que corresponde a la ronda actual.
function activateRound() {
  roundStartIndex = fibonacci
    .slice(0, roundIndex)
    .reduce((sum, value) => sum + value, 0)
  placedInRound = 0
  const color = new THREE.Color().setHSL((roundIndex * 0.1 + 0.08) % 1, 0.95, 0.62)

  for (let i = roundStartIndex; i < roundStartIndex + fibonacci[roundIndex]; i += 1) {
    const slot = slots[i]
    slot.mesh.visible = true
    slot.mesh.material.color.copy(color)
    slot.mesh.material.opacity = 0.48
    slot.pulseGlow.material.color.copy(color)
    slot.pulseGlow.visible = true
  }
  updateHud()
}

// Conserva el puntaje Fibonacci y muestra el mensaje final al completar diez rondas.
function completeRoundIfReady() {
  if (placedInRound !== fibonacci[roundIndex] || advancing) return
  advancing = true
  updateHud()

  window.setTimeout(() => {
    roundIndex += 1
    if (roundIndex === fibonacci.length) {
      finished = true
      messageElement.textContent = `¡Galaxia completada! Puntaje: ${score} puntos`
      messageElement.hidden = false
      updateHud()
      return
    }
    advancing = false
    activateRound()
  }, 400)
}

// Encuentra el planeta desbloqueado más cercano para aterrizar o mostrar su nombre.
function getNearestPlanet() {
  if (currentSurface) return null
  const position = player.getPosition()
  let nearest = null
  let nearestDistance = Infinity
  for (const planet of planets) {
    if (!planet.unlocked) continue
    const planetPosition = planet.orbit.getWorldPosition(new THREE.Vector3())
    const distance = planetPosition.distanceTo(position) - planet.size
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = planet
    }
  }
  return nearest && nearestDistance < 6.5 ? nearest : null
}

// Prepara terreno, escáner y aterrizaje al visitar un planeta por primera vez.
function landOnPlanet(planet) {
  if (!planet || currentSurface || finished) return
  currentPlanet = planet
  savedGalaxyPosition = player.getPosition()
  savedCameraDistance = camera.position.distanceTo(controls.target)
  const progress = planetProgress.get(planet.name) ?? {
    landingOrder: visitedPlanets.size,
    talkedCount: 0,
  }
  planetProgress.set(planet.name, progress)
  visitedPlanets.add(planet.name)

  currentSurface = createSurface(scene, planet)
  currentExpedition = createAlienExpedition(
    currentSurface,
    planet,
    progress.landingOrder,
    progress.talkedCount,
  )
  galaxy.visible = false
  starField.visible = false
  collectibleGroup.visible = false
  player.teleport(currentSurface.spawnPosition, camera, controls, 14)
  scanButton.hidden = false
  scanButton.textContent = 'Escanear'
  showToast(`¡Bienvenido a ${planet.name}!`)
  updateHud()
}

// Vuelve a la galaxia y devuelve al astronauta al mismo punto orbital.
function takeOff() {
  if (!currentSurface) return
  currentSurface.dispose()
  currentSurface = null
  currentExpedition = null
  currentPlanet = null
  galaxy.visible = true
  starField.visible = true
  collectibleGroup.visible = true
  player.teleport(
    savedGalaxyPosition ?? new THREE.Vector3(0, 0, 5),
    camera,
    controls,
    savedCameraDistance,
  )
  savedGalaxyPosition = null
  scanButton.hidden = true
  actionButton.hidden = true
  updateHud()
}

// Saluda al alien cercano y recibe estrellas, o despega si no hay nadie cerca.
function useActionButton() {
  if (currentSurface) {
    const position = player.getPosition()
    if (currentExpedition.isNear(position)) {
      const response = currentExpedition.interact(position, (reward) => {
        inventory += reward
      })
      if (response) {
        const progress = planetProgress.get(currentPlanet.name)
        progress.talkedCount = currentExpedition.talkedCount
        showToast(response)
      }
      updateHud()
      return
    }
    takeOff()
    return
  }
  landOnPlanet(getNearestPlanet())
}

// El clic coloca una estrella recogida en uno de los espacios activos.
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let pointerStart = null
renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerStart = { x: event.clientX, y: event.clientY }
})
renderer.domElement.addEventListener('pointerup', (event) => {
  if (!pointerStart) return
  const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y)
  pointerStart = null
  if (moved > 5 || currentSurface || advancing || finished || inventory < 1) return

  const bounds = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const activeSlots = slots
    .slice(roundStartIndex, roundStartIndex + fibonacci[roundIndex])
    .filter((slot) => !slot.placed)
  const [hit] = raycaster.intersectObjects(activeSlots.map((slot) => slot.mesh))
  if (!hit) return

  const slot = activeSlots.find((candidate) => candidate.mesh === hit.object)
  if (!slot) return
  const color = slot.mesh.material.color.clone()
  slot.placed = true
  slot.mesh.material.opacity = 1
  slot.pulseGlow.visible = false
  slot.glow = createGlow(color, 1.3)
  slot.glow.position.copy(slot.mesh.position)
  galaxy.add(slot.glow)
  inventory -= 1
  placedInRound += 1
  score += fibonacci[roundIndex]
  updateHud()
  completeRoundIfReady()
})

// Acerca el radar a F, conversa con E y aterriza o despega con el botón.
window.addEventListener('keydown', (event) => {
  if (event.repeat) return
  const key = event.key.toLowerCase()
  if (key === 'e') {
    if (currentSurface) {
      const response = currentExpedition.interact(player.getPosition(), (reward) => {
        inventory += reward
      })
      if (response) {
        const progress = planetProgress.get(currentPlanet.name)
        progress.talkedCount = currentExpedition.talkedCount
        showToast(response)
        updateHud()
      }
    } else {
      landOnPlanet(getNearestPlanet())
    }
  } else if (key === 'f' && currentSurface) {
    showToast(currentExpedition.scan(player.getPosition()))
  }
})

actionButton.addEventListener('click', useActionButton)
scanButton.addEventListener('click', () => {
  if (currentExpedition) showToast(currentExpedition.scan(player.getPosition()))
})
jumpButton.addEventListener('click', () => player.requestJump())

// Ajusta cámara y dibujo al tamaño actual de la ventana.
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

// Mantiene el movimiento, las órbitas, las recolecciones y las animaciones.
let previousTime = performance.now()
function animate(time) {
  requestAnimationFrame(animate)
  const delta = Math.min((time - previousTime) / 1000, 0.05)
  previousTime = time

  if (!currentSurface) {
    galaxy.rotation.y += delta * 0.04
    updatePlanets(planets, delta, roundIndex, player.getPosition())
    if (!advancing && roundIndex < fibonacci.length) {
      const end = roundStartIndex + fibonacci[roundIndex]
      for (let i = roundStartIndex; i < end; i += 1) {
        const slot = slots[i]
        if (slot.placed) continue
        const pulse = 1 + Math.sin(time * 0.003 + i) * 0.18
        slot.mesh.scale.setScalar(pulse)
        slot.mesh.material.opacity = 0.38 + (pulse - 0.82) * 0.34
        slot.pulseGlow.scale.setScalar(0.85 + (pulse - 1) * 0.5)
      }
    }
  }

  player.update(delta, camera, controls, currentSurface
    ? {
        surface: true,
        gravity: currentPlanet.gravity,
        getSurfaceHeight: currentSurface.getSurfaceHeight,
      }
    : { surface: false })

  if (currentSurface && currentExpedition) {
    currentExpedition.update(player.getPosition(), time, (bonus) => {
      score += bonus
      showToast(`¡Muestra recogida! +${bonus} puntos`)
    })
  } else {
    const position = player.getPosition()
    for (const star of collectibles) {
      if (!star.visible) continue
      star.rotation.y += delta * 1.4
      star.userData.orb.scale.setScalar(1 + Math.sin(time * 0.004 + star.position.x) * 0.16)
      if (star.position.distanceTo(position) < 1.45) {
        star.visible = false
        inventory += 1
        const flash = createGlow('#fff5ad', 2.4)
        flash.position.copy(star.position)
        scene.add(flash)
        flashes.push({ sprite: flash, born: time })
        updateHud()
      }
    }
  }

  for (let i = flashes.length - 1; i >= 0; i -= 1) {
    const flash = flashes[i]
    const age = time - flash.born
    flash.sprite.scale.setScalar(2.4 + age * 0.005)
    flash.sprite.material.opacity = Math.max(0, 1 - age / 360)
    if (age > 360) {
      scene.remove(flash.sprite)
      flash.sprite.material.dispose()
      flashes.splice(i, 1)
    }
  }

  if (currentSurface) {
    const canTalk = currentExpedition.isNear(player.getPosition())
    actionButton.textContent = canTalk ? 'Hablar con alien' : 'Despegar'
    actionButton.hidden = false
    scanButton.hidden = false
  } else {
    const nearbyPlanet = getNearestPlanet()
    actionButton.textContent = nearbyPlanet ? `Aterrizar · ${nearbyPlanet.name}` : ''
    actionButton.hidden = !nearbyPlanet || finished
    scanButton.hidden = true
  }

  if (!finished) updateHud()
  controls.update()
  renderer.render(scene, camera)
}

activateRound()
requestAnimationFrame(animate)
