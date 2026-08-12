import type { ManualZone, Vehicle } from '../types'
import { vehicleTraits } from '../lib/vehicleProfile'

/**
 * Bauteil-Explorer. Statt eines echten 3D-Modells (dafür gäbe es keine frei
 * lizenzierten Fahrzeugdaten) zeigt die App schematische Zonen mit antippbaren
 * Punkten. Die Inhalte gelten fahrzeugübergreifend; für Details verweist die
 * App auf das Herstellerhandbuch bzw. den KI-Assistenten.
 */
export const MANUAL_ZONES: ManualZone[] = [
  {
    id: 'engine',
    label: 'Motorraum',
    scene: 'engine',
    hotspots: [
      {
        id: 'oil-cap',
        label: 'Öleinfülldeckel',
        // Englisch, weil Dateien auf Commons fast immer englisch benannt sind –
        // mit deutschen Begriffen findet die Suche dort kaum etwas
        imageQuery: 'engine oil filler cap',
        x: 33,
        y: 30,
        pos3d: [1.35, 1.02, -0.18] as [number, number, number],
        pos3dBike: [0.28, 0.62, 0.18] as [number, number, number],
        fn: 'Zugang zum Motoröl. Der Deckel trägt meist die Angabe der freigegebenen Ölnorm.',
        problems: ['Dichtring porös → Ölnebel', 'Deckel nicht fest → Ölverlust bei Fahrt'],
        interval: 'Ölstand alle 2.000 km prüfen',
      },
      {
        id: 'oil-filter-housing',
        label: 'Ölfiltergehäuse',
        imageQuery: 'oil filter automotive',
        x: 55,
        y: 26,
        pos3d: [1.20, 0.88, 0.22] as [number, number, number],
        pos3dBike: [0.30, 0.44, 0.02] as [number, number, number],
        fn: 'Enthält den Ölfilter und hält das Motoröl sauber, indem es Abrieb und Ruß zurückhält.',
        problems: ['Undichtigkeiten am Gehäusedeckel', 'Rissbildung im Kunststoff', 'Filter zu spät gewechselt'],
        interval: 'mit jedem Ölwechsel',
      },
      {
        id: 'air-filter-box',
        label: 'Luftfilterkasten',
        imageQuery: 'engine air filter housing',
        x: 20,
        y: 58,
        pos3d: [1.72, 0.98, -0.42] as [number, number, number],
        pos3dBike: [-0.05, 0.82, 0.00] as [number, number, number],
        fn: 'Filtert die Ansaugluft. Ein sauberer Filter schützt Luftmassenmesser und Brennraum.',
        problems: ['Filter zugesetzt → Leistungsverlust', 'Deckel undicht → Falschluft, Fehler P0171'],
        interval: 'alle 30.000 km oder 2 Jahre',
      },
      {
        id: 'battery',
        label: 'Starterbatterie',
        imageQuery: 'car battery',
        x: 76,
        y: 62,
        pos3d: [1.62, 0.95, 0.46] as [number, number, number],
        pos3dBike: [-0.26, 0.72, 0.00] as [number, number, number],
        fn: 'Versorgt Anlasser und Bordnetz. Bei modernen Fahrzeugen mit Batteriemanagement verbunden.',
        problems: ['Kapazitätsverlust im Winter', 'Korrosion an den Polen', 'Nach Tausch nicht angelernt'],
        interval: 'alle 2 Jahre prüfen',
      },
      {
        id: 'coolant-tank',
        label: 'Kühlmittel-Ausgleichsbehälter',
        imageQuery: 'coolant expansion tank',
        x: 68,
        y: 34,
        pos3d: [1.78, 0.96, 0.30] as [number, number, number],
        pos3dBike: [0.05, 0.68, -0.16] as [number, number, number],
        fn: 'Gleicht die Volumenänderung des Kühlmittels aus und zeigt den Füllstand an.',
        problems: ['Haarrisse im Behälter', 'Verschlussdeckel hält den Druck nicht', 'Kühlmittelverlust ohne sichtbare Pfütze'],
        interval: 'Sichtprüfung monatlich',
      },
      {
        id: 'brake-fluid',
        label: 'Bremsflüssigkeitsbehälter',
        imageQuery: 'brake fluid reservoir',
        x: 84,
        y: 30,
        pos3d: [1.12, 0.99, 0.44] as [number, number, number],
        pos3dBike: [0.55, 0.98, 0.12] as [number, number, number],
        fn: 'Vorratsbehälter für die Bremshydraulik. Sinkender Stand bedeutet Belagverschleiß oder ein Leck.',
        problems: ['Wasseraufnahme senkt den Siedepunkt', 'Stand unter MIN → Warnleuchte'],
        interval: 'Wechsel alle 2 Jahre',
      },
      {
        id: 'belt',
        label: 'Keilrippenriemen',
        imageQuery: 'serpentine belt engine',
        x: 12,
        y: 34,
        pos3d: [1.55, 0.78, -0.52] as [number, number, number],
        fn: 'Treibt Lichtmaschine, Klimakompressor und Wasserpumpe an.',
        problems: ['Risse und Ausfransungen', 'Quietschen beim Kaltstart', 'Spannrolle ausgeschlagen'],
        interval: 'Sichtprüfung bei jeder Inspektion',
      },
      {
        id: 'turbo',
        label: 'Turbolader / Ladeluft',
        imageQuery: 'turbocharger',
        x: 45,
        y: 68,
        pos3d: [1.30, 0.72, 0.30] as [number, number, number],
        fn: 'Verdichtet die Ansaugluft und erhöht so Leistung und Wirkungsgrad.',
        problems: ['Ladedruckverlust durch undichte Schläuche', 'VTG-Verstellung verrußt', 'Ölverlust an den Dichtungen'],
      },
    ],
  },
  {
    id: 'interior',
    label: 'Innenraum',
    scene: 'interior',
    hotspots: [
      {
        id: 'cluster',
        label: 'Kombiinstrument',
        imageQuery: 'car dashboard instrument cluster',
        x: 30,
        y: 38,
        pos3d: [0.62, 1.02, -0.38] as [number, number, number],
        fn: 'Zeigt Geschwindigkeit, Drehzahl und alle Warnleuchten des Fahrzeugs.',
        problems: ['Gelbe Leuchte = beobachten', 'Rote Leuchte = sofort anhalten', 'Pixelfehler bei älteren Displays'],
      },
      {
        id: 'obd-port',
        label: 'OBD-Diagnosebuchse',
        imageQuery: 'OBD-II connector',
        x: 18,
        y: 66,
        pos3d: [0.70, 0.62, -0.52] as [number, number, number],
        fn: 'Genormte Schnittstelle (meist im Fußraum links) zum Auslesen der Fehlercodes.',
        problems: ['Kontakte verbogen', 'Dauerplus fehlt → Adapter ohne Funktion'],
      },
      {
        id: 'fuse-box',
        label: 'Sicherungskasten',
        imageQuery: 'fuse box car',
        x: 12,
        y: 50,
        pos3d: [0.78, 0.72, -0.66] as [number, number, number],
        fn: 'Schützt die Stromkreise. Die Belegung steht auf der Innenseite der Abdeckung.',
        problems: ['Durchgebrannte Sicherung deutet auf Kurzschluss hin', 'Falscher Ampere-Wert eingesetzt'],
      },
      {
        id: 'cabin-filter',
        label: 'Innenraumfilter',
        imageQuery: 'cabin air filter',
        x: 62,
        y: 60,
        pos3d: [0.88, 0.84, 0.40] as [number, number, number],
        fn: 'Reinigt die Luft für den Innenraum von Pollen, Staub und Gerüchen.',
        problems: ['Beschlagene Scheiben', 'Muffiger Geruch', 'Schwache Lüftung'],
        interval: 'jährlich',
      },
      {
        id: 'ac-vent',
        label: 'Klimaanlage',
        imageQuery: 'car interior air vent',
        x: 74,
        y: 36,
        pos3d: [0.60, 1.00, 0.30] as [number, number, number],
        fn: 'Kühlt und entfeuchtet die Luft. Der Kompressor braucht regelmäßigen Betrieb.',
        problems: ['Kältemittelverlust', 'Verkeimter Verdampfer', 'Kompressor-Kupplung defekt'],
        interval: 'Klimaservice alle 2 Jahre',
      },
      {
        id: 'seatbelt',
        label: 'Gurt & Airbag',
        imageQuery: 'seat belt car',
        x: 46,
        y: 24,
        pos3d: [0.10, 1.10, -0.62] as [number, number, number],
        fn: 'Rückhaltesystem. Airbag und Gurtstraffer arbeiten zusammen.',
        problems: ['Airbag-Warnleuchte an → System deaktiviert', 'Steckverbindung unter dem Sitz gelöst'],
      },
    ],
  },
  {
    id: 'chassis',
    label: 'Fahrwerk',
    scene: 'chassis',
    hotspots: [
      {
        id: 'brake-disc',
        label: 'Bremsscheibe & Sattel',
        imageQuery: 'brake disc caliper',
        x: 24,
        y: 44,
        pos3d: [1.35, 0.33, -0.78] as [number, number, number],
        pos3dBike: [0.72, 0.32, -0.12] as [number, number, number],
        fn: 'Wandelt Bewegungsenergie in Wärme um. Die Mindestdicke steht auf der Scheibe.',
        problems: ['Riefen und Rostkante', 'Verzug → Rubbeln beim Bremsen', 'Sattel klemmt einseitig'],
        interval: 'Prüfung bei jedem Radwechsel',
      },
      {
        id: 'shock',
        label: 'Stoßdämpfer & Feder',
        imageQuery: 'suspension strut shock absorber',
        x: 48,
        y: 30,
        pos3d: [1.35, 0.62, -0.66] as [number, number, number],
        pos3dBike: [-0.33, 0.63, 0.00] as [number, number, number],
        fn: 'Hält das Rad auf der Straße und dämpft Aufbaubewegungen.',
        problems: ['Ölaustritt am Dämpfer', 'Nachschwingen nach Bodenwellen', 'Federbruch im Winter'],
      },
      {
        id: 'tire',
        label: 'Reifen',
        imageQuery: 'car tire tread',
        x: 72,
        y: 60,
        pos3d: [-1.35, 0.33, 0.78] as [number, number, number],
        pos3dBike: [-0.73, 0.32, 0.00] as [number, number, number],
        fn: 'Einziger Kontakt zur Straße. Profiltiefe und Luftdruck bestimmen den Bremsweg.',
        problems: ['Profil unter 3 mm → deutlich längerer Bremsweg', 'Einseitiger Verschleiß = Spur falsch', 'Alter über 6 Jahre'],
        interval: 'Luftdruck monatlich prüfen',
      },
      {
        id: 'wheel-sensor',
        label: 'ABS-Raddrehzahlsensor',
        imageQuery: 'ABS sensor',
        x: 34,
        y: 66,
        pos3d: [1.35, 0.30, -0.62] as [number, number, number],
        pos3dBike: [0.66, 0.38, -0.10] as [number, number, number],
        fn: 'Misst die Raddrehzahl für ABS, ASR und ESP.',
        problems: ['Kabelbruch am Radlauf', 'Impulsring verrostet', 'Fehler C1234 im Speicher'],
      },
      {
        id: 'exhaust',
        label: 'Abgasanlage',
        imageQuery: 'car exhaust muffler',
        x: 58,
        y: 74,
        pos3d: [-1.60, 0.24, 0.24] as [number, number, number],
        pos3dBike: [-0.35, 0.52, 0.15] as [number, number, number],
        fn: 'Führt Abgase ab und reinigt sie über Katalysator bzw. Partikelfilter.',
        problems: ['Durchrostung am Endtopf', 'Aufhängungsgummi gerissen', 'Kat-Wirkungsgrad zu gering (P0420)'],
      },
    ],
  },
]

