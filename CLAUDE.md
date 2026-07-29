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
- Keine echten Firmennamen, Bewertungen oder Öffnungszeiten erfinden.
- Bei sicherheitsrelevanten Themen (Bremsen, Lenkung, Airbag, Reifen) immer zur Werkstatt raten —
  das gilt im UI-Text und in den KI-Prompts.

### Store
- Listen-Selektoren, die filtern oder sortieren, **müssen** `useShallow` verwenden.
  Sonst entsteht bei jedem Render ein neues Array und React läuft in eine Endlosschleife
  (Fehler #185, führt zu einer komplett weißen Seite).
- Schreibende Aktionen gehören in den Store, nicht in die Komponente.

### KI
- Alle Aufrufe über [src/lib/ai/client.ts](src/lib/ai/client.ts) — nicht direkt das SDK importieren.
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
npm run preview        # Server auf http://localhost:4173/meraq-auto-ai/
npm run test:smoke     # 22 Screens im iPhone-Format, Screenshots in screenshots/
npm run test:vehicles  # E-Auto, Motorrad und Diesel-Transporter über die UI anlegen und prüfen
```

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
