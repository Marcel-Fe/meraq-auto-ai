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
        x: 33,
        y: 30,
        fn: 'Zugang zum Motoröl. Der Deckel trägt meist die Angabe der freigegebenen Ölnorm.',
        problems: ['Dichtring porös → Ölnebel', 'Deckel nicht fest → Ölverlust bei Fahrt'],
        interval: 'Ölstand alle 2.000 km prüfen',
      },
      {
        id: 'oil-filter-housing',
        label: 'Ölfiltergehäuse',
        x: 55,
        y: 26,
        fn: 'Enthält den Ölfilter und hält das Motoröl sauber, indem es Abrieb und Ruß zurückhält.',
        problems: ['Undichtigkeiten am Gehäusedeckel', 'Rissbildung im Kunststoff', 'Filter zu spät gewechselt'],
        interval: 'mit jedem Ölwechsel',
      },
      {
        id: 'air-filter-box',
        label: 'Luftfilterkasten',
        x: 20,
        y: 58,
        fn: 'Filtert die Ansaugluft. Ein sauberer Filter schützt Luftmassenmesser und Brennraum.',
        problems: ['Filter zugesetzt → Leistungsverlust', 'Deckel undicht → Falschluft, Fehler P0171'],
        interval: 'alle 30.000 km oder 2 Jahre',
      },
      {
        id: 'battery',
        label: 'Starterbatterie',
        x: 76,
        y: 62,
        fn: 'Versorgt Anlasser und Bordnetz. Bei modernen Fahrzeugen mit Batteriemanagement verbunden.',
        problems: ['Kapazitätsverlust im Winter', 'Korrosion an den Polen', 'Nach Tausch nicht angelernt'],
        interval: 'alle 2 Jahre prüfen',
      },
      {
        id: 'coolant-tank',
        label: 'Kühlmittel-Ausgleichsbehälter',
        x: 68,
        y: 34,
        fn: 'Gleicht die Volumenänderung des Kühlmittels aus und zeigt den Füllstand an.',
        problems: ['Haarrisse im Behälter', 'Verschlussdeckel hält den Druck nicht', 'Kühlmittelverlust ohne sichtbare Pfütze'],
        interval: 'Sichtprüfung monatlich',
      },
      {
        id: 'brake-fluid',
        label: 'Bremsflüssigkeitsbehälter',
        x: 84,
        y: 30,
        fn: 'Vorratsbehälter für die Bremshydraulik. Sinkender Stand bedeutet Belagverschleiß oder ein Leck.',
        problems: ['Wasseraufnahme senkt den Siedepunkt', 'Stand unter MIN → Warnleuchte'],
        interval: 'Wechsel alle 2 Jahre',
      },
      {
        id: 'belt',
        label: 'Keilrippenriemen',
        x: 12,
        y: 34,
        fn: 'Treibt Lichtmaschine, Klimakompressor und Wasserpumpe an.',
        problems: ['Risse und Ausfransungen', 'Quietschen beim Kaltstart', 'Spannrolle ausgeschlagen'],
        interval: 'Sichtprüfung bei jeder Inspektion',
      },
      {
        id: 'turbo',
        label: 'Turbolader / Ladeluft',
        x: 45,
        y: 68,
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
        x: 30,
        y: 38,
        fn: 'Zeigt Geschwindigkeit, Drehzahl und alle Warnleuchten des Fahrzeugs.',
        problems: ['Gelbe Leuchte = beobachten', 'Rote Leuchte = sofort anhalten', 'Pixelfehler bei älteren Displays'],
      },
      {
        id: 'obd-port',
        label: 'OBD-Diagnosebuchse',
        x: 18,
        y: 66,
        fn: 'Genormte Schnittstelle (meist im Fußraum links) zum Auslesen der Fehlercodes.',
        problems: ['Kontakte verbogen', 'Dauerplus fehlt → Adapter ohne Funktion'],
      },
      {
        id: 'fuse-box',
        label: 'Sicherungskasten',
        x: 12,
        y: 50,
        fn: 'Schützt die Stromkreise. Die Belegung steht auf der Innenseite der Abdeckung.',
        problems: ['Durchgebrannte Sicherung deutet auf Kurzschluss hin', 'Falscher Ampere-Wert eingesetzt'],
      },
      {
        id: 'cabin-filter',
        label: 'Innenraumfilter',
        x: 62,
        y: 60,
        fn: 'Reinigt die Luft für den Innenraum von Pollen, Staub und Gerüchen.',
        problems: ['Beschlagene Scheiben', 'Muffiger Geruch', 'Schwache Lüftung'],
        interval: 'jährlich',
      },
      {
        id: 'ac-vent',
        label: 'Klimaanlage',
        x: 74,
        y: 36,
        fn: 'Kühlt und entfeuchtet die Luft. Der Kompressor braucht regelmäßigen Betrieb.',
        problems: ['Kältemittelverlust', 'Verkeimter Verdampfer', 'Kompressor-Kupplung defekt'],
        interval: 'Klimaservice alle 2 Jahre',
      },
      {
        id: 'seatbelt',
        label: 'Gurt & Airbag',
        x: 46,
        y: 24,
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
        x: 24,
        y: 44,
        fn: 'Wandelt Bewegungsenergie in Wärme um. Die Mindestdicke steht auf der Scheibe.',
        problems: ['Riefen und Rostkante', 'Verzug → Rubbeln beim Bremsen', 'Sattel klemmt einseitig'],
        interval: 'Prüfung bei jedem Radwechsel',
      },
      {
        id: 'shock',
        label: 'Stoßdämpfer & Feder',
        x: 48,
        y: 30,
        fn: 'Hält das Rad auf der Straße und dämpft Aufbaubewegungen.',
        problems: ['Ölaustritt am Dämpfer', 'Nachschwingen nach Bodenwellen', 'Federbruch im Winter'],
      },
      {
        id: 'tire',
        label: 'Reifen',
        x: 72,
        y: 60,
        fn: 'Einziger Kontakt zur Straße. Profiltiefe und Luftdruck bestimmen den Bremsweg.',
        problems: ['Profil unter 3 mm → deutlich längerer Bremsweg', 'Einseitiger Verschleiß = Spur falsch', 'Alter über 6 Jahre'],
        interval: 'Luftdruck monatlich prüfen',
      },
      {
        id: 'wheel-sensor',
        label: 'ABS-Raddrehzahlsensor',
        x: 34,
        y: 66,
        fn: 'Misst die Raddrehzahl für ABS, ASR und ESP.',
        problems: ['Kabelbruch am Radlauf', 'Impulsring verrostet', 'Fehler C1234 im Speicher'],
      },
      {
        id: 'exhaust',
        label: 'Abgasanlage',
        x: 58,
        y: 74,
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
  belt: (v) => vehicleTraits(v).hasCombustionEngine,
  turbo: (v) => vehicleTraits(v).hasCombustionEngine,
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
    x: 50,
    y: 62,
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
    x: 78,
    y: 40,
    fn: 'Schnittstelle zum Laden – Typ 2 für Wechselstrom, CCS zusätzlich für Gleichstrom-Schnellladen.',
    problems: ['Verriegelung klemmt', 'Kontakte verschmutzt', 'Ladeklappe friert im Winter fest'],
  },
  {
    id: 'inverter',
    label: 'Leistungselektronik',
    x: 32,
    y: 34,
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
              x: 62,
              y: 78,
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
