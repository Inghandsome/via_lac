import * as THREE from 'three'

// Crea una pieza redondeada con material reutilizable para el traje.
function makeSuitPart(geometry, material, position, parent) {
  const part = new THREE.Mesh(geometry, material)
  part.position.set(...position)
  parent.add(part)
  return part
}

// Construye el astronauta completo usando únicamente geometrías sencillas.
function createAstronautModel() {
  const astronaut = new THREE.Group()
  astronaut.name = 'astronauta'

  const suit = new THREE.MeshStandardMaterial({ color: '#f4f2e9', roughness: 0.62 })
  const darkSuit = new THREE.MeshStandardMaterial({ color: '#526174', roughness: 0.8 })
  const gold = new THREE.MeshStandardMaterial({ color: '#ffcb66', metalness: 0.25, roughness: 0.42 })
  const visor = new THREE.MeshPhysicalMaterial({
    color: '#54dbff',
    emissive: '#168cb5',
    emissiveIntensity: 0.7,
    roughness: 0.12,
    metalness: 0.38,
    transparent: true,
    opacity: 0.9,
    clearcoat: 1,
  })

  makeSuitPart(new THREE.BoxGeometry(0.48, 0.56, 0.3), darkSuit, [0, 0.96, 0], astronaut)
  makeSuitPart(new THREE.BoxGeometry(0.27, 0.38, 0.19), suit, [0, 0.98, 0.18], astronaut)
  makeSuitPart(new THREE.BoxGeometry(0.3, 0.42, 0.22), gold, [0, 1.04, -0.23], astronaut)
  makeSuitPart(new THREE.SphereGeometry(0.34, 24, 20), suit, [0, 1.66, 0], astronaut)
  makeSuitPart(new THREE.SphereGeometry(0.265, 24, 20), visor, [0, 1.67, 0.205], astronaut)
  makeSuitPart(new THREE.SphereGeometry(0.075, 16, 12), gold, [0.27, 1.91, 0.08], astronaut)

  const helmetLight = new THREE.PointLight(0x80e9ff, 1.8, 5, 2)
  helmetLight.position.set(0.28, 1.94, 0.18)
  astronaut.add(helmetLight)

  const arms = []
  for (const side of [-1, 1]) {
    const arm = new THREE.Group()
    arm.position.set(side * 0.31, 1.16, 0)
    makeSuitPart(new THREE.CapsuleGeometry(0.105, 0.31, 4, 8), suit, [side * 0.04, -0.21, 0], arm)
    makeSuitPart(new THREE.SphereGeometry(0.115, 14, 12), gold, [side * 0.08, -0.43, 0.02], arm)
    astronaut.add(arm)
    arms.push(arm)

    const leg = new THREE.Group()
    leg.position.set(side * 0.15, 0.66, 0)
    makeSuitPart(new THREE.CapsuleGeometry(0.115, 0.32, 4, 8), darkSuit, [0, -0.22, 0], leg)
    makeSuitPart(new THREE.BoxGeometry(0.24, 0.13, 0.35), suit, [0, -0.46, 0.06], leg)
    astronaut.add(leg)
    arms.push(leg)
  }

  astronaut.userData.limbs = arms
  return astronaut
}

