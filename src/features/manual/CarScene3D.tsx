import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { ManualHotspot, VehicleKind } from '../../types'

/**
 * Räumliche Ansicht des Fahrzeugs mit verorteten Bauteilen.
 *
 * Warum ein eigenes Modell statt eines gekauften: Frei nutzbare 3D-Daten echter
 * Baureihen gibt es nicht, Hersteller-CAD ist geschützt. Die Karosserie ist
 * deshalb aus einem Seitenprofil aufgebaut und zeigt die **Bauart** – Pkw,
 * Transporter oder Motorrad – nicht die exakte Baureihe. Das steht auch im UI.
 *
 * Die Form entsteht aus drei Teilen: dem Profil mit gerundeten Übergängen und
 * ausgeschnittenen Radkästen, einer Verjüngung nach oben und zu den Enden
 * (`taper`, sonst wirkt das Extrudat wie ein Karton) und einer eigenen,
 * dunkleren Glasfläche. Erst zusammen ist die Bauart erkennbar.
 *
 * Die Karosserie bleibt halbdurchsichtig: Nur so sind Bauteile im Innenraum und
 * am Unterboden sichtbar, ohne dass man das Auto zerlegen muss.
 *
 * Die Marker sind bewusst HTML-Knöpfe über dem Bild statt Objekte in der Szene.
 * So bleiben sie scharf, mindestens 44 px groß und für Screenreader erreichbar;
 * ihre Position wird je Bild aus der 3D-Position berechnet.
 */

export type SceneZone = 'engine' | 'interior' | 'chassis'

interface Props {
  zone: SceneZone
  kind: VehicleKind
  hotspots: ManualHotspot[]
  selectedId?: string
  onSelect: (hotspot: ManualHotspot) => void
}

/** Die drei Bauformen, für die es ein eigenes Profil gibt */
type Build = 'car' | 'box' | 'bike'

function buildOf(kind: VehicleKind): Build {
  if (kind === 'motorcycle') return 'bike'
  if (kind === 'van' || kind === 'truck' || kind === 'bus' || kind === 'camper') return 'box'
  return 'car'
}

interface Proportions {
  /** halbe Fahrzeuglänge in Metern – X = 0 liegt in der Fahrzeugmitte */
  halfLength: number
  /** Dachhöhe über der Fahrbahn */
  roof: number
  /** Höhe der Unterkante (Schweller) */
  sill: number
  /** Gesamtbreite */
  width: number
  /** X der Vorder- und Hinterachse */
  axle: [number, number]
  wheelRadius: number
  wheelWidth: number
  /** Ab dieser Höhe zieht sich die Karosserie nach innen (Gürtellinie) */
  shoulder: number
  /**
   * Umrechnung der Bauteilpositionen aus `manual.ts` auf diese Bauart.
   * Die Werte dort sind an einem Pkw gemessen; ein Motorrad ist nicht einmal
   * halb so lang, ein Marker bei X = 1,35 m läge sonst weit vor dem Vorderrad.
   */
  hotspotScale: [number, number, number]
}

function proportions(kind: VehicleKind): Proportions {
  const build = buildOf(kind)
  if (build === 'bike') {
    return {
      halfLength: 1.0,
      roof: 1.05,
      sill: 0.32,
      // Nur Tank und Sitzbank sind extrudiert; Rahmen, Gabel und Motor kommen
      // als eigene Körper dazu (`addBikeParts`)
      width: 0.32,
      axle: [0.72, -0.73],
      wheelRadius: 0.32,
      wheelWidth: 0.14,
      shoulder: 0.9,
      hotspotScale: [0.45, 0.72, 0.24],
    }
  }
  if (build === 'box') {
    return {
      halfLength: 2.49,
      roof: 2.02,
      sill: 0.34,
      width: kind === 'truck' || kind === 'bus' ? 2.1 : 1.94,
      axle: [1.5, -1.55],
      wheelRadius: 0.38,
      wheelWidth: 0.24,
      shoulder: 1.3,
      hotspotScale: [1.06, 1.0, 1.08],
    }
  }
  return {
    halfLength: 2.36,
    roof: 1.52,
    sill: 0.34,
    width: 1.76,
    axle: [1.38, -1.38],
    wheelRadius: 0.34,
    wheelWidth: 0.22,
    shoulder: 0.98,
    hotspotScale: [1, 1, 1],
  }
}

