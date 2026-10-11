import * as THREE from 'three'

const ALIEN_FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21]

// Crea una secuencia seudoaleatoria reproducible a partir de una semilla.
function seededRandom(initialSeed) {
  let seed = initialSeed % 2147483647
  if (seed <= 0) seed += 2147483646
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

// Genera un globo de diálogo con texto dibujado en canvas.
function createSpeechBubble(text) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 150
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo crear el globo de diálogo.')

  context.fillStyle = 'rgba(255, 250, 225, 0.96)'
  context.beginPath()
  context.roundRect(8, 8, 496, 130, 28)
  context.fill()
  context.fillStyle = '#182b45'
  context.font = 'bold 32px Georgia'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (context.measureText(candidate).width > 450 && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  lines.slice(0, 3).forEach((part, index) => context.fillText(part, 256, 42 + index * 36))

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  }))
  sprite.scale.set(4.2, 1.25, 1)
  return sprite
}

// Construye un alien simpático con ojos grandes, antenas y brazos para saludar.
function createAlien(index) {
  const alien = new THREE.Group()
  const colors = ['#8ee07d', '#f4a4dd', '#80d9f2', '#ffd46e', '#bd9cff']
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: colors[index % colors.length],
    roughness: 0.66,
  })
  const eyeWhite = new THREE.MeshBasicMaterial({ color: '#ffffff' })
  const pupil = new THREE.MeshBasicMaterial({ color: '#19243b' })

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.56, 20, 16), bodyMaterial)
  body.scale.set(0.84, 1.18, 0.7)
  body.position.y = 0.65
  alien.add(body)

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), eyeWhite)
    eye.position.set(side * 0.2, 0.82, 0.38)
    alien.add(eye)
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), pupil)
    dot.position.set(side * 0.2 + 0.035, 0.81, 0.535)
    alien.add(dot)

    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.05, 0.38, 8),
      bodyMaterial,
    )
    antenna.position.set(side * 0.22, 1.25, 0)
    antenna.rotation.z = side * -0.24
    alien.add(antenna)
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 10),
      new THREE.MeshStandardMaterial({ color: '#fff2a6', emissive: '#f4b43d', emissiveIntensity: 0.4 }),
    )
    tip.position.set(side * 0.27, 1.45, 0)
    alien.add(tip)
  }

  const wavingArm = new THREE.Group()
  wavingArm.position.set(0.42, 0.84, 0)
  const armMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.1, 0.4, 4, 8),
    bodyMaterial,
  )
  armMesh.position.set(0.12, -0.16, 0)
  armMesh.rotation.z = -0.65
  wavingArm.add(armMesh)
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), bodyMaterial)
  hand.position.set(0.22, -0.38, 0)
  wavingArm.add(hand)
  alien.add(wavingArm)
  alien.userData.wavingArm = wavingArm

  const bubble = createSpeechBubble('')
  bubble.position.y = 2.2
  bubble.visible = false
  alien.add(bubble)

  return { group: alien, bubble, talked: false, waveOffset: index * 0.7 }
}

