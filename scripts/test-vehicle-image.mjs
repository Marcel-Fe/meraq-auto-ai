/**
 * Prüft die Auswahl des Fahrzeugbildes an echten Wikipedia-Bildlisten.
 *
 * Die Listen unten sind unverändert von de.wikipedia.org abgefragt worden. Ohne
 * Netz geprüft, damit der Test nicht von Wikipedia abhängt – und weil genau diese
 * Fälle den Fehler ausgelöst haben: Artikel ohne Hauptbild, alphabetisch sortierte
 * Bildliste, Schwestermodelle fremder Marken im selben Artikel.
 *
 * Aufruf: node scripts/test-vehicle-image.mjs
 */
import { mainImageFits, pickArticleImage, titleFits } from '../src/lib/vehicleImagePick.ts'

const vehicle = (make, model) => ({ make, model })

const CASES = [
  {
    name: 'Sprinter – Artikel ohne Hauptbild, mit Fremdmarken',
    vehicle: vehicle('Mercedes-Benz', 'Sprinter 316 CDI'),
    files: [
      'Datei:2010 Team 135 Finishline Essaoura.JPG',
      'Datei:29th St 6th Av 08 - Eventi Hotel.jpg',
      'Datei:2nd Dodge Sprinter 2500.jpg',
      'Datei:BVB Bus Mercedes Sprinter.jpg',
      'Datei:DHL-Fahrzeug.jpg',
      'Datei:Dodge-Sprinter.jpg',
      'Datei:Electric Sprinter 2018.jpg',
      'Datei:Freightliner Sprinter.jpg',
      'Datei:Mercedes-Benz 312D RB 320 Reddingsbrigade Nederland Coördinatie.jpg',
    ],
    expect: 'BVB Bus Mercedes Sprinter.jpg',
    verboten: ['2010 Team 135 Finishline Essaoura.JPG', 'Dodge-Sprinter.jpg', 'Freightliner Sprinter.jpg'],
  },
  {
    name: 'BMW 3er – Modellname steht nicht im Dateinamen',
    vehicle: vehicle('BMW', '320d'),
    files: [
      'Datei:BMW3er-pjt.jpg',
      'Datei:BMW G20 IMG 0372.jpg',
      'Datei:BMW G21 IMG 4433 neutral n-plate.jpg',
    ],
    // Ueber die Marke gefunden – Hauptsache ein BMW und kein fremdes Fahrzeug
    expect: 'BMW3er-pjt.jpg',
    verboten: [],
  },
  {
    name: 'Tesla – Innenraumfoto darf nicht gewinnen',
    vehicle: vehicle('Tesla', 'Model 3'),
    files: [
      'Datei:Interior of Model 3.jpg',
      'Datei:2019 Tesla Model 3 Performance AWD Rear.jpg',
      'Datei:First Model 3 production cars ready for delivery.jpg',
    ],
    expect: '2019 Tesla Model 3 Performance AWD Rear.jpg',
    verboten: ['Interior of Model 3.jpg'],
  },
  {
    name: 'Nichts Passendes – lieber die Silhouette als ein fremdes Auto',
    vehicle: vehicle('Honda', 'CB 650 R'),
    files: ['Datei:2010 Team 135 Finishline Essaoura.JPG', 'Datei:DHL-Fahrzeug.jpg'],
    expect: undefined,
    verboten: [],
  },
  {
    name: 'Leerer Artikel',
    vehicle: vehicle('Honda', 'CB 650 R'),
    files: [],
    expect: undefined,
    verboten: [],
  },
  {
    name: 'Logos und Karten fallen raus',
    vehicle: vehicle('Opel', 'Astra'),
    files: ['Datei:Opel-Logo.svg.png', 'Datei:Karte Opel Werke.png', 'Datei:Opel Astra K front.jpg'],
    expect: 'Opel Astra K front.jpg',
    verboten: ['Opel-Logo.svg.png', 'Karte Opel Werke.png'],
  },
]

