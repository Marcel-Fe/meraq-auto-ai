# Anleitungen mit KI — Session-Prompt für Claude Code
## Kopiere den Prompt unten und füge ihn als erste Nachricht in einer neuen Claude-Code-Sitzung ein
---

```
Du arbeitest am Projekt MERAQ AUTO AI (c:\Users\admin\Desktop\Meraq Car Assistent\meraq-auto-ai).
Lies ZUERST die CLAUDE.md im Projektwurzelverzeichnis — dort stehen Architektur, Regeln und Arbeitsweise.
Danach KONTEXT.md (Produkt, Design-System, Fahrzeugunabhängigkeit) und PLAN.md (Stand und Roadmap).

## Aufgabe: Aus den Anleitungen einen echten Reparatur-Assistenten machen

### Worum geht es?
Der Bauteil-Explorer beantwortet inzwischen „wo sitzt es", „wie sieht es aus" und „was kostet
es". Die Anleitungen beantworten dagegen noch nicht „wie mache ich es an MEINEM Fahrzeug":
Sie zeigen elf allgemeingültige Abläufe, die für jedes Auto gleich aussehen. Wer mitten in der
Arbeit die App neu lädt, verliert sogar seinen Fortschritt.

Ziel: Die Anleitung begleitet einen echten Nachmittag in der Garage — sie merkt sich, wo man
steht, sagt was bei genau diesem Fahrzeug anders ist, was die Werkstatt dafür verlangen würde,
und trägt die erledigte Arbeit hinterher in Wartungsplan und Verlauf ein.

### Was BEREITS EXISTIERT (~60 % — nicht neu bauen!)

LIES DIESE DATEIEN VOLLSTÄNDIG, bevor Du etwas änderst:

1. `src/data/guides.ts` (236 Zeilen, KOMPLETT) — die Anleitungs-Datenbank
   - `GUIDES` (~9): 11 Anleitungen mit `steps`, `tools`, `parts`, `safety`, `durationMin`,
     `difficulty` — Ölwechsel, Bremsbeläge, Zündkerzen, Kette, Starthilfe …
   - `GUIDE_REQUIREMENTS` (~218) und `guidesFor(vehicle)` (~230): filtert fahrzeuggerecht
   - **Die Datenbasis ist gut. Ergänze Felder, statt sie umzubauen.**

2. `src/features/guides/GuideDetailScreen.tsx` (204 Zeilen, TRÄGT, aber flach)
   - `done` (~18): abgehakte Schritte als Set<number> — **nur lokaler State**
   - `askForVehicle()` (~40): fragt die KI im Fließtext nach Besonderheiten
   - Schrittliste mit Abhaken, Werkzeug- und Teileliste, Sicherheitshinweis

3. `src/features/guides/GuidesScreen.tsx` (103 Zeilen, KOMPLETT) — Liste, Suche, Kategorien

4. `src/lib/partExplain.ts` + `src/lib/partCost.ts` + `src/features/manual/PartExplanationView.tsx`
   — **das Muster für Lücke 2 und 3.** Strukturierte KI-Antwort über `askAiStructured()` mit
   eigenem Schema, Kostenrahmen als reine, testbare Funktion (`partCostEstimate()`, belegt in
   `scripts/test-part-cost.mjs`), Darstellung als eigene Komponente.
   **Genau diesen Weg nachbauen, nicht neu erfinden.**

5. `src/data/manual.ts` — `findHotspotId(text, vehicle)` (~330) und `zoneOfHotspot()` (~380)
   liefern zu einem Begriff das passende Bauteil im 3D-Modell. Sprungziel: `/manual?teil=<id>`

6. `src/store/useAppStore.ts` (Store-Version 8) — `completeMaintenance(itemId)` (~255),
   `updateMaintenance()` (~279), `addActivity()` (~288). Schreibende Aktionen gehören hierher.

7. `src/data/parts.ts` — `repairJobsFor(vehicle)` (~329): Werkstattpositionen mit Arbeitswert,
   umgerechnet auf Marke und Fahrzeugart

8. `scripts/test-part-cost.mjs` — Muster für einen reinen Logiktest ohne Netz
   (läuft über `node --experimental-strip-types` mit `scripts/ts-resolve.mjs`)

### Was FEHLT (Deine Aufgabe — 5 Lücken schließen)

**Lücke 1: Der Fortschritt überlebt keinen Blick aufs Handy**
- Heute: `done` in `GuideDetailScreen.tsx` (~18) ist lokaler State. Wer unter dem Auto liegt,
  die App wegwischt und zurückkommt, fängt bei Schritt 1 an.
- Nötig: abgehakte Schritte je Fahrzeug und Anleitung im Store, dazu ein sichtbarer
  Fortschritt („Schritt 3 von 6") und ein Weg, den Ablauf zurückzusetzen.
- Ansatz: `guideProgress` als Record im Store (Schlüssel aus Fahrzeug- und Anleitungs-Id),
  Store-Version auf 9 heben. Schreibende Aktion in den Store, nicht in die Komponente.

**Lücke 2: „Was ist bei meinem Fahrzeug anders?" kommt als Fließtext**
- Heute: `askForVehicle()` (~40) streamt Prosa. Man kann sie nicht neben den Schritt legen,
  an dem man gerade steht.
- Nötig: eine strukturierte Antwort — Besonderheiten je Schritt, benötigtes Spezialwerkzeug,
  realistische Zeit für Ungeübte, typische Stolperfallen, und ob die KI von der Eigenarbeit
  an diesem Fahrzeug abrät. Füllmengen und Drehmomente bleiben Verweise aufs Handbuch.
- Ansatz: `SYSTEM_GUIDE_ADAPT` in `src/lib/ai/prompts.ts`, dazu `src/lib/guideAdapt.ts` nach
  dem Muster von `partExplain.ts` (Schema, Sitzungs-Zwischenspeicher, `askAiStructured`).
  Der Bezug zum Schritt gehört in die Antwort, damit die App den Hinweis am richtigen
  Schritt anzeigt.

**Lücke 3: Selbst machen oder machen lassen — die Frage bleibt offen**
- Heute: Die Anleitung nennt Dauer und Werkzeug, aber nicht, was die Werkstatt verlangen würde.
  Genau daran entscheidet sich, ob jemand selbst schraubt.
- Nötig: eine ehrliche Gegenüberstellung — Teile plus eigene Zeit gegen Werkstattpreis, mit
  offengelegter Rechnung und dem Hinweis, dass Werkzeug einmalig gekauft werden muss.
- Ansatz: `repairJobsFor(vehicle)` liefert den Arbeitswert, `settings.hourlyRateEur` den Satz;
  die Rechnung als reine Funktion in eine eigene Datei (prüfbar wie `partCost.ts`).
  Bei Anleitungen mit gesetztem `safety` bleibt der Rat zur Werkstatt sichtbar.

**Lücke 4: Von der Anleitung führt kein Weg zum Bauteil**
- Heute: `/guides/:id` und `/manual` kennen sich nicht, obwohl `findHotspotId()` seit dem
  3D-Explorer genau diese Brücke schlägt.
- Nötig: In der Anleitung ein Verweis „Wo sitzt das am Fahrzeug?" auf `/manual?teil=<id>`,
  ermittelt aus Titel und Teileliste der Anleitung.
- Ansatz: `findHotspotId()` mit Titel und Teileliste aufrufen — die Zuordnung liegt bereits
  in den Daten, der Screen fragt nur nach.

**Lücke 5: Nach getaner Arbeit passiert nichts**
- Heute: Wer den Ölwechsel abhakt, muss danach von Hand in den Wartungsplan und den Verlauf.
- Nötig: Ist der letzte Schritt erledigt, bietet die App an, die Arbeit einzutragen — passende
  Wartungsposition auf erledigt setzen (mit heutigem km-Stand) und einen Verlaufseintrag
  anlegen. Angeboten, nicht automatisch: Der Nutzer bestätigt, was gespeichert wird.
- Ansatz: `completeMaintenance()` und `addActivity()` gibt es im Store. Die Zuordnung
  Anleitung → Wartungsart gehört in `src/data/guides.ts` (ein Feld je Anleitung), nicht in
  den Screen.

### Rahmenbedingungen
- **Fahrzeugunabhängigkeit ist die oberste Regel.** `guidesFor()` filtert bereits; neue
  Anleitungen oder Felder brauchen einen Eintrag in `GUIDE_REQUIREMENTS`, wenn sie nicht für
  alle gelten. Nach jeder Änderung `npm run test:vehicles`.
- **Nie Zahlen erfinden.** Drehmomente, Füllmengen und Teilenummern bleiben Verweise aufs
  Herstellerhandbuch — auch in den KI-Prompts. Jede Kostenangabe ist eine offengelegte
  Rechnung mit `EstimateNote`.
- **Sicherheit vor Bastelfreude.** Bei Bremsen, Lenkung, Airbag, Reifen und Hochvolt bleibt
  der Rat zur Werkstatt sichtbar, egal was die KI antwortet.
- **Store-Regeln**: Listen-Selektoren mit `useShallow`, schreibende Aktionen im Store,
  Version erhöhen und Migration ergänzen, wenn sich die Form ändert.
- **Kein horizontales Scrollen**, entworfen bei 390 × 844 px, Touch-Ziele ab 44 px.
- Farben nur über Theme-Utilities (`text-ink-muted`, `bg-brand-blue/15`), niemals
  `text-[--color-ink]`. Bausteine aus `src/components/ui` verwenden.
- UI-Texte und Kommentare auf Deutsch (Du-Form), Bezeichner im Code auf Englisch.
- Der Erststart liegt bei 107 kB gzip (`npm run analyze` misst alle Startdateien).
  Keine neue Abhängigkeit dafür einführen.

### Arbeitsweise
1. Alle oben genannten Dateien VOLLSTÄNDIG lesen, bevor Du planst
2. Die fünf Lücken als voneinander unabhängige Änderungen planen
3. Eine Lücke nach der anderen umsetzen, jeweils mit Codeänderung und Prüfung:
   `node node_modules/typescript/bin/tsc -b` und `node node_modules/vite/bin/vite.js build`
   (`npm run build` macht beides, überschreitet hier aber gern das Zeitlimit)
4. Nach allen Lücken die vollständige Absicherung (siehe unten)
5. Ein Commit pro Lücke mit aussagekräftiger deutscher Nachricht. Mehrzeilige Nachrichten über
   eine Datei und `git commit -F` übergeben, die Datei mit dem Write-Tool schreiben —
   `Set-Content -Encoding utf8` setzt unter PowerShell 5.1 ein BOM in die Commit-Nachricht.

### Verifikation
```bash
npm run lint
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
npm run verify
npm run test:vehicles
grep -l WebGLRenderer dist/assets/*.js
```
Vor jedem Lauf mit Oberflächen-Tests die Vorschau-Ports freiräumen, sonst prüft der Test einen
fremden Stand:
```bash
for p in $(seq 4173 4185); do pid=$(netstat -ano | grep -E ":$p .*LISTENING" | awk '{print $5}' | head -1); [ -n "$pid" ] && taskkill //F //PID $pid; done
```
Screenshots unter `screenshots/` danach ansehen — Farb- und Formfehler bestehen jeden Test.

### Was Du NICHT tun darfst
- `calculateTax()` in `src/lib/costs.ts` NICHT verändern — § 9 KraftStG, 22 Fälle in `test:calc`
- `calculateCosts()`, `valuate()` und `compareVehicles()` NICHT umbauen
- Den 3D-Bauteil-Explorer samt Bauteil-Suche, Bauteilfoto und Kostenrahmen NICHT umbauen
  (`src/features/manual/*`, `src/lib/part*.ts`) — fertig, getestet, dient als Muster
- KEINE Drehmomente, Füllmengen, Teilenummern oder festen Preise hinterlegen
- KEINE neue Abhängigkeit für Fortschritt oder Zustand — der bestehende Store reicht
- KEIN automatisches Eintragen in Wartungsplan oder Verlauf ohne Bestätigung des Nutzers
- `base` in `vite.config.ts` und `start_url`/`scope` im Manifest NICHT ändern
- Den API-Schlüssel NICHT irgendwo außer im Settings-Store ablegen und NICHT exportieren
- KEIN Backend, kein Login, keine Datenbank — die App läuft bewusst ohne Server
```

**Speicherort:** `.planning/session-prompts/anleitungen-mit-ki-prompt.md`
