import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { ManualHotspot, VehicleKind } from '../../types'

/**
 * Räumliche Ansicht des Fahrzeugs mit verorteten Bauteilen.
 *
 * Warum ein eigenes Modell statt eines gekauften: Frei nutzbare 3D-Daten echter
 * Baureihen gibt es nicht, Hersteller-CAD ist geschützt. Die Karosserie ist
 * deshalb aus einer Silhouette aufgebaut und zeigt die **Bauart** – Pkw,
 * Transporter oder Motorrad – nicht die exakte Baureihe. Das steht auch im UI.
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

/** Seitenprofil der Karosserie in Metern – X nach vorn, Y nach oben */
function silhouette(kind: VehicleKind): THREE.Vector2[] {
  if (kind === 'motorcycle') {
    return [
      new THREE.Vector2(-1.05, 0.30), new THREE.Vector2(-1.05, 0.62),
      new THREE.Vector2(-0.55, 0.78), new THREE.Vector2(-0.10, 0.72),
      new THREE.Vector2(0.35, 0.95), new THREE.Vector2(0.72, 0.92),
      new THREE.Vector2(0.95, 0.60), new THREE.Vector2(0.95, 0.30),
    ]
  }
  if (kind === 'van' || kind === 'truck' || kind === 'bus' || kind === 'camper') {
    return [
      new THREE.Vector2(-2.45, 0.32), new THREE.Vector2(-2.45, 1.95),
      new THREE.Vector2(0.95, 2.00), new THREE.Vector2(1.55, 1.70),
      new THREE.Vector2(2.20, 1.05), new THREE.Vector2(2.35, 0.72),
      new THREE.Vector2(2.35, 0.32),
    ]
  }
  return [
    new THREE.Vector2(-2.25, 0.34), new THREE.Vector2(-2.25, 0.78),
    new THREE.Vector2(-1.75, 0.92), new THREE.Vector2(-0.95, 1.38),
    new THREE.Vector2(0.35, 1.42), new THREE.Vector2(1.05, 1.12),
    new THREE.Vector2(1.75, 0.98), new THREE.Vector2(2.25, 0.88),
    new THREE.Vector2(2.25, 0.34),
  ]
}

function bodyWidth(kind: VehicleKind) {
  if (kind === 'motorcycle') return 0.42
  if (kind === 'truck' || kind === 'bus') return 2.1
  if (kind === 'van' || kind === 'camper') return 1.94
  return 1.76
}

/** Kameraposition und Blickpunkt je Bereich */
const VIEWS: Record<SceneZone, { pos: [number, number, number]; target: [number, number, number] }> = {
  engine: { pos: [3.6, 2.3, 2.9], target: [1.35, 0.85, 0] },
  interior: { pos: [2.4, 2.6, 3.1], target: [0.45, 0.95, 0] },
  chassis: { pos: [3.0, 1.1, 3.6], target: [0, 0.5, 0] },
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

    const scene = new THREE.Scene()
    const width = mount.clientWidth || 360
    const height = mount.clientHeight || 260

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
    const view = VIEWS[zone]
    camera.position.set(...view.pos)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(...view.target)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = 2.4
    controls.maxDistance = 9
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
    const profile = silhouette(kind)
    const shape = new THREE.Shape(profile)
    const depth = bodyWidth(kind)
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 3,
      curveSegments: 12,
    })
    geometry.translate(0, 0, -depth / 2)
    geometry.computeVertexNormals()

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x7ba7d8,
      metalness: 0.45,
      roughness: 0.35,
      transparent: true,
      opacity: BODY_OPACITY[zone],
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const body = new THREE.Mesh(geometry, bodyMaterial)
    body.castShadow = true
    scene.add(body)

    // Konturlinien geben der durchsichtigen Karosserie wieder eine klare Form
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 25),
      new THREE.LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.55 }),
    )
    scene.add(edges)

    // --- Räder ---
    const wheelRadius = kind === 'motorcycle' ? 0.32 : 0.34
    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, kind === 'motorcycle' ? 0.14 : 0.22, 28)
    wheelGeo.rotateX(Math.PI / 2)
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x161b26, metalness: 0.2, roughness: 0.8 })
    const axleX = kind === 'motorcycle' ? [0.72, -0.82] : kind === 'van' || kind === 'truck' || kind === 'bus' || kind === 'camper' ? [1.5, -1.55] : [1.38, -1.38]
    const axleZ = kind === 'motorcycle' ? [0] : [depth / 2 - 0.03, -depth / 2 + 0.03]
    for (const x of axleX) {
      for (const z of axleZ) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat)
        wheel.position.set(x, wheelRadius, z)
        wheel.castShadow = true
        scene.add(wheel)
      }
    }

    // --- Boden: fängt den Schatten und gibt der Szene Halt ---
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(6, 48),
      new THREE.ShadowMaterial({ opacity: 0.4 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    const grid = new THREE.GridHelper(12, 24, 0x2a3d5c, 0x18243a)
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.35
    scene.add(grid)

    // --- Marker über dem Bild positionieren ---
    const project = new THREE.Vector3()
    const toCamera = new THREE.Vector3()

    const placeMarkers = () => {
      const container = markerRef.current
      if (!container) return
      const rect = renderer.domElement.getBoundingClientRect()
      camera.getWorldDirection(toCamera)

      for (const spot of stateRef.current.hotspots) {
        const el = container.querySelector<HTMLElement>(`[data-spot="${spot.id}"]`)
        if (!el || !spot.pos3d) continue
        project.set(...spot.pos3d).project(camera)
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

    let frame = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)
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
      geometry.dispose()
      wheelGeo.dispose()
      bodyMaterial.dispose()
      wheelMat.dispose()
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