/**
 * Hauptbilder, die live danebengingen. Ein ungeprueft uebernommenes Hauptbild war
 * die eigentliche Fehlerquelle – diese Faelle halten den Fix fest.
 */
const MAIN_IMAGE_CASES = [
  {
    name: 'Motorblock als Hauptbild eines Motorenartikels',
    vehicle: vehicle('Mercedes-Benz', 'Sprinter 316 CDI'),
    file: 'OM611Motor.jpg',
    expect: false,
  },
  {
    name: 'Vorgaengermodell als Hauptbild',
    vehicle: vehicle('Opel', 'Astra'),
    file: 'Opel_Kadett_A,_Bj._1964_(2011-07-02).jpg',
    expect: false,
  },
  {
    name: 'Passendes Hauptbild wird uebernommen',
    vehicle: vehicle('Tesla', 'Model 3'),
    file: 'Tesla_Model_3_(2023)_Autofrühling_Ulm_IMG_9282.jpg',
    expect: true,
  },
  {
    name: 'Motorrad wird nicht als Motorbild aussortiert',
    vehicle: vehicle('Honda', 'CB 650 R'),
    file: 'Honda CB 650 R Motorrad.jpg',
    expect: true,
  },
]

/** Welcher Wikipedia-Artikel darf ueberhaupt als Treffer gelten? */
const TITLE_CASES = [
  { name: 'Motorenartikel ist kein Fahrzeugartikel', vehicle: vehicle('Mercedes-Benz', 'Sprinter 316 CDI'), title: 'Mercedes-Benz OM 611', expect: false },
  { name: 'Richtiger Fahrzeugartikel', vehicle: vehicle('Mercedes-Benz', 'Sprinter 316 CDI'), title: 'Mercedes-Benz Sprinter', expect: true },
  { name: 'Schwestermodell wird abgelehnt', vehicle: vehicle('Opel', 'Astra'), title: 'Opel Kadett', expect: false },
  { name: 'Typenkuerzel: Baureihe genuegt', vehicle: vehicle('BMW', '320d'), title: 'BMW 3er', expect: true },
  { name: 'Typenkuerzel mit Ziffern beim Motorrad', vehicle: vehicle('Honda', 'CB 650 R'), title: 'Honda CB 650 R', expect: true },
  { name: 'Fremde Marke wird abgelehnt', vehicle: vehicle('BMW', '320d'), title: 'Audi A4', expect: false },
]

const problems = []

for (const c of TITLE_CASES) {
  const got = titleFits(c.title, c.vehicle)
  if (got !== c.expect) {
    problems.push(`${c.name}: "${c.title}" erwartet ${c.expect ? 'passend' : 'unpassend'}, bekommen ${got ? 'passend' : 'unpassend'}`)
    continue
  }
  console.log(`OK  ${c.name} → "${c.title}" ${got ? 'passt' : 'abgelehnt'}`)
}

for (const c of MAIN_IMAGE_CASES) {
  const got = mainImageFits(c.file, c.vehicle)
  if (got !== c.expect) {
    problems.push(`${c.name}: erwartet ${c.expect ? 'uebernehmen' : 'ablehnen'}, bekommen ${got ? 'uebernehmen' : 'ablehnen'}`)
    continue
  }
  console.log(`OK  ${c.name} → ${got ? 'uebernommen' : 'abgelehnt'}`)
}

for (const c of CASES) {
  const got = pickArticleImage(c.files, c.vehicle)
  if (got !== c.expect) {
    problems.push(`${c.name}\n     erwartet: ${c.expect ?? 'kein Bild'}\n     bekommen: ${got ?? 'kein Bild'}`)
    continue
  }
  if (got && c.verboten.includes(got)) {
    problems.push(`${c.name}: "${got}" haette nie gewaehlt werden duerfen`)
    continue
  }
  console.log(`OK  ${c.name}${got ? ` → ${got}` : ' → Silhouette'}`)
}

if (problems.length) {
  console.log('\nPROBLEME:')
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log(`\nOK – ${CASES.length} Faelle der Bildauswahl stimmen.`)