/**
 * Seitenprofil der Karosserie als geschlossene Kurve.
 *
 * Die Radkästen sind Teil der Außenkontur (Halbkreis nach oben) statt Löcher in
 * der Fläche: So steht das Rad frei in seiner Aussparung, statt zur Hälfte im
 * Blech zu versinken.
 */
function bodyShape(build: Build, p: Proportions): THREE.Shape {
  const s = new THREE.Shape()
  const [front, rear] = p.axle
  const arc = p.wheelRadius + 0.13
  const y = p.sill

  if (build === 'bike') {
    // Nur Tank und Sitzbank – ein Motorrad hat keine geschlossene Karosserie
    s.moveTo(0.44, 0.76)
    s.quadraticCurveTo(0.36, 0.99, 0.14, 1.01) // Tank oben
    s.quadraticCurveTo(-0.04, 1.02, -0.14, 0.9) // Tankende
    s.lineTo(-0.32, 0.86) // Sitzansatz
    s.quadraticCurveTo(-0.54, 0.85, -0.66, 0.89) // Sitzbank
    s.quadraticCurveTo(-0.84, 0.92, -0.9, 0.83) // Heckbürzel
    s.lineTo(-0.74, 0.75)
    s.lineTo(-0.2, 0.76)
    s.lineTo(0.3, 0.7)
    s.closePath()
    return s
  }

  if (build === 'box') {
    s.moveTo(-p.halfLength + 0.03, y)
    s.lineTo(rear - arc, y)
    s.absarc(rear, y, arc, Math.PI, 0, true)
    s.lineTo(front - arc, y)
    s.absarc(front, y, arc, Math.PI, 0, true)
    s.lineTo(2.24, y)
    s.quadraticCurveTo(2.38, 0.36, 2.39, 0.56) // Stoßfänger vorn
    s.lineTo(2.38, 0.94)
    s.quadraticCurveTo(2.36, 1.06, 2.16, 1.12) // kurze Haube
    s.quadraticCurveTo(1.9, 1.18, 1.66, 1.74) // steile Frontscheibe
    s.quadraticCurveTo(1.58, 1.96, 1.34, 1.99) // Dachkante vorn
    s.lineTo(-2.32, 2.02) // Dach
    s.quadraticCurveTo(-2.48, 2.02, -2.49, 1.86) // Heckkante
    s.lineTo(-2.49, 0.5)
    s.quadraticCurveTo(-2.49, y, -p.halfLength + 0.03, y)
    s.closePath()
    return s
  }

  s.moveTo(-p.halfLength + 0.08, y)
  s.lineTo(rear - arc, y)
  s.absarc(rear, y, arc, Math.PI, 0, true)
  s.lineTo(front - arc, y)
  s.absarc(front, y, arc, Math.PI, 0, true)
  s.lineTo(2.16, y)
  s.quadraticCurveTo(2.3, 0.35, 2.31, 0.52) // Stoßfänger vorn
  s.lineTo(2.3, 0.76)
  s.quadraticCurveTo(2.28, 0.92, 2.02, 1.0) // Haubenvorderkante
  s.quadraticCurveTo(1.6, 1.08, 1.3, 1.12) // Motorhaube
  s.quadraticCurveTo(0.95, 1.16, 0.6, 1.44) // Windschutzscheibe
  s.quadraticCurveTo(0.3, 1.52, -0.12, 1.52) // Dach
  s.quadraticCurveTo(-0.6, 1.52, -0.98, 1.34) // C-Säule
  s.quadraticCurveTo(-1.42, 1.12, -1.78, 1.02) // Heckscheibe
  s.quadraticCurveTo(-2.1, 0.96, -2.3, 0.82) // Heckdeckel
  s.quadraticCurveTo(-2.4, 0.7, -2.36, 0.5) // Heckschürze
  s.quadraticCurveTo(-2.34, y, -p.halfLength + 0.08, y)
  s.closePath()
  return s
}

