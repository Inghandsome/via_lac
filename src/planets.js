import * as THREE from 'three'

// Datos visuales y de exploración para los ocho planetas.
export const PLANETS = [
  { name: 'Mercurio', color: '#a89b8c', size: 0.48, orbit: 8, speed: 0.075, unlock: 1, chance: 0.38, sky: '#40322f', ground: '#93796b', gravity: 0.38, fact: 'Mercurio es el planeta más pequeño.' },
  { name: 'Venus', color: '#e5b765', size: 0.68, orbit: 10, speed: 0.06, unlock: 1, chance: 0.32, sky: '#d68a51', ground: '#bd7652', gravity: 0.9, fact: 'Venus tiene nubes muy brillantes.' },
  { name: 'Tierra', color: '#398de0', size: 0.78, orbit: 13, speed: 0.048, unlock: 3, chance: 0.98, sky: '#62b8ec', ground: '#4a9b62', gravity: 1, fact: 'La Tierra es nuestro hogar azul.' },
  { name: 'Marte', color: '#d96c47', size: 0.62, orbit: 16, speed: 0.04, unlock: 4, chance: 0.72, sky: '#d98768', ground: '#b95f43', gravity: 0.38, fact: 'En Marte hay volcanes gigantes.' },
  { name: 'Júpiter', color: '#d8a875', size: 1.65, orbit: 21, speed: 0.027, unlock: 5, chance: 0.86, sky: '#d9ae83', ground: '#b78362', gravity: 2.4, fact: 'Júpiter tiene una gran mancha roja.' },
  { name: 'Saturno', color: '#e4ce91', size: 1.35, orbit: 27, speed: 0.021, unlock: 6, chance: 0.62, sky: '#d6c28c', ground: '#baa06f', gravity: 1.06, fact: 'Los anillos de Saturno están hechos de hielo y roca.' },
  { name: 'Urano', color: '#8ed9dc', size: 1.05, orbit: 33, speed: 0.017, unlock: 7, chance: 0.68, sky: '#83ccd2', ground: '#71aeb8', gravity: 0.89, fact: 'Urano gira de lado alrededor del Sol.' },
  { name: 'Neptuno', color: '#4778e6', size: 1.02, orbit: 39, speed: 0.014, unlock: 8, chance: 0.77, sky: '#466ee0', ground: '#4563b2', gravity: 1.14, fact: 'Neptuno tiene vientos muy veloces.' },
]

// Crea mapas sencillos con bandas y manchas, sin recurrir a imágenes externas.
function createPlanetTexture(planet, index) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error(`No se pudo crear la textura de ${planet.name}.`)
  }

  context.fillStyle = planet.color
  context.fillRect(0, 0, canvas.width, canvas.height)

  const palette = index === 2
    ? ['#174a9b', '#3e9c5d', '#77bd69', '#d8f2f2']
    : index === 3
      ? ['#a94632', '#e28557', '#6e453d', '#f4e8d2']
      : index === 4 || index === 5
        ? ['#a97b5f', '#eed0a0', '#c38e6b', '#f0dfbd']
        : [planet.color, '#fff0c2', '#735f86', '#b5d8e8']

  for (let band = 0; band < 18; band += 1) {
    const y = (band / 18) * canvas.height
    const height = canvas.height / 18 + 2
    context.fillStyle = palette[(band + index) % palette.length]
    context.globalAlpha = index === 2 ? 0.8 : 0.32 + (band % 3) * 0.08
    context.fillRect(0, y, canvas.width, height)
  }

  context.globalAlpha = 0.82
  if (index === 2) {
    // Manchas verdes y casquetes polares para la Tierra.
    for (let i = 0; i < 18; i += 1) {
      context.fillStyle = i % 3 === 0 ? '#d6f0c3' : '#3f9854'
      context.beginPath()
      context.ellipse(
        (i * 83 + 41) % canvas.width,
        35 + ((i * 47) % 180),
        18 + (i % 4) * 7,
        8 + (i % 3) * 5,
        (i * 0.7) % Math.PI,
        0,
        Math.PI * 2,
      )
      context.fill()
    }
    context.fillStyle = '#f5ffff'
    context.fillRect(0, 0, canvas.width, 17)
    context.fillRect(0, canvas.height - 17, canvas.width, 17)
  } else if (index === 3) {
    // Casquetes polares claros para Marte.
    context.fillStyle = '#f5e8d5'
    context.fillRect(0, 0, canvas.width, 14)
    context.fillRect(0, canvas.height - 14, canvas.width, 14)
  } else if (index === 4) {
    // La mancha roja distingue a Júpiter.
    context.fillStyle = '#ba4b3e'
    context.beginPath()
    context.ellipse(350, 142, 43, 18, -0.12, 0, Math.PI * 2)
    context.fill()
  } else if (index === 5) {
    // Saturno recibe bandas suaves bajo sus anillos.
    context.fillStyle = '#f1e1b7'
    context.fillRect(0, 76, canvas.width, 14)
    context.fillRect(0, 164, canvas.width, 10)
  } else if (index === 1 || index === 6 || index === 7) {
    // Nubes y franjas tenues para Venus y los gigantes helados.
    context.fillStyle = '#fff2cf'
    for (let i = 0; i < 10; i += 1) {
      context.fillRect((i * 73) % canvas.width, 20 + i * 21, 110, 5)
    }
  }
  context.globalAlpha = 1

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Dibuja una etiqueta legible que se activa al acercarse el astronauta.
function createLabel(name) {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 80
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error(`No se pudo crear la etiqueta de ${name}.`)
  }
  context.fillStyle = 'rgba(5, 12, 28, 0.78)'
  context.beginPath()
  context.roundRect(4, 4, 312, 72, 24)
  context.fill()
  context.font = 'bold 36px Georgia'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#fff4c7'
  context.fillText(name, 160, 41)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  }))
  label.scale.set(3.2, 0.8, 1)
  return label
}

