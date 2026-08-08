/**
 * Prüft die Auswahl des Bauteilfotos – reine Logik, ohne Netz.
 *
 * Ein falsches Bauteilfoto ist schlimmer als keines: Der Nutzer sucht danach
 * unter seiner Motorhaube. Deshalb muss die Auswahl im Zweifel nichts
 * zurückgeben statt irgendetwas.
 *
 * Aufruf: npm run test:partimage
 */
import { pickPartImage, scoreCandidate } from '../src/lib/partImagePick.ts'

const problems = []
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK   ' : 'FEHLER'} ${name}${ok || !detail ? '' : ` – ${detail}`}`)
  if (!ok) problems.push(`${name}${detail ? `: ${detail}` : ''}`)
}

const file = (title, patch = {}) => ({
  title,
  license: 'CC BY-SA 4.0',
  width: 640,
  height: 480,
  ...patch,
})

console.log('Was ausgeschlossen wird')
{
  const q = 'oil filter automotive'
  check('SVG ist eine Zeichnung', scoreCandidate(file('File:Oil filter.svg'), q) === 0)
  check('Schnittzeichnung', scoreCandidate(file('File:Oil filter diagram.png'), q) === 0)
  check('Patentskizze', scoreCandidate(file('File:Oil filter patent 1923.jpg'), q) === 0)
  check('Logo', scoreCandidate(file('File:Oil company logo.png'), q) === 0)
  check(
    'Ohne freie Lizenz kein Bild',
    scoreCandidate(file('File:Oil filter.jpg', { license: 'Fair use' }), q) === 0,
  )
  check(
    'Ohne Lizenzangabe kein Bild',
    scoreCandidate(file('File:Oil filter.jpg', { license: undefined }), q) === 0,
  )
  check(
    'Datei ohne Bezug zum Suchbegriff',
    scoreCandidate(file('File:Sunset over the harbour.jpg'), q) === 0,
  )
}

console.log('Was gewinnt')
{
  const q = 'brake disc caliper'
  const gewaehlt = pickPartImage(
    [
      file('File:Sunset.jpg'),
      file('File:Brake disc diagram.svg'),
      file('File:Brake disc and caliper of a car.jpg'),
      file('File:Brake pad.jpg'),
    ],
    q,
  )
  check(
    'Der vollständigste Treffer gewinnt',
    gewaehlt?.title === 'File:Brake disc and caliper of a car.jpg',
    gewaehlt?.title ?? 'keiner',
  )

  const breit = pickPartImage(
    [
      file('File:Brake disc caliper panorama.jpg', { width: 2400, height: 400 }),
      file('File:Brake disc caliper closeup.jpg', { width: 800, height: 600 }),
    ],
    q,
  )
  check(
    'Ein Streifenbild verliert gegen eine normale Aufnahme',
    breit?.title === 'File:Brake disc caliper closeup.jpg',
    breit?.title ?? 'keiner',
  )

  const nurTeiltreffer = pickPartImage([file('File:Car brake.jpg')], q)
  check('Ein Teiltreffer ist besser als nichts', nurTeiltreffer?.title === 'File:Car brake.jpg')
}

console.log('Fahrzeugbezug und Trefferreihenfolge')
{
  const q = 'instrument cluster car'
  // Der echte Fall: Commons liefert zum "Kombiinstrument" ein Flugzeug-Cockpit
  const gewaehlt = pickPartImage(
    [
      file('File:Instrument panel of Kawasaki Ki-61 fighter.jpg', { rank: 0 }),
      file('File:Instrument cluster of a car dashboard.jpg', { rank: 3 }),
    ],
    q,
  )
  check(
    'Das Fahrzeugbild schlägt das Flugzeug, auch wenn es später kommt',
    gewaehlt?.title === 'File:Instrument cluster of a car dashboard.jpg',
    gewaehlt?.title ?? 'keiner',
  )

  const gleichwertig = pickPartImage(
    [
      file('File:Car battery in a vehicle.jpg', { rank: 0 }),
      file('File:Car battery in a vehicle 2.jpg', { rank: 5 }),
    ],
    'car battery',
  )
  check(
    'Bei gleicher Eignung gewinnt der vordere Treffer',
    gleichwertig?.title === 'File:Car battery in a vehicle.jpg',
    gleichwertig?.title ?? 'keiner',
  )
}

console.log('Lieber nichts als das Falsche')
{
  // Der echte Fall: „FRA T19 car interior.jpg" ist eine Straßenbahn und traf
  // nur auf das Wort „car" – für einen Raddrehzahlsensor wertlos
  check(
    'Nur das Fahrzeugwort zu treffen genügt nicht',
    scoreCandidate(file('File:FRA T19 car interior.jpg'), 'wheel speed sensor car') === 0,
  )
  check(
    'Das Bauteil im Namen zählt weiterhin',
    scoreCandidate(file('File:Wheel speed sensor of a car.jpg'), 'wheel speed sensor car') > 0,
  )

  const nichts = pickPartImage(
    [file('File:Engine bay.jpg'), file('File:Workshop tools.png')],
    'ABS wheel speed sensor',
  )
  check('Kein Bezug → kein Bild', nichts === undefined, nichts?.title ?? '')
  check('Leere Liste → kein Bild', pickPartImage([], 'car battery') === undefined)
  check(
    'Nur Zeichnungen → kein Bild',
    pickPartImage([file('File:Car battery scheme.svg')], 'car battery') === undefined,
  )
}

console.log('Freie Lizenzen werden erkannt')
{
  const q = 'car battery'
  for (const lizenz of ['CC BY 4.0', 'CC BY-SA 3.0', 'CC0', 'Public domain', 'GFDL']) {
    check(`${lizenz} ist frei`, scoreCandidate(file('File:Car battery.jpg', { license: lizenz }), q) > 0)
  }
  for (const lizenz of ['Fair use', 'All rights reserved', 'Non-free', 'CC BY-NC 3.0']) {
    check(
      `${lizenz} ist nicht frei`,
      scoreCandidate(file('File:Car battery.jpg', { license: lizenz }), q) === 0,
    )
  }
}

if (problems.length) {
  console.log('\nPROBLEME:')
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log('\nOK – die Auswahl des Bauteilfotos hält sich an Lizenz und Bezug.')