/** Bauteile, die es nur bei bestimmten Fahrzeugen gibt */
const HOTSPOT_REQUIREMENTS: Record<string, (v: Vehicle) => boolean> = {
  'oil-cap': (v) => vehicleTraits(v).hasEngineOil,
  'oil-filter-housing': (v) => vehicleTraits(v).hasEngineOil,
  'air-filter-box': (v) => vehicleTraits(v).hasCombustionEngine,
  // Ein Motorrad hat weder Keilrippenriemen noch üblicherweise einen Turbolader –
  // die Lichtmaschine sitzt direkt am Kurbeltrieb
  belt: (v) => vehicleTraits(v).hasCombustionEngine && v.kind !== 'motorcycle',
  turbo: (v) => vehicleTraits(v).hasCombustionEngine && v.kind !== 'motorcycle',
  'coolant-tank': (v) => vehicleTraits(v).hasCoolant,
  exhaust: (v) => vehicleTraits(v).hasCombustionEngine,
  'cabin-filter': (v) => vehicleTraits(v).hasAirConditioning,
  'ac-vent': (v) => vehicleTraits(v).hasAirConditioning,
  seatbelt: (v) => v.kind !== 'motorcycle',
  'fuse-box': (v) => v.kind !== 'motorcycle',
}

/** Elektro-spezifische Bauteile, die es bei Verbrennern nicht gibt */
const ELECTRIC_HOTSPOTS = [
  {
    id: 'hv-battery',
    label: 'Hochvoltbatterie',
    imageQuery: 'electric car battery pack',
    x: 50,
    y: 62,
    pos3d: [0.00, 0.28, 0.00] as [number, number, number],
    fn: 'Der Energiespeicher des Fahrzeugs, meist im Unterboden. Seine Restkapazität bestimmt Reichweite und Wiederverkaufswert.',
    problems: [
      'Kapazitätsverlust über die Jahre',
      'Häufiges Schnellladen beschleunigt die Alterung',
      'Beschädigung am Unterboden ist immer ein Werkstattfall',
    ],
    interval: 'Zustandsprüfung alle 2 Jahre',
  },
  {
    id: 'charging-port',
    label: 'Ladeanschluss',
    imageQuery: 'electric car charging port',
    x: 78,
    y: 40,
    pos3d: [1.05, 0.80, 0.92] as [number, number, number],
    fn: 'Schnittstelle zum Laden – Typ 2 für Wechselstrom, CCS zusätzlich für Gleichstrom-Schnellladen.',
    problems: ['Verriegelung klemmt', 'Kontakte verschmutzt', 'Ladeklappe friert im Winter fest'],
  },
  {
    id: 'inverter',
    label: 'Leistungselektronik',
    imageQuery: 'electric vehicle inverter',
    x: 32,
    y: 34,
    pos3d: [1.45, 0.90, 0.00] as [number, number, number],
    fn: 'Wandelt den Gleichstrom der Batterie in Wechselstrom für den Motor um und steuert die Rekuperation.',
    problems: ['Kühlkreislauf undicht', 'Fehler im Antriebsstrang nur per Diagnose auslesbar'],
  },
]