// Construye los planetas bloqueados y anima su órbita y desbloqueo por ronda.
export function createPlanets(galaxy) {
  return PLANETS.map((definition, index) => {
    const orbit = new THREE.Group()
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 24),
      new THREE.MeshStandardMaterial({
        map: createPlanetTexture(definition, index),
        emissive: definition.color,
        emissiveIntensity: 0.14,
        roughness: 0.86,
        metalness: 0,
        transparent: true,
        opacity: 0,
      }),
    )
    planet.scale.setScalar(definition.size)
    orbit.add(planet)

    if (index === 5) {
      const rings = new THREE.Mesh(
        new THREE.RingGeometry(definition.size * 1.35, definition.size * 2.05, 64),
        new THREE.MeshStandardMaterial({
          color: '#dec98f',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
          roughness: 0.9,
        }),
      )
      rings.rotation.x = Math.PI / 2 + 0.28
      orbit.add(rings)
      orbit.userData.rings = rings
    }

    const label = createLabel(definition.name)
    label.position.y = definition.size + 0.8
    label.visible = false
    orbit.add(label)

    const planetState = {
      ...definition,
      index,
      orbitRadius: definition.orbit,
      orbit,
      mesh: planet,
      label,
      unlocked: false,
      unlockProgress: 0,
      baseAngle: index * 0.83 + 0.38,
    }
    orbit.position.set(
      Math.cos(planetState.baseAngle) * definition.orbit,
      0,
      Math.sin(planetState.baseAngle) * definition.orbit,
    )
    galaxy.add(orbit)
    return planetState
  })
}

// Actualiza giros, órbitas, desbloqueos y etiquetas cercanas.
export function updatePlanets(planets, delta, roundIndex, astronautPosition) {
  for (const planet of planets) {
    planet.unlocked = roundIndex + 1 >= planet.unlock
    const target = planet.unlocked ? 1 : 0
    planet.unlockProgress = THREE.MathUtils.damp(planet.unlockProgress, target, 2.8, delta)
    planet.mesh.visible = planet.unlockProgress > 0.015
    planet.mesh.scale.setScalar(planet.size * planet.unlockProgress)
    planet.mesh.material.opacity = planet.unlockProgress
    if (planet.orbit.userData.rings) {
      planet.orbit.userData.rings.material.opacity = planet.unlockProgress * 0.78
    }

    planet.orbit.position.set(
      Math.cos(planet.baseAngle) * planet.orbitRadius,
      Math.sin(planet.baseAngle * 1.7) * 0.4,
      Math.sin(planet.baseAngle) * planet.orbitRadius,
    )
    planet.baseAngle += planet.speed * delta
    planet.mesh.rotation.y += delta * 0.28

    const position = planet.orbit.getWorldPosition(new THREE.Vector3())
    planet.label.visible = planet.unlocked
      && position.distanceTo(astronautPosition) < planet.size + 6
  }
}
