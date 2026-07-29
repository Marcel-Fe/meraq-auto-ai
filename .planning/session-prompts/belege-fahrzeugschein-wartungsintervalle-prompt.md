# Belege, Fahrzeugschein-Scan und Wartungsintervalle — Session-Prompt für Claude Code
## Kopiere den Prompt unten und füge ihn als erste Nachricht in eine neue Claude-Code-Session ein
---

```
Du arbeitest am Projekt MERAQ AUTO AI (c:\Users\admin\Desktop\Meraq Car Assistent\meraq-auto-ai).
Lies ZUERST die CLAUDE.md im Projektwurzelverzeichnis — dort stehen Architektur, Regeln und Arbeitsweise.
Danach KONTEXT.md (Produkt, Design-System, Fahrzeugunabhängigkeit) und PLAN.md (Stand und Roadmap).

## Aufgabe: Belege auswerten, Fahrzeugschein scannen, Wartungsintervalle anpassbar machen

### Worum geht es?
Die App kann Dokumente bereits fotografieren und per KI auslesen — aber das Ergebnis landet nur als
Freitext im Dokument. Dadurch bleibt die Kostenrechnung eine Schätzung, obwohl der Nutzer die echten
Rechnungen im Handy hat. Genauso muss ein Fahrzeug komplett von Hand eingetippt werden, obwohl im
Fahrzeugschein alles steht. Und der Wartungsplan lässt sich nicht an den Herstellerplan anpassen.

Ziel: Aus fotografierten Belegen werden echte Kostendaten, aus dem Fahrzeugschein wird ein
vorausgefülltes Fahrzeug, und Wartungsintervalle werden editierbar. Das macht aus geschätzten
Zahlen die tatsächlichen Zahlen des Nutzers.

### Was BEREITS EXISTIERT (~85 % der Bausteine — nicht neu bauen!)

LIES DIESE DATEIEN VOLLSTÄNDIG, bevor Du etwas änderst:

1. `src/lib/ai/client.ts` — einziger Zugang zur Claude-API (224 Zeilen, KOMPLETT)
   - `askClaude()` (Zeile ~59): Streaming-Antwort als Text
   - `askClaudeStructured<T>()` (Zeile ~93): **erzwingt gültiges JSON über einen Werkzeugaufruf**
     — genau das Werkzeug, das Du für alle drei Lücken brauchst
   - `userMessage()` (Zeile ~136): baut einen Nutzer-Turn mit Bild (base64)
   - `describeAiError()`: übersetzt Rohfehler in verständliche deutsche Meldungen
   - Prompt-Caching sitzt auf dem letzten System-Block — Wechselndes muss danach stehen

2. `src/features/partfinder/PartFinderScreen.tsx` — **die Vorlage für strukturierte Bildauswertung**
   (392 Zeilen, KOMPLETT). Zeigt das komplette Muster: JSON-Schema als Konstante (Zeile ~30),
   Foto aufnehmen, `askClaudeStructured` aufrufen, Ergebnis typisiert anzeigen, Fehler behandeln,
   Unsicherheit ehrlich kennzeichnen. Halte Dich an dieses Muster.

3. `src/features/documents/DocumentsScreen.tsx` — Dokumentenablage (331 Zeilen, TEILWEISE)
   - `pickFile()` (~79) → `save()` (~87): Foto verkleinern, in IndexedDB, Metadaten in den Store
   - `extract()` (~109): liest per `askClaude` + `SYSTEM_DOCUMENT` (~68 in prompts.ts) aus,
     speichert das Ergebnis aber nur als **Freitext** in `updateDocument(id, { extracted })` (~133)
   - Integration: Route `/documents`, verlinkt aus Bottom-Nav und Kosten-Screen

4. `src/store/useAppStore.ts` — der einzige Store (444 Zeilen, KOMPLETT)
   - `addActivity()` (~237): legt einen Verlaufseintrag an — **`costEur` und `mileage` sind vorgesehen**
   - `addVehicle()` (~131): legt Fahrzeug an und erzeugt automatisch den passenden Wartungsplan
   - `updateMaintenance()` (~234): **existiert, wird aber NIRGENDS aufgerufen** (verifiziert)
   - `completeMaintenance()` (~210): setzt eine Position auf heute/aktuellen km-Stand
   - Persistenz mit Migration, aktuell Version 3

5. `src/lib/costs.ts` — Gesamtkostenrechnung (230 Zeilen, KOMPLETT)
   - `calculateCosts()` (~181): summiert bereits `activities[].costEur` der letzten 12 Monate
     und setzt `maintenanceFromRecords = true` (~201), sobald echte Belege da sind.
     **Die Auswertung wartet also nur auf Daten** — genau die liefert Lücke 1.
   - `calculateTax()`: Kfz-Steuer nach § 9 KraftStG, geprüft gegen reale Bescheide. NICHT ändern.

6. `src/features/vehicle/VehicleFormScreen.tsx` — Fahrzeug anlegen/bearbeiten (308 Zeilen, TEILWEISE)
   - `save()` (~78): validiert Marke/Modell/Baujahr, ruft `addVehicle(form)` (~91)
   - Vollständig manuelles Formular, `useState<FormState>` — es fehlt jeder Import-Weg
   - Felder für Hubraum/CO₂ liegen im Typ, werden hier aber noch nicht abgefragt

7. `src/features/maintenance/MaintenanceScreen.tsx` — Wartungsplan (209 Zeilen, TEILWEISE)
   - Sheet ab Zeile ~159 zeigt Intervall und letzte Erledigung nur als **Text**
   - Einzige Aktion: „Jetzt als erledigt eintragen" (~195) ruft `completeMaintenance`
   - Keine Möglichkeit, Intervall oder Erledigungsdatum zu korrigieren

8. `src/types.ts` — alle Typen (264 Zeilen). Relevant: `ActivityEntry` (mit `costEur`, `mileage`),
   `Vehicle` (mit `displacementCcm`, `co2GramPerKm`, `consumption`), `MaintenanceItem`,
   `DetectedPart` (Beispiel für einen KI-Ergebnistyp)

### Was FEHLT (Deine Aufgabe — 3 Lücken schließen)

**Lücke 1: Rechnung fotografieren wird zur Kostenauswertung**
- Heute: `extract()` in `DocumentsScreen.tsx` (~109) liefert nur Fließtext. Die Kostenrechnung in
  `costs.ts` (~194) findet keine `costEur`-Einträge und schätzt deshalb weiter.
- Nötig: Bei Kategorie „Rechnung" oder „Serviceheft" strukturiert auslesen — Betrag brutto,
  Datum, ausgeführte Leistung, Kilometerstand, Werkstatt — und dem Nutzer als vorausgefülltes
  Formular anbieten. Bestätigt er, `addActivity()` mit `costEur`, `mileage`, `icon: 'invoice'`
  aufrufen. Wenn die Leistung zu einer Wartungsposition passt, zusätzlich `completeMaintenance()`
  vorschlagen.
- Ansatz: Neuen `SYSTEM_INVOICE`-Prompt in `src/lib/ai/prompts.ts` neben `SYSTEM_DOCUMENT` anlegen,
  `askClaudeStructured` mit Schema aufrufen (Muster: `PartFinderScreen.tsx` ~30). Der Nutzer muss
  jeden Wert vor dem Übernehmen sehen und ändern können — nie ungeprüft speichern.

**Lücke 2: Fahrzeugschein-Scan legt das Fahrzeug an**
- Heute: `VehicleFormScreen.tsx` ist reine Handeingabe (~48–308). Hubraum und CO₂ fehlen dort ganz,
  obwohl `calculateTax()` sie braucht — der Kosten-Screen bettelt deshalb um Nachträge.
- Nötig: Button „Fahrzeugschein fotografieren" oben im Formular. Foto → strukturiertes Auslesen der
  Felder B (Erstzulassung), D.1/D.2/D.3 (Marke, Typ, Handelsbezeichnung), E (VIN), P.1 (Hubraum),
  P.2 (Leistung kW), P.3 (Kraftstoff), V.7 (CO₂) → Formular vorausfüllen. Zusätzlich Eingabefelder
  für Hubraum und CO₂ ergänzen.
- Ansatz: `SYSTEM_REGISTRATION`-Prompt mit den genormten Feldnummern. Jedes Feld einzeln als
  optional im Schema, plus ein `confidence`-Feld je Wert. Unsichere Werte im Formular markieren,
  damit der Nutzer sie prüft. Der Nutzer bestätigt immer selbst — kein Auto-Speichern.

**Lücke 3: Wartungsintervalle anpassbar**
- Heute: `updateMaintenance()` im Store (~234) ist implementiert, wird aber von keiner Komponente
  aufgerufen (per Grep verifiziert). Der Nutzer kann den Plan nicht an sein Serviceheft anpassen.
- Nötig: Im Sheet von `MaintenanceScreen.tsx` (~159) editierbar machen: Intervall in km, Intervall
  in Monaten, Datum und Kilometerstand der letzten Erledigung, sowie ein Notizfeld (`note` ist im
  Typ vorhanden). Zusätzlich: eigene Wartungsposition anlegen und Position löschen.
- Ansatz: Sheet um einen Bearbeiten-Modus erweitern, `updateMaintenance` anbinden. Für „eigene
  Position" und „löschen" brauchst Du zwei neue Store-Aktionen analog zu den bestehenden.
  Der aus `defaultMaintenance()` erzeugte Plan bleibt der Startwert — er wird nur überschrieben.

### Rahmenbedingungen
- **Fahrzeugunabhängigkeit ist die oberste Regel.** Nichts anzeigen, was zum aktiven Fahrzeug nicht
  passt. Eigenschaften kommen aus `vehicleTraits()`, Preisfaktoren aus `vehicleProfile()` in
  `src/lib/vehicleProfile.ts`. Nach jeder Änderung `npm run test:vehicles` laufen lassen.
- **Nie Zahlen erfinden.** Jede Schätzung braucht eine offengelegte Rechnung und die Komponente
  `EstimateNote`. Von der KI ausgelesene Werte immer vom Nutzer bestätigen lassen.
- **Farben nur über Theme-Utilities**: `text-ink-muted`, `bg-brand-blue/15`, `border-danger/30`.
  Niemals `text-[--color-ink]` — das erzeugt in Tailwind v4 keine Farbe und fällt erst im
  Screenshot auf, weil das Element weiß bleibt.
- **Store-Selektoren, die filtern oder sortieren, brauchen `useShallow`.** Sonst entsteht bei jedem
  Render ein neues Array und React läuft in eine Endlosschleife (Fehler #185, weiße Seite).
- **Alle KI-Aufrufe über `src/lib/ai/client.ts`**, System-Prompts nach `src/lib/ai/prompts.ts`.
  Fehler nie roh anzeigen — immer durch `describeAiError()`.
- Jeder KI-Weg braucht einen sinnvollen Zustand ohne API-Schlüssel (Hinweis statt Absturz).
- UI-Texte und Kommentare auf Deutsch (Du-Form), Bezeichner im Code auf Englisch.
- Mobil zuerst: entworfen bei 390 × 844 px, Touch-Ziele mindestens 44 px, kein horizontales Scrollen.
- Bei Änderungen am Datenmodell die Store-Version erhöhen und eine `migrate`-Stufe ergänzen
  (aktuell Version 3, Muster ist vorhanden).

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
npm run build                 # tsc + vite, muss ohne Fehler durchlaufen
npm run preview &             # Server auf http://localhost:4173/meraq-auto-ai/
npm run test:smoke            # 21 Screens im iPhone-Format + Screenshots
npm run test:vehicles         # E-Auto, Motorrad, Diesel-Transporter über die UI
grep -rn "updateMaintenance" src --include=*.tsx   # nach Lücke 3: muss Treffer liefern
```
Screenshots unter `screenshots/` danach ansehen — Farbfehler bestehen den Test, sehen aber falsch aus.

