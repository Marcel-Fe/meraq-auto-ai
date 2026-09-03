# CLAUDE.md — Arbeitsregeln für MERAQ AUTO AI

Lies zuerst [KONTEXT.md](KONTEXT.md) (Produkt, Design-System, Datenmodell) und
[PLAN.md](PLAN.md) (was fertig ist, was als Nächstes kommt).

## Stack

Vite 6 · React 19 · TypeScript · Tailwind CSS v4 · React Router v7 (HashRouter) ·
Zustand (persist) · lucide-react · Recharts · vite-plugin-pwa · @anthropic-ai/sdk

Kein Backend, kein Login, keine Datenbank. Alles läuft im Browser des Nutzers.

## Ordnerstruktur

```
src/
  app/         App.tsx (Router), AppShell.tsx (BottomNav, PageHeader, Page)
  components/  ui/index.tsx (Button, Card, Badge, Sheet, Row …), Brand, Markdown, Sparkline
  features/    ein Ordner je Bereich, Screen-Datei als default export
  store/       useAppStore.ts – der einzige Store
  lib/         ai/ (client, prompts), valuation, maintenance, dtc, format, fileStore
  data/        Demo- und Referenzdaten (Anleitungen, Teile, Werkstätten, Handbuch-Zonen)
  styles/      theme.css – Design-Tokens und Utility-Klassen
```

Neuer Screen: Datei unter `features/<bereich>/<Name>Screen.tsx` mit `export default`,
Route in [src/app/App.tsx](src/app/App.tsx) ergänzen, in `scripts/smoke-test.mjs` in `ROUTES` eintragen.

## Regeln

### Farben und Styling
- **Immer** die Theme-Utilities nutzen: `text-ink-muted`, `bg-brand-blue/15`, `border-danger/30`.
- **Niemals** `text-[--color-ink]` — das erzeugt in Tailwind v4 keine Farbe und fällt erst
  im Screenshot auf, weil das Element einfach weiß bleibt.
- Neue Farbe? Erst als `--color-<name>` in `@theme` in [src/styles/theme.css](src/styles/theme.css),
  dann als `text-<name>` verwenden.
- Wiederverwendbare Bausteine kommen aus `components/ui` — keine Einzelanfertigungen,
  wenn `Card`, `Row`, `Badge`, `Sheet` oder `Segmented` passen.

### Fahrzeugunabhängigkeit — die wichtigste Regel
- Nichts anzeigen, was zum aktiven Fahrzeug nicht passt. Ein E-Auto hat keinen Ölwechsel,
  ein Diesel keine Zündkerzen, ein Motorrad keine Scheibenwischer.
- Fahrzeugeigenschaften kommen aus `vehicleTraits()` in
  [src/lib/vehicleProfile.ts](src/lib/vehicleProfile.ts), Preisfaktoren aus `vehicleProfile()`.
- Neue Teile und Reparaturen als **Vorlage mit Basispreis** eintragen (Referenz: Kompaktwagen
  einer Volumenmarke). Die Umrechnung übernehmen `partsFor()` und `repairJobsFor()`.
  Nie feste Preise für ein bestimmtes Modell hinterlegen.
- Gilt etwas nur für bestimmte Fahrzeuge → `requires: (t) => t.hasDiesel` ergänzen.
- **Keine Teilenummern erfinden.** Sie gelten nur für eine Baureihe und Motorvariante.
- Nach jeder Änderung an Teilen, Wartung, Anleitungen oder Handbuch:
  `npm run test:vehicles` laufen lassen.

### Daten und Ehrlichkeit
- **Nie Zahlen erfinden.** Jede Schätzung braucht eine offengelegte Rechnung und einen
  sichtbaren Hinweis (Komponente `EstimateNote`).
- **Kfz-Steuer ist kein Schätzwert.** Sie hängt an der **Erstzulassung**, nicht am heutigen
  Recht: gestaffelte CO₂-Sätze erst ab 01.01.2021, davor linear 2,00 € je g/km mit
  Freibetrag 95 (ab 2014), 110 (ab 2012) bzw. 120 g/km. Vor dem 01.07.2009 zählt die
  Schadstoffklasse — die erfasst die App nicht, dort kommt ein Hinweis statt einer Zahl.
  Änderungen an `calculateTax()` immer mit `npm run test:calc` belegen.
- Keine echten Firmennamen, Bewertungen oder Öffnungszeiten erfinden.
- Bei sicherheitsrelevanten Themen (Bremsen, Lenkung, Airbag, Reifen) immer zur Werkstatt raten —
  das gilt im UI-Text und in den KI-Prompts.

