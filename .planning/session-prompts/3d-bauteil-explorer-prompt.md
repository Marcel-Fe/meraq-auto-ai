# 3D-Bauteil-Explorer — Session-Prompt für Claude Code
## Kopiere den Prompt unten und füge ihn als erste Nachricht in eine neue Claude-Code-Session ein
---

```
Du arbeitest am Projekt MERAQ AUTO AI (c:\Users\admin\Desktop\Meraq Car Assistent\meraq-auto-ai).
Lies ZUERST die CLAUDE.md im Projektwurzelverzeichnis — dort stehen Architektur, Regeln und Arbeitsweise.
Danach KONTEXT.md (Produkt, Design-System, Fahrzeugunabhängigkeit) und PLAN.md (Stand und Roadmap).

## Aufgabe: 3D-Bauteil-Explorer fertigstellen

### Worum geht es?
Wer wissen will, wo ein Bauteil sitzt und wie es aussieht, bekommt heute eine schematische
Zeichnung oder Fließtext. Der Nutzer will beides räumlich: das Fahrzeug drehen, sehen WO ein
Teil sitzt — und ein echtes Foto, WIE es aussieht.

Das Gerüst steht seit dem letzten Commit („3D-Bauteilexplorer: Geruest steht"): Three.js-Szene,
23 verortete Bauteile, Drehen und Zoomen, Rückfall auf 2D ohne WebGL. Was fehlt, ist die
Qualität des Modells und der zweite Teil der Frage — das reale Aussehen.

### Was BEREITS EXISTIERT (~55 % — nicht neu bauen!)

LIES DIESE DATEIEN VOLLSTÄNDIG, bevor Du etwas änderst:

1. `src/features/manual/CarScene3D.tsx` — die 3D-Szene (ca. 250 Zeilen, TRÄGT, aber grob)
   - `silhouette(kind)` (~55): Seitenprofil je Bauart als Punktliste. **Hier liegt das
     Qualitätsproblem** — zu wenige Stützpunkte, nur Geraden, keine Radkästen.
   - `bodyWidth(kind)` (~80), `VIEWS` (~88): Breite und Kameraposition je Bereich
   - `BODY_OPACITY` (~95): Karosserie halbdurchsichtig, sonst sieht man nichts im Inneren
   - `placeMarkers()` (~205): projiziert 3D-Positionen auf Bildschirmkoordinaten und setzt
     Position, Sichtbarkeit und z-index der HTML-Marker je Bild
   - Aufräumen im useEffect-Rückgabewert (~245): Renderer, Geometrien und Materialien werden
     freigegeben — bei Änderungen beibehalten, sonst wächst der Speicher bei jedem Zonenwechsel

2. `src/data/manual.ts` — Bauteil-Datenbank (ca. 300 Zeilen, KOMPLETT)
   - `MANUAL_ZONES` (~10): 3 Zonen mit 22 Bauteilen, je mit `x`/`y` (2D-Prozent),
     `pos3d` (Meter: X Länge, Y Höhe, Z Breite), `fn`, `problems`, `interval`
   - `HOTSPOT_REQUIREMENTS` (~200): welches Bauteil es bei welchem Fahrzeug gibt
   - `ELECTRIC_HOTSPOTS` (~215): Hochvoltbatterie, Ladeanschluss, Leistungselektronik
   - `manualZonesFor(vehicle)` (~250): filtert Zonen und Bauteile fahrzeuggerecht
   - **Die Datenbasis ist gut. Ergänze Felder, statt sie umzubauen.**

3. `src/features/manual/ManualScreen.tsx` (ca. 260 Zeilen, KOMPLETT)
   - `hasWebgl()` (~20): Rückfallprüfung
   - `show3d` (~45): 3D nur bei WebGL, vorhandenen `pos3d` und wenn der Nutzer nicht umschaltet
   - Umschalter 2D/3D (~145), Bauteil-Sheet mit KI-Vertiefung (~200)
   - `explainHotspot()` (~29): fragt die KI zum angetippten Bauteil

4. `src/lib/vehicleImage.ts` + `src/lib/vehicleImagePick.ts` — **das Muster für Etappe 2**
   - `findVehicleImage(vehicle)` (~90 in vehicleImage.ts): sucht ein frei lizenziertes Foto
     über Wikipedia/Commons, lädt es einmal, verkleinert es und legt es auf dem Gerät ab
   - `pickArticleImage(files, vehicle)` (~45 in vehicleImagePick.ts): reine Auswahl-Logik,
     ohne Netz prüfbar. `mainImageFits()`, `titleFits()` daneben.
   - Lizenzpflicht: `VehicleImageCredit` in `src/components/VehicleCard.tsx` (~76)
   - **Genau dieser Weg passt für Bauteilfotos — nachbauen, nicht neu erfinden.**

5. `src/features/diagnosis/DiagnosisScreen.tsx` — Einstieg für Etappe 3 (KOMPLETT)
   - Zeigt Fehlercodes mit Erklärung. Von hier soll man zum betroffenen Bauteil springen.

6. `src/features/parts/PartsScreen.tsx` — zweiter Einstieg für Etappe 3 (KOMPLETT)

7. `scripts/test-vehicle-image.mjs` — Muster für einen reinen Logiktest ohne Netz
   - Läuft über `node --experimental-strip-types`; für Importe quer durch `src/lib`
     gibt es `scripts/ts-resolve.mjs` (siehe `npm run test:calc`)

### Was FEHLT (Deine Aufgabe — 4 Lücken schließen)

**Lücke 1: Die Karosserie sieht aus wie ein Kasten**
- Heute: `silhouette()` in `CarScene3D.tsx` (~55) liefert 8–9 Punkte, nur Geraden. Im
  Screenshot wirkt das Fahrzeug wie ein Karton mit schwarzen Klötzen als Rädern.
  Der Nutzer hat ausdrücklich gesagt: die 3D-Modelle sollen perfekt sein.
- Nötig: eine erkennbare Fahrzeugform. Gerundete Übergänge (`THREE.Shape` kann
  `quadraticCurveTo`/`bezierCurveTo`), Radkästen als Aussparungen, stimmige Proportionen,
  sichtbare Räder statt halb versenkter Zylinder. Fenster als eigene, dunklere Fläche
  würden die Form zusätzlich lesbar machen.
- Ansatz: `silhouette()` auf `THREE.Shape` mit Kurven umstellen und Radkästen als `holes`
  oder über eine zweite, subtrahierte Form lösen. Je Bauart (Pkw, Kastenwagen, Motorrad)
  eigene Kurven. Danach die Kameraeinstellungen in `VIEWS` (~88) nachziehen.
- Prüfen: Screenshot ansehen. Eine Zahl bestätigt keine Form.

**Lücke 2: „Wie sieht es aus?" — reales Foto je Bauteil**
- Heute: Das Bauteil-Sheet zeigt Text (Funktion, Probleme, Intervall). Kein Bild.
- Nötig: ein frei lizenziertes Foto je Bauteil, mit Urheber und Lizenz. Der Weg dafür
  existiert bereits für Fahrzeugbilder und muss auf Bauteile übertragen werden.
- Ansatz: neue Datei `src/lib/partImage.ts` nach dem Muster von `vehicleImage.ts`, mit
  einem Suchbegriff je Bauteil. Dafür `ManualHotspot` in `src/types.ts` (~285) um
  `imageQuery?: string` erweitern (z. B. „Ölfilter Kfz", „Bremsscheibe"), denn der
  Anzeigename allein trifft auf Commons oft daneben. Auswahl-Logik als reine Funktion in
  eine eigene Datei, damit sie ohne Netz prüfbar bleibt.
- Zwischenspeichern wie beim Fahrzeugbild: einmal laden, verkleinert ablegen, auch
  Misserfolge merken — sonst läuft jede Öffnung des Sheets ins Netz.

**Lücke 3: Der Erststart ist um 22 kB gewachsen — Ursache offen**
- Gemessen über `git worktree` und je einen Build: Beim Commit `8b7da04` war das
  Hauptbundle 85,74 kB gzip, beim direkt folgenden Commit `5d59d28` („Echte
  Werkstattsuche über OpenStreetMap") 107,56 kB. **Exakt dieser eine Commit** hat
  +21,8 kB gebracht, obwohl `WorkshopsScreen` lazy geladen wird.
- Verdacht, nicht belegt: Rollup zieht ein Modul in den gemeinsamen Chunk, weil es
  jetzt von mehreren Stellen genutzt wird — Kandidaten sind `src/data/workshops.ts`
  (`distanceKm` wird von `src/lib/workshopSearch.ts` importiert) und die Erweiterung
  des Stores um `workshopSearch`.
- Nötig: Ursache belegen statt raten. Ein Build mit `rollupOptions.output.manualChunks`
  oder eine Sourcemap-Analyse zeigt, welche Module im `index`-Chunk liegen.
- PLAN.md nennt weiterhin 98 kB als Erststart-Budget. Entweder wieder erreichen oder
  die Angabe mit Begründung korrigieren — eine falsche Zahl in der Doku ist schlimmer
  als eine ehrliche.

**Lücke 4: Sprung ins Modell aus Diagnose und Teilesuche**
- Heute: `/manual` ist nur über „Mehr" erreichbar und startet immer bei der ersten Zone.
  Wer in der Diagnose einen Fehlercode zu den Bremsen sieht, findet nicht dorthin.
- Nötig: `/manual?teil=<hotspotId>` (oder eine Route `/manual/:hotspotId`), die die passende
  Zone öffnet, das Bauteil auswählt und die Kamera darauf richtet. Dazu Verweise aus
  `DiagnosisScreen.tsx` und `PartsScreen.tsx`.
- Ansatz: In `ManualScreen.tsx` `useSearchParams` auswerten und den Anfangszustand daraus
  setzen. In `CarScene3D.tsx` bei gesetztem `selectedId` das `controls.target` sanft auf
  `pos3d` ziehen. Die Zuordnung Fehlercode → Bauteil gehört in die Daten (`src/lib/dtc.ts`
  bzw. `src/data/manual.ts`), nicht in den Screen.

### Rahmenbedingungen
- **Fahrzeugunabhängigkeit ist die oberste Regel.** Ein Motorrad hat keinen Innenraum,
  ein E-Auto keinen Ölfilter. `manualZonesFor()` regelt das bereits — neue Bauteile
  brauchen einen Eintrag in `HOTSPOT_REQUIREMENTS`, wenn sie nicht für alle gelten.
- **Kein horizontales Scrollen.** Entworfen wird bei 390 × 844 px, der Smoke-Test lässt
  den Test sonst durchfallen. Touch-Ziele mindestens 44 px.
- **Ohne WebGL muss die App vollständig bedienbar bleiben.** Der 2D-Weg ist kein Beiwerk,
  sondern der Rückfall für ältere Geräte.
- **Three.js nur im Lazy-Chunk.** Es liegt korrekt in `CarScene3D-*.js` (582 kB roh,
  148 kB gzip) und darf dort nicht heraus. Geprüft mit
  `grep -l WebGLRenderer dist/assets/*.js` — das darf nur den CarScene3D-Chunk nennen.
  Der Erststart (`index-*.js`) liegt aktuell bei 105 kB gzip; siehe Lücke 3.
- **Bildrechte.** Fotos nur aus freien Quellen und immer mit Urheber und Lizenz daneben
  (Muster: `VehicleImageCredit`). Keine Herstellerbilder, keine neue Bildquelle ohne Not.
- **Nie Zahlen erfinden.** Maße, Drehmomente und Füllmengen gehören nicht ins Modell —
  dafür verweist die App auf das Herstellerhandbuch.
- **Das Modell zeigt die Bauart, nicht die Baureihe.** Dieser Hinweis steht im UI und muss
  stehen bleiben, solange es keine baureihengenauen Daten gibt.
- Farben nur über Theme-Utilities (`text-ink-muted`, `bg-brand-blue/15`). Niemals
  `text-[--color-ink]` — das erzeugt in Tailwind v4 keine Farbe.
- Bausteine aus `src/components/ui` verwenden (`Card`, `Sheet`, `Badge`, `Segmented`).
- UI-Texte und Kommentare auf Deutsch (Du-Form), Bezeichner im Code auf Englisch.

### Arbeitsweise
1. Alle oben genannten Dateien VOLLSTÄNDIG lesen, bevor Du planst
2. Die drei Lücken als voneinander unabhängige Änderungen planen
3. Eine Lücke nach der anderen umsetzen, jeweils mit:
   - Codeänderung
   - `npm run build` (führt `tsc -b` mit aus) — muss fehlerfrei sein
   - bei Lücke 1: Screenshot ansehen, nicht nur Tests laufen lassen
4. Nach allen Lücken die vollständige Absicherung (siehe unten)
5. Ein Commit pro Lücke mit aussagekräftiger deutscher Nachricht

### Verifikation
```bash
npm run lint                  # oxlint, nur die zwei bekannten Fast-Refresh-Warnungen sind erlaubt
npm run build                 # tsc + vite, muss ohne Fehler durchlaufen
npm run test:calc             # Rechenkerne gegen Referenzwerte
npm run test:ics              # Kalender-Datei gegen RFC 5545
npm run test:image            # Auswahl des Fahrzeugbildes, reine Logik
npm run preview               # Server auf http://localhost:4173/meraq-auto-ai/
npm run test:ai               # beide KI-Anbieter mit abgefangenen Antworten
npm run test:workshops        # Werkstattsuche mit abgefangenen Karten-Antworten
npm run test:smoke            # 23 Screens im iPhone-Format + Screenshots
npm run test:vehicles         # E-Auto, Motorrad, Diesel-Transporter über die UI
grep -l WebGLRenderer dist/assets/*.js        # darf NUR CarScene3D-*.js nennen
```
Wichtig zum Preview-Server: Er stirbt in dieser Umgebung, wenn er als Hintergrund-Task läuft
und danach weitere Befehle folgen. Starte ihn in einem eigenen Prüfskript per `spawn`
(`node node_modules/vite/bin/vite.js preview --port 4173`, NICHT `npm.cmd` — das wirft unter
Windows `spawn EINVAL`) und beende ihn dort wieder.

Mehrzeilige Commit-Nachrichten über eine Datei und `git commit -F` übergeben — PowerShell
zerlegt Here-Strings gelegentlich mitten im Text.

Screenshots unter `screenshots/` danach ansehen — Farb- und Formfehler bestehen jeden Test.

### Was Du NICHT tun darfst
- `calculateTax()` in `src/lib/costs.ts` NICHT verändern — die Formel folgt § 9 KraftStG,
  hängt an der Erstzulassung und ist mit 22 Fällen in `npm run test:calc` belegt
- `calculateCosts()`, `valuate()` und `compareVehicles()` NICHT umbauen
- Die zuletzt gebauten Bereiche NICHT umbauen: `/compare`, `/workshops`, `/costs`, `/quote`,
  `/lookup`, `/reminders`, `src/lib/ai/google.ts` und `src/lib/vehicleImagePick.ts` sind
  fertig, getestet und dienen als Muster, nicht als Baustelle
- KEINE neue Bildquelle einführen und kein Foto ohne Urheber- und Lizenzangabe zeigen
- KEINE Herstellerbilder oder gekauften 3D-Modelle einbinden — Lizenzrisiko
- KEINE festen Preise, Teilenummern, Drehmomente oder Füllmengen hinterlegen
- `base` in `vite.config.ts` und `start_url`/`scope` im Manifest NICHT ändern, sonst lädt
  auf GitHub Pages keine Datei mehr
- Den API-Schlüssel NICHT irgendwo außer im Settings-Store ablegen und NICHT exportieren
- KEIN Backend, kein Login, keine Datenbank einführen — die App läuft bewusst ohne Server
- Den 2D-Rückfall NICHT entfernen — ohne WebGL wäre der Bereich sonst unbenutzbar
```

**Speicherort:** `.planning/session-prompts/3d-bauteil-explorer-prompt.md`