/** Fensterfläche – gibt der durchsichtigen Karosserie erst ihre Lesbarkeit */
function glassShape(build: Build): THREE.Shape | null {
  if (build === 'bike') return null
  const s = new THREE.Shape()

  if (build === 'box') {
    // Frontscheibe und Fahrerfenster; der Kastenaufbau dahinter hat keine Fenster
    s.moveTo(2.12, 1.2)
    s.quadraticCurveTo(1.9, 1.26, 1.7, 1.72)
    s.lineTo(1.42, 1.88)
    s.lineTo(0.66, 1.86)
    s.lineTo(0.66, 1.16)
    s.closePath()
    return s
  }

  s.moveTo(1.12, 1.1)
  s.quadraticCurveTo(0.94, 1.14, 0.64, 1.4) // Windschutzscheibe
  s.quadraticCurveTo(0.3, 1.48, -0.12, 1.48) // Dachkante
  s.quadraticCurveTo(-0.58, 1.48, -0.95, 1.3) // C-Säule
  s.quadraticCurveTo(-1.35, 1.1, -1.66, 1.0) // Heckscheibe
  s.lineTo(-1.58, 0.94)
  s.lineTo(1.1, 1.02) // Gürtellinie
  s.closePath()
  return s
}

/**
 * Zieht das Extrudat nach oben und zu den Enden hin schmaler.
 * Ohne das bleibt jede extrudierte Silhouette ein Quader mit hübscher Kante.
 */
