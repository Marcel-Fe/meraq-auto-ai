import type { Vehicle } from '../types'

/**
 * Auswahl des Fahrzeugfotos aus den Bildern eines Wikipedia-Artikels.
 *
 * Bewusst ohne Netz und ohne weitere Abhängigkeiten: Diese Entscheidung ist der
 * fehleranfällige Teil und lässt sich so für sich prüfen
 * (`npm run test:image`).
 */

export function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Wörter und Zahlen ab drei Zeichen – „Mercedes-Benz" wird zu ["mercedes", "benz"] */
function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 3)
}

/**
 * Dateien, die kein Gesamtbild des Fahrzeugs zeigen.
 *
 * „motor" braucht den Lookahead: „OM611Motor.jpg" ist ein Motorblock und muss
 * raus, „Honda Motorrad.jpg" und „Benz Motorwagen.jpg" sind Fahrzeuge.
 */
const DETAIL_SHOT =
  /(interior|innenraum|cockpit|dashboard|armaturen|instrument|motor(?!rad|cycle|sport|wagen)|engine|sitz|seat|kofferraum|trunk|lenkrad|steering|emblem|badge|schriftzug|typenschild|felge|wheel|detail)/i

const NOT_A_VEHICLE = /(logo|icon|symbol|karte|map|wappen|flagge|commons|disambig|edit)/i

/**
 * Wählt aus den Bildern eines Artikels das passende Fahrzeugfoto.
 *
 * Warum das nötig ist: Manche Artikel haben kein Hauptbild – der Sprinter etwa.
 * Die Bildliste kommt alphabetisch, und einfach das erste zu nehmen lieferte dort
 * ein Rallye-Foto. Im selben Artikel stehen zudem Schwestermodelle fremder Marken
 * („Dodge-Sprinter", „Freightliner Sprinter"), die ein anderes Auto zeigen.
 *
 * Deshalb in zwei Stufen: erst Dateien, die Marke **und** ein Modellwort enthalten,
 * sonst wenigstens die Marke. Passt nichts, wird nichts zurückgegeben – die
 * Silhouette ist ehrlicher als ein fremdes Fahrzeug.
 */
export function pickArticleImage(files: string[], vehicle: Vehicle): string | undefined {
  const usable = files
    .filter((t) => /\.(jpe?g|png)$/i.test(t))
    .filter((t) => !NOT_A_VEHICLE.test(t))
    .filter((t) => !DETAIL_SHOT.test(t))

  const withMake = usable.filter((t) => matchesMake(t, vehicle))
  const exact = withMake.filter((t) => matchesModel(t, vehicle))

  return (exact[0] ?? withMake[0])?.replace(/^(Datei|File):/i, '')
}

function hasAny(file: string, list: string[]) {
  const n = normalize(file)
  return list.some((t) => n.includes(t))
}

function matchesMake(file: string, vehicle: Vehicle) {
  return hasAny(file, tokens(vehicle.make))
}

function matchesModel(file: string, vehicle: Vehicle) {
  return hasAny(file, tokens(vehicle.model))
}

/**
 * Taugt das Hauptbild des Artikels ohne weitere Suche?
 *
 * Nur wenn Marke **und** Modell im Dateinamen stehen. Das Hauptbild ungeprüft zu
 * übernehmen war der eigentliche Fehler: Der Artikel „Opel Astra" führte so zu
 * einem Foto des Opel Kadett, und über einen Motorenartikel landete beim Sprinter
 * ein Bild des Motorblocks im Fahrzeugprofil.
 */
export function mainImageFits(file: string | undefined, vehicle: Vehicle): boolean {
  if (!file) return false
  if (NOT_A_VEHICLE.test(file) || DETAIL_SHOT.test(file)) return false
  return matchesMake(file, vehicle) && matchesModel(file, vehicle)
}

/**
 * Passt der gefundene Artikel überhaupt zum Fahrzeug?
 *
 * Die Volltextsuche liefert sonst Nachbarmodelle oder gleich etwas ganz anderes:
 * Bei „Mercedes-Benz Sprinter 316 CDI" landete sie im Artikel über den Motor
 * OM 611, weil der Titel die Marke enthält. Ein falsches Fahrzeugbild ist
 * schlimmer als gar keins.
 *
 * Deshalb: Trägt das Modell einen echten Namen („Sprinter", „Astra", „Model"),
 * muss der im Titel vorkommen. Nur bei reinen Typenkürzeln („320d", „CB 650 R")
 * reicht die Marke – dort heißt der Artikel oft nach der Baureihe („BMW 3er").
 */
export function titleFits(title: string | undefined, vehicle: Vehicle) {
  if (!title) return false
  const t = normalize(title)
  const model = normalize(vehicle.model)
  const make = normalize(vehicle.make)
  if (model && t.includes(model)) return true

  // Das erste Wort des Modells ist der Modellname, wenn es ohne Ziffern auskommt
  const firstWord = tokens(vehicle.model)[0]
  if (firstWord && !/\d/.test(firstWord)) return t.includes(firstWord)

  return make.length > 0 && t.includes(make)
}