/**
 * Handbuch-Zonen für ein konkretes Fahrzeug.
 * Ein Motorrad hat keinen Innenraum im Auto-Sinne, ein E-Auto keinen Ölfilter –
 * deshalb werden Zonen und Bauteile gefiltert statt pauschal angezeigt.
 */
export function manualZonesFor(vehicle: Vehicle): ManualZone[] {
  const traits = vehicleTraits(vehicle)
  const isBike = vehicle.kind === 'motorcycle'

  return MANUAL_ZONES.filter((zone) => !(isBike && zone.id === 'interior'))
    .map((zone) => {
      let hotspots = zone.hotspots.filter((h) => {
        const requirement = HOTSPOT_REQUIREMENTS[h.id]
        return !requirement || requirement(vehicle)
      })

      if (zone.id === 'engine') {
        if (traits.hasHighVoltageBattery) hotspots = [...hotspots, ...ELECTRIC_HOTSPOTS]
        if (traits.hasChainDrive) {
          hotspots = [
            ...hotspots,
            {
              id: 'chain',
              label: 'Antriebskette',
              imageQuery: 'motorcycle drive chain',
              x: 62,
              y: 78,
              pos3d: [-1.35, 0.42, 0.28] as [number, number, number],
              pos3dBike: [-0.40, 0.36, -0.14] as [number, number, number],
              fn: 'Überträgt die Kraft vom Getriebe auf das Hinterrad. Sie ist das Verschleißteil mit dem kürzesten Wartungsintervall.',
              problems: ['Zu locker oder zu straff gespannt', 'Trockene Glieder', 'Verschlissenes Kettenrad'],
              interval: 'alle 1.000 km spannen und fetten',
            },
          ]
        }
      }

      return { ...zone, label: zoneLabel(zone.id, vehicle), hotspots }
    })
    .filter((zone) => zone.hotspots.length > 0)
}