### Was Du NICHT tun darfst
- `calculateTax()` in `src/lib/costs.ts` NICHT verändern — die Formel ist nach § 9 KraftStG
  umgesetzt und gegen reale Steuerbescheide geprüft (BMW 320d 250 €, VW Golf 1.4 TSI 79 €)
- KEINE Teilenummern erfinden oder fest hinterlegen — sie gelten nur für eine Baureihe und
  Motorvariante. Die App ermittelt sie bewusst per KI über die Fahrgestellnummer.
- KEINE festen Preise für ein bestimmtes Modell in `src/data/parts.ts` — nur Vorlagen mit
  Basispreis, die Umrechnung machen `partsFor()` und `repairJobsFor()`
- Von der KI ausgelesene Werte NIEMALS ungeprüft speichern — der Nutzer bestätigt jeden Wert
- `base` in `vite.config.ts` und `start_url`/`scope` im Manifest NICHT ändern, sonst lädt auf
  GitHub Pages keine Datei mehr
- Den API-Schlüssel NICHT irgendwo außer im Settings-Store ablegen und NICHT exportieren
- Die vier zuletzt gebauten Bereiche NICHT umbauen: `/part-finder`, `/costs`, `/quote`, `/lookup`
  sind fertig, getestet und live — sie dienen als Muster, nicht als Baustelle
- KEIN Backend, kein Login, keine Datenbank einführen — die App läuft bewusst ohne Server
```

**Speicherort:** `.planning/session-prompts/belege-fahrzeugschein-wartungsintervalle-prompt.md`