// Convierte WASD, flechas y el joystick táctil en un movimiento con inercia.
export function createAstronaut(scene) {
  const group = createAstronautModel()
  group.scale.setScalar(1.3)
  group.scale.setScalar(1.3)
  group.position.set(0, 0, 5)
  scene.add(group)

  const keys = new Set()
  const velocity = new THREE.Vector3()
  const touchInput = new THREE.Vector2()
  const direction = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()
  const cameraOffset = new THREE.Vector3()
  let verticalSpeed = 0
  let grounded = false
  let jumpRequested = false
  let walkTime = 0
  let previousPosition = group.position.clone()

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase()
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'e', 'f'].includes(key)) {
      event.preventDefault()
    }
    keys.add(key)
  })
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()))
  window.addEventListener('blur', () => keys.clear())

  const joystick = document.querySelector('#joystick')
  const thumb = document.querySelector('#joystick-thumb')
  let joystickPointer = null
  joystick?.addEventListener('pointerdown', (event) => {
    joystickPointer = event.pointerId
    joystick.setPointerCapture(event.pointerId)
    moveJoystick(event)
  })
  joystick?.addEventListener('pointermove', (event) => {
    if (event.pointerId === joystickPointer) moveJoystick(event)
  })
  joystick?.addEventListener('pointerup', releaseJoystick)
  joystick?.addEventListener('pointercancel', releaseJoystick)

  function moveJoystick(event) {
    const bounds = joystick.getBoundingClientRect()
    const radius = bounds.width * 0.34
    const dx = event.clientX - (bounds.left + bounds.width / 2)
    const dy = event.clientY - (bounds.top + bounds.height / 2)
    touchInput.set(dx / radius, -dy / radius).clampLength(0, 1)
    thumb.style.transform = `translate(calc(-50% + ${touchInput.x * radius}px), calc(-50% + ${-touchInput.y * radius}px))`
  }

  function releaseJoystick(event) {
    if (event.pointerId !== joystickPointer) return
    joystickPointer = null
    touchInput.set(0, 0)
    thumb.style.transform = 'translate(-50%, -50%)'
  }

  // Actualiza movimiento, salto y cámara según se explore el espacio o un suelo.
  function update(delta, camera, controls, options = {}) {
    const dt = Math.min(delta, 0.05)
    const inputX = Number(keys.has('d') || keys.has('arrowright'))
      - Number(keys.has('a') || keys.has('arrowleft')) + touchInput.x
    const inputY = Number(keys.has('w') || keys.has('arrowup'))
      - Number(keys.has('s') || keys.has('arrowdown')) + touchInput.y

    camera.getWorldDirection(forward)
    forward.y = 0
    if (forward.lengthSq() < 0.001) forward.set(0, 0, -1)
    forward.normalize()
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
    direction.copy(right).multiplyScalar(inputX).addScaledVector(forward, inputY)
    if (direction.lengthSq() > 1) direction.normalize()

    const speed = options.surface ? 4 : 6
    velocity.x = THREE.MathUtils.damp(velocity.x, direction.x * speed, 4.5, dt)
    velocity.z = THREE.MathUtils.damp(velocity.z, direction.z * speed, 4.5, dt)
    group.position.x += velocity.x * dt
    group.position.z += velocity.z * dt
    if (options.surface) {
      group.position.x = THREE.MathUtils.clamp(group.position.x, -60, 60)
      group.position.z = THREE.MathUtils.clamp(group.position.z, -60, 60)
    } else {
      group.position.x = THREE.MathUtils.clamp(group.position.x, -50, 50)
      group.position.z = THREE.MathUtils.clamp(group.position.z, -50, 50)
    }

    if (direction.lengthSq() > 0.025) {
      group.rotation.y = Math.atan2(direction.x, direction.z)
      walkTime += dt * 8
    }
    const limbs = group.userData.limbs
    limbs[0].rotation.x = direction.lengthSq() > 0.025 ? Math.sin(walkTime) * 0.45 : 0
    limbs[1].rotation.x = direction.lengthSq() > 0.025 ? -Math.sin(walkTime) * 0.45 : 0
    limbs[2].rotation.x = direction.lengthSq() > 0.025 ? -Math.sin(walkTime) * 0.55 : 0
    limbs[3].rotation.x = direction.lengthSq() > 0.025 ? Math.sin(walkTime) * 0.55 : 0

    if (options.surface) {
      const floor = options.getSurfaceHeight(group.position.x, group.position.z)
      grounded = group.position.y <= floor + 0.03
      if (grounded) {
        group.position.y = floor
        verticalSpeed = 0
      } else {
        verticalSpeed -= 9.8 * options.gravity * dt
        group.position.y += verticalSpeed * dt
      }
      if (grounded && (keys.has(' ') || keys.has('space') || jumpRequested)) {
        verticalSpeed = 6.2 / Math.sqrt(options.gravity)
        grounded = false
      }
      jumpRequested = false
    } else {
      const floatInput = Number(keys.has(' ')) - Number(keys.has('shift'))
      verticalSpeed = THREE.MathUtils.damp(verticalSpeed, floatInput * 2.5, 3, dt)
      group.position.y += verticalSpeed * dt
      group.position.y += Math.sin(performance.now() * 0.0018) * dt * 0.18
      group.position.y = THREE.MathUtils.clamp(group.position.y, -6, 6)
    }

    // Traslada cámara y objetivo juntos para conservar el giro manual del ratón.
    const worldPosition = group.getWorldPosition(new THREE.Vector3())
    cameraOffset.copy(worldPosition).sub(previousPosition)
    camera.position.add(cameraOffset)
    controls.target.add(cameraOffset)
    previousPosition.copy(worldPosition)
    controls.update()
  }

  function teleport(position, camera, controls, followDistance) {
    group.position.copy(position)
    velocity.set(0, 0, 0)
    verticalSpeed = 0
    const worldPosition = group.getWorldPosition(new THREE.Vector3())
    if (camera && controls) {
      const offset = camera.position.clone().sub(controls.target)
      if (followDistance) offset.setLength(followDistance)
      camera.position.copy(worldPosition).add(offset)
      controls.target.copy(worldPosition)
      controls.update()
    }
    previousPosition.copy(worldPosition)
  }

  return {
    group,
    update,
    teleport,
    getPosition: () => group.getWorldPosition(new THREE.Vector3()),
    hasKey: (key) => keys.has(key.toLowerCase()),
    requestJump: () => { jumpRequested = true },
  }
}