// Crea aliens, radar y muestra mineral con probabilidades estables por planeta.
export function createAlienExpedition(surface, planet, landingOrder, alreadyTalked = 0) {
  const random = seededRandom(9331 + planet.index * 7919)
  const hasAliens = random() < planet.chance
  const count = hasAliens
    ? ALIEN_FIBONACCI[Math.min(landingOrder, ALIEN_FIBONACCI.length - 1)]
    : 0
  const aliens = []

  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2
    const radius = 6 + random() * 14
    const alien = createAlien(i + planet.index)
    alien.talked = i < alreadyTalked
    alien.group.position.set(
      Math.cos(angle) * radius,
      surface.getSurfaceHeight(Math.cos(angle) * radius, Math.sin(angle) * radius),
      Math.sin(angle) * radius,
    )
    alien.group.visible = false
    surface.root.add(alien.group)
    aliens.push(alien)
  }

  const radar = new THREE.Mesh(
    new THREE.RingGeometry(7.4, 7.55, 64),
    new THREE.MeshBasicMaterial({
      color: '#74f4dc',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    }),
  )
  radar.rotation.x = -Math.PI / 2
  radar.visible = false
  surface.root.add(radar)

  const mineral = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({
      color: '#9cf4ee',
      emissive: '#269ca6',
      emissiveIntensity: 0.8,
      metalness: 0.35,
      roughness: 0.25,
    }),
  )
  mineral.visible = false
  surface.root.add(mineral)

  let mineralAvailable = false
  let scanCount = 0
  let statusMessage = ''

  function scan(position) {
    scanCount += 1
    radar.visible = true
    radar.position.set(position.x, position.y + 0.48, position.z)
    let signals = 0
    for (const alien of aliens) {
      const nearby = alien.group.position.distanceTo(position) < 30
      alien.group.visible = nearby
      if (nearby) signals += 1
    }

    if (signals > 0) {
      statusMessage = signals === 1
        ? '¡El escáner encontró un amigo!'
        : `¡El escáner encontró ${signals} amigos!`
    } else if (aliens.length === 0) {
      statusMessage = 'Sin señales de vida. ¡Muestra mineral!'
      if (!mineralAvailable) {
        mineralAvailable = true
        mineral.position.set(
          position.x + 1.5,
          surface.getSurfaceHeight(position.x + 1.5, position.z + 1) + 0.55,
          position.z + 1,
        )
        mineral.visible = true
      }
    } else {
      statusMessage = '¡Sigue explorando para encontrar señales!'
    }
    return statusMessage
  }

  function interact(position, onReward) {
    const available = aliens.filter((alien) => alien.group.visible && !alien.talked)
    const nearest = (available.length > 0 ? available : aliens.filter((alien) => alien.group.visible))
      .map((alien) => ({ alien, distance: alien.group.position.distanceTo(position) }))
      .sort((a, b) => a.distance - b.distance)[0]
    if (!nearest || nearest.distance > 3.2) return null

    const alien = nearest.alien
    alien.bubble.material.map.dispose()
    alien.bubble.material.map = createSpeechBubble(`${planet.fact} ¡Toma 3 estrellas!`).material.map
    alien.bubble.material.needsUpdate = true
    alien.bubble.visible = true
    alien.bubble.userData.hideAt = performance.now() + 5200
    if (!alien.talked) {
      alien.talked = true
      onReward(3)
      return `¡Hola! ${planet.fact} Te regalo 3 estrellas.`
    }
    return `¡Hola otra vez! ${planet.fact}`
  }

  // Mueve el radar y anima saludos y muestras recogibles.
  function update(position, time, onMineral) {
    if (radar.visible) radar.position.set(position.x, position.y + 0.48, position.z)
    for (const [index, alien] of aliens.entries()) {
      const wave = Math.sin(time * 0.004 + alien.waveOffset)
      alien.group.position.y = surface.getSurfaceHeight(alien.group.position.x, alien.group.position.z)
      alien.group.userData.wavingArm.rotation.z = -0.5 + wave * 0.55
      alien.group.rotation.y = Math.sin(time * 0.0005 + index) * 0.2
      if (alien.bubble.visible && time > alien.bubble.userData.hideAt) {
        alien.bubble.visible = false
      }
    }
    if (mineral.visible) {
      mineral.rotation.y += 0.025
      mineral.position.y = surface.getSurfaceHeight(mineral.position.x, mineral.position.z)
        + 0.52 + Math.sin(time * 0.004) * 0.12
      if (mineral.position.distanceTo(position) < 1.55) {
        mineral.visible = false
        mineralAvailable = false
        onMineral(10)
        statusMessage = '¡Muestra recogida! +10 puntos'
      }
    }
    return statusMessage
  }

  return {
    aliens,
    count: aliens.length,
    scan,
    interact,
    update,
    get talkedCount() {
      return aliens.filter((alien) => alien.talked).length
    },
    get scanCount() {
      return scanCount
    },
    isNear(position) {
      return aliens.some((alien) => alien.group.visible && !alien.talked
        && alien.group.position.distanceTo(position) < 3.2)
    },
  }
}