### Store
- Listen-Selektoren, die filtern oder sortieren, **müssen** `useShallow` verwenden.
  Sonst entsteht bei jedem Render ein neues Array und React läuft in eine Endlosschleife
  (Fehler #185, führt zu einer komplett weißen Seite).
- Schreibende Aktionen gehören in den Store, nicht in die Komponente.

### KI
- Zwei Anbieter hinter denselben Funktionen: **Google Gemini** (kostenloser Schlüssel aus
  Google AI Studio, Vorgabe) und **Anthropic Claude** (kostenpflichtig, beste Qualität).
  Umgestellt wird in den Einstellungen; der Schlüssel bleibt in beiden Fällen auf dem Gerät.
- Alle Aufrufe über `askAi()` bzw. `askAiStructured()` in
  [src/lib/ai/client.ts](src/lib/ai/client.ts) — nicht direkt ein SDK importieren.
  Das Nachrichtenformat von Anthropic ist das Hausformat;
  [src/lib/ai/google.ts](src/lib/ai/google.ts) übersetzt es. **Kein Feature-Screen darf
  wissen, welcher Anbieter eingestellt ist.**
- Google-Modelle nie fest hinterlegen — Google benennt sie um. Die Liste kommt beim
  Prüfen des Schlüssels über `listGoogleModels()`.
- Beim kostenlosen Google-Kontingent wertet Google Eingaben zur Produktverbesserung aus.
  Dieser Hinweis muss in den Einstellungen sichtbar bleiben.
- Der System-Prompt gehört in [src/lib/ai/prompts.ts](src/lib/ai/prompts.ts), der Fahrzeugkontext
  kommt aus `vehicleContext()`. Der cache_control-Breakpoint sitzt auf dem letzten System-Block;
  alles Wechselnde muss danach stehen, sonst greift das Prompt-Caching nicht.
- Fehler nie roh anzeigen — immer durch `describeAiError()` schicken.
- Jeder KI-Aufruf braucht einen sinnvollen Zustand ohne Schlüssel (Hinweis statt Absturz).

### Sprache
- UI-Texte, Kommentare und Dokumentation auf **Deutsch**, Du-Form.
- Variablen, Funktionen, Dateinamen auf **Englisch**.
- Kommentare nur, wenn das *Warum* nicht offensichtlich ist.

### Mobile zuerst
- Alles wird bei **390 × 844 px** entworfen. Touch-Ziele mindestens 44 px.
- Kein horizontales Scrollen — der Smoke-Test prüft das.
- Unterster Inhalt braucht Abstand zur Bottom-Nav (`Page` hat `pb-32`, der Assistent mehr).

## Prüfen vor jedem Commit

```bash
npm run build          # tsc + vite, muss ohne Fehler durchlaufen
npm run verify         # alle Prüfungen unten in einem Lauf, Server inklusive
```

`verify` startet den Vorschau-Server selbst und reicht ihn weiter — einzeln aufgerufen
brauchen die UI-Tests einen laufenden `npm run preview`:

```bash
npm run test:calc       # Kfz-Steuer, Marktwert und Gesamtkosten gegen Referenzwerte
npm run test:ics        # Kalender-Datei gegen RFC 5545
npm run test:part       # Kostenrahmen und Bauteil-Zuordnung der Suche, reine Logik
npm run test:guide      # selbst machen oder machen lassen, reine Logik
npm run test:image      # Auswahl des Fahrzeugbildes, reine Logik ohne Netz
npm run test:partimage  # Auswahl des Bauteilfotos samt Lizenzprüfung, reine Logik
npm run test:smoke      # 23 Screens im iPhone-Format, Screenshots in screenshots/
npm run test:vehicles   # E-Auto, Motorrad und Diesel-Transporter über die UI anlegen und prüfen
npm run test:ai         # beide KI-Anbieter mit abgefangenen Antworten, verbraucht kein Guthaben
npm run test:workshops  # Werkstattsuche mit abgefangenen Karten-Antworten
npm run test:partsearch # Bauteil-Suche samt KI-Erklärung und Sprung ins Modell
npm run test:3d         # Screenshots der 3D-Ansicht – Formfehler bestehen jeden Zahlentest
npm run analyze         # was im Erststart-Bundle steckt, Modul für Modul
```

Nach Änderungen an den Bauteilen oder ihren Suchbegriffen zusätzlich
`npm run check:partimages` — das fragt Wikimedia Commons wirklich und zeigt, welches
Foto jedes Bauteil bekäme. Es gehört bewusst nicht in `verify`: Der Dienst ist ein
Gemeinschaftsangebot und weist zu schnelle Folgen ab.

Der Smoke-Test prüft Konsolenfehler, horizontales Scrollen, leere Seiten, die Persistenz
des Kilometerstands und das Verhalten ohne API-Schlüssel.

Der Fahrzeugtest legt drei sehr unterschiedliche Fahrzeuge über das Formular an und stellt
sicher, dass jeder Screen das Passende zeigt und das Unpassende weglässt.

Screenshots danach auch ansehen — Farbfehler bestehen den Test, sehen aber falsch aus.

## Deploy

Push auf `main` → GitHub Actions baut und veröffentlicht automatisch:
**https://marcel-fe.github.io/meraq-auto-ai/**

Wird das Repository umbenannt, muss `base` in [vite.config.ts](vite.config.ts) und
`start_url`/`scope` im Manifest mitgeändert werden — sonst lädt keine Datei mehr.