/**
 * Stichwörter je Bauteil – die Brücke von einem Fehlercode oder einem Ersatzteil
 * zur Stelle im Modell.
 *
 * Bewusst hier und nicht im Screen: Ob ein Fehlercode zu den Bremsen gehört,
 * ist Fachwissen und gehört zu den Daten. Die Screens fragen nur nach.
 */
const HOTSPOT_KEYWORDS: Record<string, string[]> = {
  // "bremsbel" statt "bremsbelag": Der Plural heißt Bremsbeläge – mit Umlaut
  'brake-disc': ['bremsscheibe', 'bremsbel', 'bremsklotz', 'bremssattel', 'bremsen'],
  'brake-fluid': ['bremsflüssigkeit'],
  'wheel-sensor': ['abs', 'raddrehzahl', 'esp', 'asr'],
  tire: ['reifen', 'profiltiefe', 'luftdruck', 'reifendruck'],
  shock: ['stoßdämpfer', 'federbein', 'fahrwerksfeder', 'domlager'],
  exhaust: ['abgas', 'auspuff', 'katalysator', 'partikelfilter', 'lambda', 'endtopf'],
  'oil-cap': ['motoröl', 'ölstand', 'ölwechsel', 'öldruck'],
  'oil-filter-housing': ['ölfilter'],
  'air-filter-box': ['luftfilter', 'luftmassenmesser', 'ansaug', 'falschluft', 'gemisch'],
  battery: ['starterbatterie', 'autobatterie', 'bordnetzspannung', 'lichtmaschine', 'anlasser'],
  'coolant-tank': ['kühlmittel', 'kühlwasser', 'thermostat', 'kühler', 'wasserpumpe', 'überhitz'],
  belt: ['keilrippenriemen', 'zahnriemen', 'spannrolle'],
  turbo: ['turbolader', 'ladedruck', 'ladeluft', 'agr', 'abgasrückführung'],
  'cabin-filter': ['innenraumfilter', 'pollenfilter'],
  'ac-vent': ['klimaanlage', 'klimakompressor', 'kältemittel'],
  cluster: ['kombiinstrument', 'tacho', 'warnleuchte'],
  'obd-port': ['diagnosebuchse', 'obd'],
  'fuse-box': ['sicherung', 'sicherungskasten'],
  seatbelt: ['airbag', 'gurtstraffer', 'gurt', 'rückhaltesystem'],
  chain: ['antriebskette', 'kettenkit', 'kettenrad'],
  'hv-battery': ['hochvoltbatterie', 'hochvolt', 'traktionsbatterie'],
  'charging-port': ['ladeanschluss', 'ladedose', 'ladeklappe'],
  inverter: ['leistungselektronik', 'inverter', 'wechselrichter'],
}

