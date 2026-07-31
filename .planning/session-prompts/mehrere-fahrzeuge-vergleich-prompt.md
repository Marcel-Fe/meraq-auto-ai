# Mehrere Fahrzeuge im Vergleich — Session-Prompt für Claude Code
## Kopiere den Prompt unten und füge ihn als erste Nachricht in eine neue Claude-Code-Session ein
---

```
Du arbeitest am Projekt MERAQ AUTO AI (c:\Users\admin\Desktop\Meraq Car Assistent\meraq-auto-ai).
Lies ZUERST die CLAUDE.md im Projektwurzelverzeichnis — dort stehen Architektur, Regeln und Arbeitsweise.
Danach KONTEXT.md (Produkt, Design-System, Fahrzeugunabhängigkeit) und PLAN.md (Stand und Roadmap).

## Aufgabe: Mehrere Fahrzeuge im Vergleich

### Worum geht es?
Ein Nutzer kann bereits mehrere Fahrzeuge anlegen und zwischen ihnen wechseln — aber immer nur
eines ansehen. Wer zwei Autos hat oder über einen Wechsel nachdenkt, muss die Zahlen von Hand
gegenüberstellen: Was kostet welches im Monat? Welches verliert schneller an Wert? Welches ist
teurer im Unterhalt?

Ziel: Ein Screen, der zwei oder drei Fahrzeuge nebeneinander stellt — Gesamtkosten, Wertverlust,
Steuer, Sprit, Wartung und Marktwert. Alle Bausteine dafür rechnen bereits; es fehlt die
Gegenüberstellung.

### Was BEREITS EXISTIERT (~80 % der Bausteine — nicht neu bauen!)

LIES DIESE DATEIEN VOLLSTÄNDIG, bevor Du etwas änderst:

1. `src/lib/costs.ts` — Gesamtkostenrechnung (230 Zeilen, KOMPLETT)
   - `calculateCosts(vehicle, activities)` (~165): liefert `CostBreakdown` mit `depreciation`,
     `tax`, `insurance`, `fuel`, `maintenance`, `totalYear`, `totalMonth`, `perKm`,
     `maintenanceFromRecords`, `fuelPricePerUnit`, `fuelUnit`
   - `calculateTax(vehicle)` (~37): Kfz-Steuer nach § 9 KraftStG. NICHT ändern.
   - Beide Funktionen sind rein und nehmen ein beliebiges Fahrzeug — genau das braucht der Vergleich

2. `src/lib/valuation.ts` — Wertschätzung (KOMPLETT)
   - `valuate(vehicle, at?)` (~107): liefert `privateSale`, `rangeMin/rangeMax`, `dealerPurchase`,
     `factors[]` (jeder Faktor einzeln offengelegt)

3. `src/features/costs/CostsScreen.tsx` — Kosten eines Fahrzeugs (349 Zeilen, KOMPLETT)
   - Zeile ~34–73: die fünf Kostenzeilen mit Icon, Label, Wert, Hinweis und Farbton
   - Zeile ~117–155: Balkendarstellung mit Anteil in Prozent
   - Zeile ~339: Hilfskomponente `Comparison` — Muster für eine Kennzahlzeile
   - **Vorlage für die Darstellung. Diesen Screen NICHT umbauen.**

4. `src/store/useAppStore.ts` — der einzige Store (~520 Zeilen, KOMPLETT)
   - `vehicles: Vehicle[]` und `activeVehicleId` (~30)
   - `useActiveVehicle()` (~492), `useVehicleActivities()` (~498): filtern auf das AKTIVE Fahrzeug
   - `setActiveVehicle(id)` (~46)
   - Persistenz mit Migration, aktuell Version 6
   - **Achtung:** Listen-Selektoren brauchen `useShallow` (~486 erklärt warum)

5. `src/features/vehicle/VehicleScreen.tsx` — Fahrzeugdetail (KOMPLETT)
   - Abschnitt „Meine Fahrzeuge" (~185–211): Liste aller Fahrzeuge mit Wechseln
   - Sheet „Fahrzeug wechseln" (~264)
   - Zeigt das Fahrzeugbild über `VehicleImage` (~111)

6. `src/components/VehicleCard.tsx` — Fahrzeugbild und -kachel (KOMPLETT)
   - `VehicleImage` (~57): eigenes Foto, sonst frei lizenziertes Web-Foto, sonst Silhouette
   - `VehicleImageCredit` (~80): Pflichtangabe Urheber + Lizenz
   - `useVehicleWebImage` (~18): holt das Bild einmalig

7. `src/features/more/MoreScreen.tsx` — Einstieg für Nebenbereiche (TEILWEISE)
   - Abschnitt mit `Row`-Einträgen zu `/costs`, `/quote`, `/lookup`, `/reminders`
   - Hier fehlt der Einstieg zum Vergleich

8. `src/app/App.tsx` — Router (101 Zeilen, KOMPLETT)
   - Lazy-Imports (~12–31), Routen (~68–89). Neuer Screen braucht hier einen Eintrag.

### Was FEHLT (Deine Aufgabe — 3 Lücken schließen)

**Lücke 1: Kennzahlen für mehrere Fahrzeuge gleichzeitig holen**
- Heute: `useVehicleActivities()` (~498 in `useAppStore.ts`) filtert hart auf `activeVehicleId`.
  Für einen Vergleich braucht man die Belege JEDES verglichenen Fahrzeugs — sonst rechnet
  `calculateCosts()` für die anderen ohne Belegdaten und der Vergleich wird schief.
- Nötig: Ein Selektor, der die Aktivitäten aller Fahrzeuge liefert (mit `useShallow`), plus eine
  reine Hilfsfunktion, die je Fahrzeug `calculateCosts()` und `valuate()` aufruft.
- Ansatz: Selektor `useAllActivities()` neben die bestehenden setzen; die Zusammenstellung als
  Funktion `compareVehicles(vehicles, activities)` in einer neuen Datei `src/lib/compare.ts`,
  damit sie ohne React testbar bleibt.

**Lücke 2: Vergleichs-Screen**
- Heute: Es gibt keinen Screen, der zwei Fahrzeuge nebeneinander zeigt.
- Nötig: Neuer Screen `src/features/compare/CompareScreen.tsx` mit Route `/compare`:
  Auswahl von zwei (optional drei) Fahrzeugen, darunter je eine Zeile pro Kennzahl —
  Kosten pro Monat, pro km, Wertverlust, Sprit/Strom, Wartung, Versicherung, Steuer, Marktwert.
  Das jeweils günstigere Fahrzeug wird pro Zeile hervorgehoben.
- Ansatz: Kennzahl links, Werte rechts nebeneinander (Grid mit 2–3 Spalten). Fahrzeugbilder über
  `VehicleImage` als Kopf der Spalten. Muster für eine Kennzahlzeile: `Comparison` in
  `CostsScreen.tsx` (~339). Bei nur einem angelegten Fahrzeug einen `EmptyState` zeigen, der
  zum Anlegen führt.

**Lücke 3: Einstieg und Testabdeckung**
- Heute: Ohne Route und ohne Verlinkung ist der Screen nicht erreichbar, und der Smoke-Test
  kennt ihn nicht.
- Nötig: Lazy-Import und Route in `src/app/App.tsx` (~29 bzw. ~84), eine `Row` in
  `src/features/more/MoreScreen.tsx` neben „Erinnerungen", und den Eintrag
  `['compare', '#/compare']` in `ROUTES` in `scripts/smoke-test.mjs`.
- Zusätzlich sinnvoll: Aus dem Abschnitt „Meine Fahrzeuge" in `VehicleScreen.tsx` (~185)
  auf den Vergleich verlinken, sobald mindestens zwei Fahrzeuge existieren.

### Rahmenbedingungen
- **Fahrzeugunabhängigkeit ist die oberste Regel.** Ein E-Auto hat keinen Kraftstoff-, sondern
  einen Stromverbrauch — `CostBreakdown.fuelUnit` und `fuelPricePerUnit` liefern die richtige
  Einheit. Vergleicht man Diesel gegen Elektro, müssen Beschriftung und Einheit stimmen.
- **Kein horizontales Scrollen.** Entworfen wird bei 390 × 844 px; der Smoke-Test lässt den
  Test durchfallen, wenn die Seite breiter wird. Drei Spalten sind bei dieser Breite eng —
  zwei Fahrzeuge sind der Normalfall, das dritte darf enger werden.
- **Nie Zahlen erfinden.** Wertverlust, Versicherung und Wartung sind Schätzungen und brauchen
  die Komponente `EstimateNote`. Wo ein Fahrzeug ohne erfasste Belege gegen eines mit Belegen
  antritt, muss das sichtbar sein (`maintenanceFromRecords`), sonst wirkt der Vergleich genauer
  als er ist.
- **Store-Selektoren, die filtern oder sortieren, brauchen `useShallow`.** Sonst entsteht bei
  jedem Render ein neues Array und React läuft in eine Endlosschleife (Fehler #185, weiße Seite).
- **Farben nur über Theme-Utilities**: `text-ink-muted`, `bg-brand-blue/15`, `border-danger/30`.
  Niemals `text-[--color-ink]` — das erzeugt in Tailwind v4 keine Farbe und fällt erst im
  Screenshot auf, weil das Element weiß bleibt.
- Wiederverwendbare Bausteine kommen aus `src/components/ui` (`Card`, `Row`, `Badge`, `Segmented`,
  `SectionTitle`, `EmptyState`, `EstimateNote`) — keine Einzelanfertigungen.
- UI-Texte und Kommentare auf Deutsch (Du-Form), Bezeichner im Code auf Englisch.
- Touch-Ziele mindestens 44 px, unterster Inhalt braucht Abstand zur Bottom-Nav.
- Am Datenmodell ist für diese Aufgabe voraussichtlich nichts zu ändern. Falls doch:
  Store-Version erhöhen und eine `migrate`-Stufe ergänzen (aktuell Version 6, Muster vorhanden).

### Arbeitsweise
1. Alle oben genannten Dateien VOLLSTÄNDIG lesen, bevor Du planst
2. Die drei Lücken als voneinander unabhängige Änderungen planen
3. Eine Lücke nach der anderen umsetzen, jeweils mit:
   - Codeänderung
   - `npm run build` (führt `tsc -b` mit aus) — muss fehlerfrei sein
4. Nach allen Lücken beide Testläufe als Rückfall-Absicherung
5. Ein Commit pro Lücke mit aussagekräftiger deutscher Nachricht

### Verifikation
```bash
npm run lint                  # oxlint, nur die bekannte Fast-Refresh-Warnung ist erlaubt
npm run build                 # tsc + vite, muss ohne Fehler durchlaufen
npm run preview               # Server auf http://localhost:4173/meraq-auto-ai/
npm run test:smoke            # alle Screens im iPhone-Format + Screenshots
npm run test:vehicles         # E-Auto, Motorrad, Diesel-Transporter über die UI
grep -rn "compare" src/app/App.tsx scripts/smoke-test.mjs   # Route und Test müssen Treffer liefern
```
Wichtig zum Preview-Server: Er stirbt in dieser Umgebung, wenn er als Hintergrund-Task läuft und
danach weitere Befehle folgen. Starte ihn und führe die Tests unmittelbar danach aus — oder
starte ihn in einem eigenen Prüfskript per `spawn` und beende ihn dort wieder.

Screenshots unter `screenshots/` danach ansehen — Farbfehler bestehen den Test, sehen aber falsch aus.

### Was Du NICHT tun darfst
- `calculateTax()` in `src/lib/costs.ts` NICHT verändern — die Formel ist nach § 9 KraftStG
  umgesetzt und gegen reale Steuerbescheide geprüft (BMW 320d 250 €, VW Golf 1.4 TSI 79 €)
- `calculateCosts()` und `valuate()` NICHT umbauen — der Vergleich ruft sie nur je Fahrzeug auf.
  Fällt beim Vergleichen ein Rechenfehler auf: erst melden, nicht still korrigieren
- Die zuletzt gebauten Bereiche NICHT umbauen: `/costs`, `/quote`, `/lookup`, `/part-finder`,
  `/reminders` und `src/lib/vehicleImage.ts` sind fertig, getestet und live — sie dienen als
  Muster, nicht als Baustelle
- KEINE neue Bildquelle einführen — Fahrzeugbilder kommen ausschließlich über `VehicleImage`,
  und wo ein Bild groß gezeigt wird, gehört `VehicleImageCredit` daneben (Lizenzpflicht)
- KEINE festen Preise oder Teilenummern für ein bestimmtes Modell hinterlegen
- `base` in `vite.config.ts` und `start_url`/`scope` im Manifest NICHT ändern, sonst lädt auf
  GitHub Pages keine Datei mehr
- Den API-Schlüssel NICHT irgendwo außer im Settings-Store ablegen und NICHT exportieren
- KEIN Backend, kein Login, keine Datenbank einführen — die App läuft bewusst ohne Server
```

**Speicherort:** `.planning/session-prompts/mehrere-fahrzeuge-vergleich-prompt.md`
