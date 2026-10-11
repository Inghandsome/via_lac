import * as THREE from 'three'

// Devuelve la altura ondulada del terreno para dibujar y caminar sobre él.
function terrainHeight(x, z, planet) {
  const amplitude = planet.name === 'Júpiter' || planet.name === 'Saturno' ? 0.28 : 0.95
  return amplitude * (
    Math.sin(x * 0.17 + planet.index) * Math.cos(z * 0.13)
    + Math.sin((x + z) * 0.08)
  )
}

// Genera una textura de suelo con piedritas coloreadas mediante canvas.
function createGroundTexture(planet) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error(`No se pudo crear el terreno de ${planet.name}.`)
  }
  context.fillStyle = planet.ground
  context.fillRect(0, 0, 256, 256)
  if (planet.name === 'Júpiter' || planet.name === 'Saturno') {
    // Las franjas amplias dan al suelo gaseoso un aspecto de nubes.
    const bands = ['#f1d3ab', '#9e735d', '#e9c69e', '#bd8b6c']
    for (let i = 0; i < bands.length; i += 1) {
      context.globalAlpha = 0.32
      context.fillStyle = bands[i]
      context.fillRect(0, i * 68, 256, 38)
    }
    context.globalAlpha = 1
  }
  let seed = 701 + planet.index * 137
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  for (let i = 0; i < 850; i += 1) {
    const light = random() > 0.5
    context.fillStyle = light ? 'rgba(255,255,255,0.13)' : 'rgba(20,20,30,0.12)'
    context.beginPath()
    context.arc(random() * 256, random() * 256, 0.5 + random() * 3, 0, Math.PI * 2)
    context.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(10, 10)
  return texture
}

// Crea una vista de superficie y conserva la atmósfera anterior para volver.
export function createSurface(scene, planet) {
  const previousBackground = scene.background
  scene.background = new THREE.Color(planet.sky)
  const root = new THREE.Group()
  root.name = `superficie-${planet.name.toLowerCase()}`
  scene.add(root)

  const segments = 64
  const extent = 64
  const positions = []
  const colors = []
  const indices = []
  const baseColor = new THREE.Color(planet.ground)
  const highlightColor = new THREE.Color(planet.sky).lerp(new THREE.Color('#ffffff'), 0.12)

  for (let row = 0; row <= segments; row += 1) {
    for (let column = 0; column <= segments; column += 1) {
      const x = (column / segments - 0.5) * extent * 2
      const z = (row / segments - 0.5) * extent * 2
      const y = terrainHeight(x, z, planet)
      positions.push(x, y, z)
      const shade = THREE.MathUtils.clamp(0.48 + y * 0.25, 0.25, 0.75)
      const color = baseColor.clone().lerp(highlightColor, shade * 0.28)
      colors.push(color.r, color.g, color.b)
    }
  }

  for (let row = 0; row < segments; row += 1) {
    for (let column = 0; column < segments; column += 1) {
      const a = row * (segments + 1) + column
      const b = a + segments + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  const terrainGeometry = new THREE.BufferGeometry()
  terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  terrainGeometry.setIndex(indices)
  terrainGeometry.computeVertexNormals()
  const terrain = new THREE.Mesh(
    terrainGeometry,
    new THREE.MeshStandardMaterial({
      map: createGroundTexture(planet),
      vertexColors: true,
      roughness: 1,
      metalness: 0,
    }),
  )
  terrain.receiveShadow = true
  root.add(terrain)

  // Esparce rocas y cráteres deterministas para que cada visita se vea distinta.
  let detailSeed = 1801 + planet.index * 983
  const detailRandom = () => {
    detailSeed = (detailSeed * 16807) % 2147483647
    return (detailSeed - 1) / 2147483646
  }
  for (let i = 0; i < 28; i += 1) {
    const angle = detailRandom() * Math.PI * 2
    const radius = 5 + detailRandom() * 48
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const size = 0.22 + detailRandom() * 0.72
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({
        color: baseColor.clone().offsetHSL(0, 0, (detailRandom() - 0.5) * 0.22),
        roughness: 1,
      }),
    )
    rock.position.set(x, terrainHeight(x, z, planet) + size * 0.35, z)
    rock.scale.set(size, size * (0.55 + detailRandom() * 0.7), size * 0.8)
    rock.rotation.set(detailRandom(), detailRandom(), detailRandom())
    root.add(rock)
  }
  if (planet.name !== 'Júpiter' && planet.name !== 'Saturno') {
    const craterMaterial = new THREE.MeshStandardMaterial({
      color: baseColor.clone().offsetHSL(0, 0, -0.16),
      roughness: 1,
      side: THREE.DoubleSide,
    })
    for (let i = 0; i < 12; i += 1) {
      const angle = detailRandom() * Math.PI * 2
      const radius = 7 + detailRandom() * 42
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const crater = new THREE.Mesh(
        new THREE.CircleGeometry(0.45 + detailRandom() * 0.9, 20),
        craterMaterial,
      )
      crater.rotation.x = -Math.PI / 2
      crater.position.set(x, terrainHeight(x, z, planet) + 0.025, z)
      root.add(crater)
    }
  }

  const sunlight = new THREE.HemisphereLight(0xffffff, planet.ground, 2.1)
  root.add(sunlight)
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4)
  keyLight.position.set(-8, 18, 7)
  root.add(keyLight)

  // Añade pequeñas lunas y nubes como esferas para decorar el cielo.
  const skyColors = [planet.color, '#fff1c7', '#b9e8ff']
  for (let i = 0; i < 3; i += 1) {
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(1.2 + i * 0.35, 20, 16),
      new THREE.MeshBasicMaterial({ color: skyColors[(i + planet.index) % skyColors.length] }),
    )
    moon.position.set(-24 + i * 22, 19 + (i % 2) * 8, -48 - i * 5)
    root.add(moon)
  }
  if (planet.name === 'Júpiter' || planet.name === 'Saturno' || planet.name === 'Venus') {
    for (let i = 0; i < 5; i += 1) {
      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(0.9 + (i % 3) * 0.35, 12, 10),
        new THREE.MeshBasicMaterial({ color: '#fff1dc', transparent: true, opacity: 0.45 }),
      )
      cloud.position.set(-20 + i * 10, 7 + (i % 2) * 2, -14 - (i % 3) * 8)
      root.add(cloud)
    }
  }

  return {
    root,
    getSurfaceHeight: (x, z) => terrainHeight(x, z, planet),
    spawnPosition: new THREE.Vector3(0, terrainHeight(0, 0, planet), 0),
    dispose() {
      scene.remove(root)
      scene.background = previousBackground
      root.traverse((object) => {
        if (object.isMesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          for (const material of materials) {
            if (material.map) material.map.dispose()
            material.dispose()
          }
        }
      })
    },
  }
}