/**
 * Sucht zu einem beliebigen Text (Fehlercode-Titel, Teilename, Suchbegriff) das
 * passende Bauteil im Modell – aber nur eines, das es an diesem Fahrzeug gibt.
 * Ein E-Auto darf nicht zum Ölfilter springen.
 */
export function findHotspotId(text: string, vehicle: Vehicle): string | undefined {
  const haystack = text.toLowerCase()
  const available = new Set(manualZonesFor(vehicle).flatMap((z) => z.hotspots.map((h) => h.id)))

  let best: { id: string; length: number } | undefined
  for (const [id, words] of Object.entries(HOTSPOT_KEYWORDS)) {
    if (!available.has(id)) continue
    for (const word of words) {
      // Das längste Stichwort gewinnt: "bremsflüssigkeit" ist genauer als "bremsen"
      if (haystack.includes(word) && (!best || word.length > best.length)) {
        best = { id, length: word.length }
      }
    }
  }
  return best?.id
}

/** In welcher Zone liegt ein Bauteil? Für den Sprung aus Diagnose und Teilesuche. */
export function zoneOfHotspot(hotspotId: string, vehicle: Vehicle): string | undefined {
  return manualZonesFor(vehicle).find((z) => z.hotspots.some((h) => h.id === hotspotId))?.id
}

function zoneLabel(zoneId: string, vehicle: Vehicle) {
  const traits = vehicleTraits(vehicle)
  if (zoneId === 'engine') {
    if (vehicle.kind === 'motorcycle') return 'Antrieb'
    if (traits.hasHighVoltageBattery && !traits.hasCombustionEngine) return 'Antrieb & Batterie'
    return 'Motorraum'
  }
  if (zoneId === 'chassis' && vehicle.kind === 'motorcycle') return 'Fahrwerk & Bremsen'
  return zoneId === 'interior' ? 'Innenraum' : 'Fahrwerk'
}
