import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import './style.css'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)

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

const starPositions = new Float32Array(3000 * 3)
for (let i = 0; i < 3000; i += 1) {
  const direction = new THREE.Vector3().randomDirection()
  const radius = 120 + Math.random() * 150
  starPositions[i * 3] = direction.x * radius
  starPositions[i * 3 + 1] = direction.y * radius
  starPositions[i * 3 + 2] = direction.z * radius
}

const starGeometry = new THREE.BufferGeometry()
starGeometry.setAttribute(
  'position',
  new THREE.BufferAttribute(starPositions, 3),
)
const starField = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.55,
    sizeAttenuation: true,
  }),
)
scene.add(starField)

const glowCanvas = document.createElement('canvas')
glowCanvas.width = 128
glowCanvas.height = 128
const glowContext = glowCanvas.getContext('2d')
if (!glowContext) {
  throw new Error('No se pudo crear la textura de brillo.')
}
const glowGradient = glowContext.createRadialGradient(64, 64, 0, 64, 64, 64)
glowGradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
glowGradient.addColorStop(0.18, 'rgba(255, 226, 150, 0.8)')
glowGradient.addColorStop(1, 'rgba(255, 190, 80, 0)')
glowContext.fillStyle = glowGradient
glowContext.fillRect(0, 0, 128, 128)

const glowTexture = new THREE.CanvasTexture(glowCanvas)
glowTexture.colorSpace = THREE.SRGBColorSpace

function createGlow(color, size) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  )
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

const totalSlots = fibonacci.reduce((sum, value) => sum + value, 0)
const slots = []
const goldenAngle = Math.PI * (3 - Math.sqrt(5))

for (let i = 0; i < totalSlots; i += 1) {
  const angle = i * goldenAngle
  const radius = 1.2 * Math.sqrt(i + 1)
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 16, 16),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
    }),
  )
  mesh.position.set(
    Math.cos(angle) * radius,
    Math.sin(i * 0.72) * 0.28,
    Math.sin(angle) * radius,
  )
  mesh.visible = false
  galaxy.add(mesh)
  slots.push({ mesh, placed: false, glow: null })
}

const seqElement = document.querySelector('#seq')
const taskElement = document.querySelector('#task')
const scoreElement = document.querySelector('#score')
const messageElement = document.querySelector('#msg')

let roundIndex = 0
let roundStartIndex = 0
let placedInRound = 0
let score = 0
let advancing = false

function updateHud() {
  seqElement.textContent = `Secuencia: ${fibonacci
    .map((value, index) => (index === roundIndex ? `[${value}]` : value))
    .join(' · ')}`
  const remaining = fibonacci[roundIndex] - placedInRound
  taskElement.textContent = `Ronda ${roundIndex + 1}: faltan ${remaining} estrellas`
  scoreElement.textContent = `Puntos: ${score}`
}

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
  }

  updateHud()
}

function completeRoundIfReady() {
  if (placedInRound !== fibonacci[roundIndex] || advancing) {
    return
  }

  advancing = true
  updateHud()
  taskElement.textContent = 'Ronda completada · preparando la siguiente…'

  window.setTimeout(() => {
    roundIndex += 1
    if (roundIndex === fibonacci.length) {
      messageElement.textContent = `¡Galaxia completada! Puntaje: ${score} puntos`
      messageElement.hidden = false
      taskElement.textContent = 'Todas las estrellas están en su lugar.'
      return
    }

    advancing = false
    activateRound()
  }, 400)
}

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let pointerStart = null

renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerStart = { x: event.clientX, y: event.clientY }
})

renderer.domElement.addEventListener('pointerup', (event) => {
  if (!pointerStart) {
    return
  }

  const moved = Math.hypot(
    event.clientX - pointerStart.x,
    event.clientY - pointerStart.y,
  )
  pointerStart = null
  if (moved > 5 || advancing || roundIndex >= fibonacci.length) {
    return
  }

  const bounds = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)

  const activeSlots = slots
    .slice(roundStartIndex, roundStartIndex + fibonacci[roundIndex])
    .filter((slot) => !slot.placed)
  const [hit] = raycaster.intersectObjects(activeSlots.map((slot) => slot.mesh))
  if (!hit) {
    return
  }

  const slot = activeSlots.find((candidate) => candidate.mesh === hit.object)
  if (!slot) {
    return
  }

  const color = slot.mesh.material.color.clone()
  slot.placed = true
  slot.mesh.material.opacity = 1
  slot.glow = createGlow(color, 1.3)
  slot.glow.position.copy(slot.mesh.position)
  galaxy.add(slot.glow)
  placedInRound += 1
  score += fibonacci[roundIndex]
  updateHud()
  completeRoundIfReady()
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

activateRound()

function animate(time) {
  requestAnimationFrame(animate)
  galaxy.rotation.y += 0.0007

  if (!advancing && roundIndex < fibonacci.length) {
    const start = roundStartIndex
    const end = start + fibonacci[roundIndex]
    for (let i = start; i < end; i += 1) {
      const slot = slots[i]
      if (!slot.placed) {
        const pulse = 1 + Math.sin(time * 0.003 + i) * 0.18
        slot.mesh.scale.setScalar(pulse)
        slot.mesh.material.opacity = 0.38 + (pulse - 0.82) * 0.34
      }
    }
  }

  controls.update()
  renderer.render(scene, camera)
}

animate(0)