function taper(geometry: THREE.BufferGeometry, p: Proportions) {
  const pos = geometry.attributes.position as THREE.BufferAttribute
  const span = Math.max(p.roof - p.shoulder, 0.001)
  const noseStart = p.halfLength * 0.62
  const noseSpan = Math.max(p.halfLength - noseStart, 0.001)

  for (let i = 0; i < pos.count; i++) {
    const up = Math.min(Math.max((pos.getY(i) - p.shoulder) / span, 0), 1)
    const nose = Math.min(Math.max((Math.abs(pos.getX(i)) - noseStart) / noseSpan, 0), 1)
    const scale = (1 - 0.2 * up * up) * (1 - 0.12 * nose * nose)
    pos.setZ(i, pos.getZ(i) * scale)
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
}

/** Rohr zwischen zwei Punkten – Gabel, Schwinge, Auspuff und Kette bestehen daraus */
function tube(
  from: [number, number, number],
  to: [number, number, number],
  radius: number,
  material: THREE.Material,
  keepGeo: <T extends THREE.BufferGeometry>(g: T) => T,
) {
  const a = new THREE.Vector3(...from)
  const direction = new THREE.Vector3(...to).sub(a)
  const length = direction.length()
  const geometry = keepGeo(new THREE.CylinderGeometry(radius, radius, length, 14))
  geometry.translate(0, length / 2, 0)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.copy(a)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  mesh.castShadow = true
  return mesh
}

/**
 * Rahmen, Motor, Gabel und Auspuff eines Motorrads.
 *
 * Ein Motorrad hat keine Karosserie: Extrudiert man nur seine Silhouette,
 * entsteht ein Klotz. Erkennbar wird es erst durch die einzelnen Baugruppen –
 * und die sind hier gleichzeitig das, was der Nutzer sucht.
 */
function addBikeParts(
  scene: THREE.Scene,
  p: Proportions,
  keepGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  keepMat: <T extends THREE.Material>(m: T) => T,
) {
  const [front, rear] = p.axle
  const dark = keepMat(new THREE.MeshStandardMaterial({ color: 0x2b3646, metalness: 0.7, roughness: 0.45 }))
  const metal = keepMat(new THREE.MeshStandardMaterial({ color: 0x9aa8b8, metalness: 0.9, roughness: 0.25 }))

  const engine = new THREE.Mesh(keepGeo(new THREE.BoxGeometry(0.46, 0.36, 0.34)), dark)
  engine.position.set(0.14, 0.54, 0)
  engine.castShadow = true
  scene.add(engine)

  const lamp = new THREE.Mesh(keepGeo(new THREE.SphereGeometry(0.1, 20, 14)), metal)
  lamp.position.set(0.62, 0.95, 0)
  scene.add(lamp)

  for (const z of [0.1, -0.1]) {
    scene.add(tube([0.56, 1.0, z], [front, p.wheelRadius, z], 0.03, metal, keepGeo)) // Gabel
    scene.add(tube([0.02, 0.5, z + (z > 0 ? 0.01 : -0.01)], [rear, p.wheelRadius, z], 0.035, dark, keepGeo)) // Schwinge
  }
  scene.add(tube([0.5, 1.03, -0.3], [0.5, 1.03, 0.3], 0.018, metal, keepGeo)) // Lenker
  scene.add(tube([-0.15, 0.85, 0], [-0.5, 0.44, 0], 0.035, metal, keepGeo)) // Federbein
  scene.add(tube([0.36, 0.6, 0.1], [0.44, 0.44, 0.13], 0.045, metal, keepGeo)) // Krümmer
  scene.add(tube([0.44, 0.44, 0.13], [-0.58, 0.52, 0.15], 0.05, metal, keepGeo)) // Auspuff
  scene.add(tube([0.02, 0.45, -0.14], [rear, p.wheelRadius, -0.14], 0.016, dark, keepGeo)) // Antriebskette
}

/** Kameraposition und Blickpunkt je Bereich und Bauart */
const VIEWS: Record<Build, Record<SceneZone, { pos: [number, number, number]; target: [number, number, number] }>> = {
  car: {
    engine: { pos: [4.4, 2.4, 3.5], target: [1.2, 0.8, 0] },
    interior: { pos: [3.0, 2.6, 3.6], target: [0.2, 1.0, 0] },
    chassis: { pos: [3.4, 1.2, 4.0], target: [0.2, 0.45, 0] },
  },
  box: {
    engine: { pos: [5.0, 3.0, 4.0], target: [1.3, 0.95, 0] },
    interior: { pos: [3.4, 3.1, 4.2], target: [0.4, 1.2, 0] },
    chassis: { pos: [4.0, 1.4, 4.6], target: [0, 0.5, 0] },
  },
  bike: {
    engine: { pos: [1.9, 1.2, 1.7], target: [0.15, 0.68, 0] },
    interior: { pos: [1.9, 1.2, 1.7], target: [0.15, 0.68, 0] },
    chassis: { pos: [2.1, 0.9, 1.9], target: [0, 0.45, 0] },
  },
}

/** Wie durchsichtig die Karosserie sein muss, damit der Bereich sichtbar wird */
const BODY_OPACITY: Record<SceneZone, number> = { engine: 0.34, interior: 0.22, chassis: 0.16 }

export default function CarScene3D({ zone, kind, hotspots, selectedId, onSelect }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<HTMLDivElement>(null)
  // Über Refs, damit die Animationsschleife nicht bei jeder Auswahl neu startet
  const stateRef = useRef({ hotspots, selectedId, zone })
  stateRef.current = { hotspots, selectedId, zone }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const build = buildOf(kind)
    const p = proportions(kind)
    const scene = new THREE.Scene()

    // Alles Erzeugte wird gesammelt und beim Verlassen freigegeben – sonst
    // wächst der Speicher mit jedem Zonenwechsel
    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []
    const keepGeo = <T extends THREE.BufferGeometry>(g: T) => {
      geometries.push(g)
      return g
    }
    const keepMat = <T extends THREE.Material>(m: T) => {
      materials.push(m)
      return m
    }
    const width = mount.clientWidth || 360
    const height = mount.clientHeight || 260

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
    const view = VIEWS[build][zone]
    camera.position.set(...view.pos)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(...view.target)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = build === 'bike' ? 1.3 : build === 'box' ? 2.8 : 2.4
    controls.maxDistance = build === 'bike' ? 5 : build === 'box' ? 11 : 9
    // Nicht unter die Fahrbahn drehen – von dort sieht man nichts Sinnvolles
    controls.maxPolarAngle = Math.PI / 2 - 0.03
    controls.update()

    // --- Licht: ein weiches Grundlicht plus eine gerichtete Quelle für Plastik ---
    scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x0a1020, 1.15))
    const key = new THREE.DirectionalLight(0xffffff, 2.1)
    key.position.set(4, 6, 4)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.near = 1
    key.shadow.camera.far = 20
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x5aa9ff, 0.8)
    rim.position.set(-5, 2, -3)
    scene.add(rim)

    // --- Karosserie aus dem Seitenprofil ---
    const depth = p.width
    const geometry = keepGeo(
      new THREE.ExtrudeGeometry(bodyShape(build, p), {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.035,
        bevelSegments: 2,
        curveSegments: 20,
      }),
    )
    geometry.translate(0, 0, -depth / 2)
    if (build !== 'bike') taper(geometry, p)
    geometry.computeVertexNormals()

    const bodyMaterial = keepMat(
      new THREE.MeshStandardMaterial({
        color: 0x7ba7d8,
        metalness: 0.45,
        roughness: 0.35,
        transparent: true,
        // Beim Motorrad verdeckt der kleine Tank nichts – er darf fester sein
        opacity: build === 'bike' ? BODY_OPACITY[zone] + 0.18 : BODY_OPACITY[zone],
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    const body = new THREE.Mesh(geometry, bodyMaterial)
    body.castShadow = true
    scene.add(body)

    // Konturlinien geben der durchsichtigen Karosserie wieder eine klare Form
    const edgeGeo = keepGeo(new THREE.EdgesGeometry(geometry, 22))
    const edgeMat = keepMat(
      new THREE.LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.55 }),
    )
    scene.add(new THREE.LineSegments(edgeGeo, edgeMat))

    // --- Fenster: eigene, dunklere Fläche knapp innerhalb der Karosserie ---
    const glass = glassShape(build)
    if (glass) {
      const glassDepth = depth - 0.03
      const glassGeo = keepGeo(
        new THREE.ExtrudeGeometry(glass, { depth: glassDepth, bevelEnabled: false, curveSegments: 16 }),
      )
      glassGeo.translate(0, 0, -glassDepth / 2)
      taper(glassGeo, p)
      const glassMat = keepMat(
        new THREE.MeshStandardMaterial({
          color: 0x0d1b2e,
          metalness: 0.2,
          roughness: 0.15,
          transparent: true,
          opacity: Math.min(BODY_OPACITY[zone] * 1.9, 0.62),
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      )
      scene.add(new THREE.Mesh(glassGeo, glassMat))
    }

    if (build === 'bike') addBikeParts(scene, p, keepGeo, keepMat)

    // --- Räder: Reifen plus sichtbare Felge, damit es keine schwarzen Klötze sind ---
    const tireGeo = keepGeo(
      new THREE.CylinderGeometry(p.wheelRadius, p.wheelRadius, p.wheelWidth, 32),
    )
    tireGeo.rotateX(Math.PI / 2)
    const rimGeo = keepGeo(
      new THREE.CylinderGeometry(p.wheelRadius * 0.58, p.wheelRadius * 0.58, p.wheelWidth * 1.08, 24),
    )
    rimGeo.rotateX(Math.PI / 2)
    const tireMat = keepMat(
      new THREE.MeshStandardMaterial({ color: 0x14181f, metalness: 0.05, roughness: 0.92 }),
    )
    const rimMat = keepMat(
      new THREE.MeshStandardMaterial({ color: 0xc3ced9, metalness: 0.85, roughness: 0.32 }),
    )
    const axleZ = build === 'bike' ? [0] : [depth / 2 - p.wheelWidth * 0.35, -(depth / 2 - p.wheelWidth * 0.35)]
    for (const x of p.axle) {
      for (const z of axleZ) {
        const tire = new THREE.Mesh(tireGeo, tireMat)
        tire.position.set(x, p.wheelRadius, z)
        tire.castShadow = true
        scene.add(tire)
        const wheelRim = new THREE.Mesh(rimGeo, rimMat)
        wheelRim.position.set(x, p.wheelRadius, z)
        scene.add(wheelRim)
      }
    }

    // --- Boden: fängt den Schatten und gibt der Szene Halt ---
    const floorGeo = keepGeo(new THREE.CircleGeometry(6, 48))
    const floorMat = keepMat(new THREE.ShadowMaterial({ opacity: 0.4 }))
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    const grid = new THREE.GridHelper(build === 'bike' ? 6 : 12, 24, 0x2a3d5c, 0x18243a)
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.35
    scene.add(grid)

    // --- Marker über dem Bild positionieren ---
    const project = new THREE.Vector3()
    const [sx, sy, sz] = p.hotspotScale

    /** Wo ein Bauteil an diesem Modell sitzt */
    const positionOf = (spot: ManualHotspot): [number, number, number] | null => {
      // Am Motorrad gilt die eigene Position, wo es eine gibt – umrechnen
      // lässt sich das nicht (siehe `pos3dBike` in types.ts)
      if (build === 'bike' && spot.pos3dBike) return spot.pos3dBike
      if (!spot.pos3d) return null
      return [spot.pos3d[0] * sx, spot.pos3d[1] * sy, spot.pos3d[2] * sz]
    }

    const placeMarkers = () => {
      const container = markerRef.current
      if (!container) return
      const rect = renderer.domElement.getBoundingClientRect()

      for (const spot of stateRef.current.hotspots) {
        const el = container.querySelector<HTMLElement>(`[data-spot="${spot.id}"]`)
        const at = el ? positionOf(spot) : null
        if (!el || !at) continue
        project.set(...at).project(camera)
        const behind = project.z > 1
        el.style.transform = `translate(-50%, -50%) translate(${((project.x + 1) / 2) * rect.width}px, ${((1 - project.y) / 2) * rect.height}px)`
        el.style.opacity = behind ? '0' : '1'
        el.style.pointerEvents = behind ? 'none' : 'auto'
        // Nah beieinander liegende Bauteile überlappen sich mit ihren 44-px-Flächen.
        // Der vordere muss den Klick bekommen, sonst fängt ein weiter hinten
        // liegender Punkt ihn ab (Bremsscheibe und ABS-Sensor sitzen dicht beisammen).
        el.style.zIndex = String(Math.round((2 - Math.min(project.z, 1.999)) * 1000))
      }
    }

    // --- Kamera auf das ausgewählte Bauteil ziehen ---
    // Wer aus der Diagnose kommt („wo sitzt der ABS-Sensor?"), soll das Teil
    // nicht am Bildrand suchen müssen. Sanft, damit die Ansicht nicht springt.
    const focus = new THREE.Vector3()
    let focusing = false
    let focusedId: string | undefined

    let frame = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)

      const selected = stateRef.current.selectedId
      if (selected !== focusedId) {
        focusedId = selected
        const spot = stateRef.current.hotspots.find((h) => h.id === selected)
        const at = spot ? positionOf(spot) : null
        if (at) {
          focus.set(...at)
          focusing = true
        } else focusing = false
      }
      if (focusing) {
        controls.target.lerp(focus, 0.07)
        if (controls.target.distanceTo(focus) < 0.02) focusing = false
      }

      controls.update()
      renderer.render(scene, camera)
      placeMarkers()
    }
    animate()

    const onResize = () => {
      const w = mount.clientWidth || width
      const h = mount.clientHeight || height
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      renderer.dispose()
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
      grid.geometry.dispose()
      ;(grid.material as THREE.Material).dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [zone, kind])

  return (
    <div className="relative h-full w-full">
      <div ref={mountRef} className="h-full w-full" />
      <div ref={markerRef} className="pointer-events-none absolute inset-0">
        {hotspots
          .filter((h) => h.pos3d)
          .map((h, i) => (
            <button
              key={h.id}
              type="button"
              data-spot={h.id}
              onClick={() => onSelect(h)}
              aria-label={h.label}
              className="absolute top-0 left-0 grid h-11 w-11 place-items-center transition-opacity"
            >
              <span
                className={
                  selectedId === h.id
                    ? 'grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-brand-teal text-[11px] font-bold text-[#04121a] shadow-lg'
                    : 'grid h-6 w-6 place-items-center rounded-full border border-white/60 bg-brand-blue/90 text-[11px] font-bold text-white shadow-md'
                }
              >
                {i + 1}
              </span>
            </button>
          ))}
      </div>
    </div>
  )
}
