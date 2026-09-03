# Restwert & Preisuntergrenze — Session-Prompt für Claude Code
## Den Prompt unten kopieren und als erste Nachricht in einer neuen Claude-Code-Sitzung einfügen
---

```
Du arbeitest am Projekt MERAQ AUTO AI (c:\Users\admin\Desktop\Meraq Car Assistent\meraq-auto-ai).
Lies ZUERST die CLAUDE.md im Projektwurzelverzeichnis — dort stehen Architektur, Regeln und Arbeitsweise.
Danach KONTEXT.md (Produkt, Design-System, Fahrzeugunabhängigkeit), PLAN.md (Stand und Roadmap)
und lessons.md (Korrekturen aus früheren Sitzungen).

## Aufgabe: Was ist mein Auto noch wert — und was ist die Untergrenze?

### Worum geht es?
Die App rechnet einen Marktwert und legt jeden Faktor offen. Was sie nicht beantwortet, ist die
Frage, mit der jemand vor dem Verkauf steht: **Unter welchem Preis gebe ich mein Auto unter Wert
weg?** Dazu kommt: Der berechnete Wert kennt das Fahrzeug nur auf dem Papier. Zwei offene
Fehlercodes, drei überfällige Wartungen und eine abgelaufene HU ändern heute nichts an der Zahl —
obwohl genau das beim Verkauf den Preis macht.

Ziel: Aus einer Schätzzahl wird eine Verhandlungsgrundlage — mit begründeter Untergrenze, dem
wirklichen Zustand des Fahrzeugs und einer zweiten Meinung von der KI.

### Was BEREITS EXISTIERT (~55 % — nicht neu bauen!)

LIES DIESE DATEIEN VOLLSTÄNDIG, bevor Du etwas änderst:

1. `src/lib/valuation.ts` (193 Zeilen, KOMPLETT und durch Tests abgesichert)
   - `Valuation` (~21): privateSale, dealerPurchase, dealerSale, exportValue, rangeMin/rangeMax
     (±7 %), residualIn3Years, factors[], basePriceNew, ageYears, kmPerYear
   - `valuate()` (~104): Neupreis × Alter × Laufleistung × Zustand × Antrieb
   - `estimateListPrice()` (~48), `ageFactor()` (~72), `mileageFactor()` (~79), `fuelFactor()` (~86)
   - `valueHistory()` (~168): Wertkurve aus derselben Formel rückgerechnet
   - **Die Formel ist gesetzt. Ergänze darauf, baue sie nicht um.**

2. `src/features/value/ValueScreen.tsx` (211 Zeilen, TRÄGT, endet aber zu früh)
   - `prices` (~33): vier Verkaufswege nebeneinander
   - Wertkurve mit Recharts, Faktortabelle „So kommt der Wert zustande", EstimateNote am Ende

3. `src/lib/maintenance.ts` — `maintenanceStatus()` (~127) liefert je Position
   `state: 'ok' | 'soon' | 'due' | 'overdue'`, `kmLeft`, `daysLeft`; `sortByUrgency()` (~170)

4. `src/store/useAppStore.ts` — die Datenquellen für den echten Zustand:
   `useVehicleMaintenance()` (~586), `useVehicleActivities()` (~589), `useVehicleDiagnoses()` (~602),
   `useVehicleDocuments()` (~607). Offene Fehlercodes sind `DiagnosisEntry` mit `resolved === false`.

5. `src/lib/invoiceCheck.ts` + `src/lib/guideCost.ts` — **das Muster für Lücke 1 und 2.**
   Reine Rechenfunktion ohne Netz, mit offengelegter `formula`, geprüft in einem eigenen Skript
   (`scripts/test-invoice.mjs`, `scripts/test-guide-cost.mjs`). Genau diesen Weg nachbauen.

6. `src/lib/invoiceExplain.ts` — **das Muster für Lücke 3.** Schema je Fahrzeug (`schemaFor()`),
   `askAiStructured()`, `sanitizeInvoice()` wirft erfundene Werte weg, Sitzungs-Zwischenspeicher.

7. `src/lib/ai/prompts.ts` — `SYSTEM_VEHICLE_FACTS` (~274) kennt Schwachstellen und Marktlage einer
   Baureihe, wird bisher nur im Nachschlagen-Screen als Fließtext genutzt.

8. `src/lib/costs.ts` — `calculateCosts()` (~218) nutzt `valuate()` für den Wertverlust (~225).
   Jede Änderung an der Bewertung schlägt hier und in `src/lib/compare.ts` (~31) durch.

### Was FEHLT (Deine Aufgabe — 4 Lücken schließen)

**Lücke 1: Es gibt keine Preisuntergrenze**
- Heute: `/value` zeigt vier Verkaufswege nebeneinander (ValueScreen ~33) und eine Spanne von ±7 %.
  Wer verkaufen will, liest daraus nicht ab, wo Schluss ist.
- Nötig: ein begründeter Mindestpreis. Der Händler-Ankauf ist die belastbare Untergrenze — den
  bekommt man sofort und ohne Aufwand. Wer privat darunter verkauft, verschenkt Geld.
  Dazu ein Satz, den man in der Verhandlung sagen kann.
- Ansatz: `sellingFloor()` als reine Funktion in `src/lib/sellingPrice.ts`, mit offengelegter
  Rechnung wie `positionPriceCheck()` in `invoiceCheck.ts`. Neuer Test `scripts/test-value.mjs`.

**Lücke 2: Der wirkliche Zustand zählt nicht mit**
- Heute: `valuate()` (~104) kennt Baujahr, Kilometerstand, `condition` und Antrieb. Ein Fahrzeug mit
  abgelaufener HU, zwei offenen Fehlercodes und überfälligem Zahnriemen ist exakt gleich viel wert
  wie eines ohne all das.
- Nötig: wertrelevante Auf- und Abschläge aus dem, was die App bereits weiß — überfällige Positionen
  (`maintenanceStatus()` ~127), offene Fehlercodes, HU-Termin (`vehicle.huDue`), belegte Wartung
  (Aktivitäten mit `costEur`, Dokumente). Jeder Posten mit Betrag **und** Begründung, nichts pauschal.
- Ansatz: reine Funktion `valueAdjustments(vehicle, context)` in `src/lib/sellingPrice.ts`, die
  **nach** `valuate()` greift. `valuate()` selbst bleibt unangetastet, sonst kippt `npm run test:calc`.
  Fehlt der Kontext (der Nachschlagen-Screen ruft `valuate()` ohne Store-Daten auf, LookupScreen ~134),
  kommt eine leere Liste zurück und die Anzeige bleibt wie heute.

**Lücke 3: Die Zahl steht allein da**
- Heute: Die EstimateNote sagt selbst, der Wert sei „nicht als Verhandlungsgrundlage" zu gebrauchen.
  Damit ist die wichtigste Frage der App am Ende offen. `SYSTEM_VEHICLE_FACTS` (~274) wüsste mehr.
- Nötig: eine strukturierte zweite Meinung — realistische Preisspanne für diese Baureihe, was den
  Preis bei genau diesem Modell hebt oder senkt, wie gefragt es ist, wie lange ein Verkauf dauert.
  Die eigene Rechnung bleibt die Hauptzahl; die KI-Spanne steht daneben und ist als Einschätzung
  gekennzeichnet. Weichen beide stark ab, benennt die App den Unterschied, statt ihn zu verstecken.
- Ansatz: `SYSTEM_MARKET_VALUE` in `src/lib/ai/prompts.ts` und `src/lib/marketValue.ts` nach dem
  Muster von `invoiceExplain.ts` (Schema, `askAiStructured`, Bereinigung, Zwischenspeicher).

**Lücke 4: Vom Wert führt kein Weg zum Verkauf**
- Heute: `/value` endet mit der Faktortabelle. Was man beim Verkauf in der Hand haben sollte, steht
  nirgends — dabei liegt das meiste davon schon in der App.
- Nötig: ein „Verkaufs-Check": was den Preis belegt (Belege im Verlauf mit Betrag, frisch erledigte
  Wartung, Rest-HU, gepflegte Dokumente), was ihn drückt, und was noch fehlt. Dazu der Mindestpreis
  aus Lücke 1 als merkbarer Satz.
- Ansatz: eigene Komponente unter `src/features/value/`, gespeist aus denselben Daten wie Lücke 2.
  Keine neue Datenquelle, keine neue Abhängigkeit.

### Rahmenbedingungen
- **`valuate()`, `calculateCosts()` und `compareVehicles()` NICHT umbauen.** Bestehende Felder von
  `Valuation` behalten Bedeutung und Wert. Neues kommt additiv daneben.
- **Nie Zahlen erfinden.** Jede Angabe ist eine offengelegte Rechnung mit `EstimateNote`. Die App
  darf nicht so tun, als hätte sie Marktdaten (DAT/Schwacke) — die gibt es hier nicht.
- **Fahrzeugunabhängigkeit ist die oberste Regel.** Motorrad, Transporter und E-Auto dürfen keine
  Pkw-Annahmen abbekommen (z. B. „Zahnriemen überfällig" bei einem E-Auto). Nach jeder Änderung
  `npm run test:vehicles`.
- **Ohne Kontext muss alles funktionieren.** Der Nachschlagen-Screen bewertet ein Fahrzeug, das gar
  nicht angelegt ist — dort gibt es weder Wartungsplan noch Fehlercodes.
- **Store-Regeln**: Listen-Selektoren mit `useShallow`, schreibende Aktionen im Store, Version
  erhöhen und Migration ergänzen, wenn sich die Form ändert (aktuell Version 9).
- **KI-Regeln**: nur über `askAi()` / `askAiStructured()`, System-Prompt in `prompts.ts`, Fehler durch
  `describeAiError()`, ohne Schlüssel ein Hinweis statt Absturz. Die KI liefert nie eine Endsumme,
  die die App selbst rechnen kann.
- **Prüfaufbauten müssen das Format der echten Gegenstelle nachbilden**, nicht die eigene Erwartung
  (siehe lessons.md — ein Test mit `\n\n` statt `\r\n\r\n` hat einen kompletten Ausfall verdeckt).
- Kein horizontales Scrollen, entworfen bei 390 × 844 px, Touch-Ziele ab 44 px.
- Farben nur über Theme-Utilities (`text-ink-muted`, `bg-brand-blue/15`), niemals `text-[--color-ink]`.
  Bausteine aus `src/components/ui` verwenden.
- UI-Texte und Kommentare auf Deutsch (Du-Form), Bezeichner im Code auf Englisch.
- Der Erststart liegt bei 107 kB gzip (`npm run analyze`). Keine neue Abhängigkeit — Recharts liegt
  bereits im Lazy-Chunk von `/value`.

### Arbeitsweise
1. Alle oben genannten Dateien VOLLSTÄNDIG lesen, bevor Du planst
2. Die vier Lücken als voneinander unabhängige Änderungen planen
3. Eine Lücke nach der anderen umsetzen, jeweils mit Codeänderung und Prüfung:
   `node node_modules/typescript/bin/tsc -b` und `node node_modules/vite/bin/vite.js build`
   (`npm run build` macht beides, überschreitet hier aber gern das Zeitlimit)
4. Neues Testskript `scripts/test-value.mjs` anlegen, in `package.json` als `test:value` eintragen
   und in `scripts/verify.mjs` in die Liste `PURE` aufnehmen
5. Nach allen Lücken die vollständige Absicherung (siehe unten)
6. Ein Commit pro Lücke mit aussagekräftiger deutscher Nachricht. Mehrzeilige Nachrichten über eine
   Datei und `git commit -F` übergeben, die Datei mit dem Write-Tool schreiben —
   `Set-Content -Encoding utf8` setzt unter PowerShell 5.1 ein BOM in die Commit-Nachricht.

### Verifikation
```bash
npm run lint
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
npm run test:calc
npm run test:value
npm run verify
npm run test:vehicles
```
Vor jedem Lauf mit Oberflächen-Tests die Vorschau-Ports freiräumen, sonst prüft der Test einen
fremden Stand:
```bash
for p in $(seq 4173 4185); do pid=$(netstat -ano | grep -E ":$p .*LISTENING" | awk '{print $5}' | head -1); [ -n "$pid" ] && taskkill //F //PID $pid; done
```
Screenshots unter `screenshots/` danach ansehen — Farb- und Formfehler bestehen jeden Test.

### Was Du NICHT tun darfst
- `calculateTax()` in `src/lib/costs.ts` NICHT verändern — § 9 KraftStG, 22 Fälle in `test:calc`
- Die Formel und die Faktoren in `valuate()` NICHT ändern und keine bestehenden `Valuation`-Felder
  umdeuten — `calculateCosts()` und `compareVehicles()` hängen daran
- `calculateCosts()`, `compareVehicles()` und `valueHistory()` NICHT umbauen
- Die Rechnungserklärung (`src/features/invoice/*`, `src/lib/invoice*.ts`) und den 3D-Bauteil-Explorer
  (`src/features/manual/*`, `src/lib/part*.ts`) NICHT umbauen — fertig, getestet, dienen als Muster
- KEINE echten Marktdaten behaupten und KEINE Fahrzeugbörse abfragen (kein Scraping von mobile.de,
  AutoScout24 o. Ä.) — weder im Code noch in den KI-Prompts
- KEINE festen Preise für ein bestimmtes Modell hinterlegen — alles skaliert über `vehicleProfile()`
- KEINE neue Abhängigkeit für Diagramme, Zustand oder Rechnen
- `base` in `vite.config.ts` und `start_url`/`scope` im Manifest NICHT ändern
- Den API-Schlüssel NICHT irgendwo außer im Settings-Store ablegen und NICHT exportieren
- KEIN Backend, kein Login, keine Datenbank — die App läuft bewusst ohne Server
```

**Speicherort:** `.planning/session-prompts/restwert-und-preisuntergrenze-prompt.md`
