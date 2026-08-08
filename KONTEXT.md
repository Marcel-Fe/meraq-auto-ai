# KONTEXT — MERAQ AUTO AI

## Produkt

**MERAQ AUTO AI** — „Mehr Leben. Weniger Stress."

Eine Progressive Web App, die alles rund um das eigene Fahrzeug an einem Ort bündelt:
Fahrzeugdaten, Wartung, Diagnose, Handbuch, Anleitungen, Marktwert, Teile, Reparaturkosten,
Dokumente, Werkstattsuche — und einen KI-Assistenten, der das konkrete Fahrzeug des Nutzers kennt.

**USP:** Ein KI-Fahrzeugassistent mit persönlichem Fahrzeugzwilling. Die App weiß, welches
Fahrzeug der Nutzer fährt, und rechnet damit — statt allgemeine Ratschläge zu geben.

**Zielgruppe:** Privatnutzer zuerst. Werkstätten, Autohäuser, Gutachter und Flottenbetreiber
sind mögliche spätere Ausbaustufen.

## Architekturentscheidungen und ihr Grund

| Entscheidung | Grund |
|---|---|
| PWA statt native App | Läuft auf iPhone und Android ohne Store, kostenlos deploybar, ein Codestand |
| Kein Backend, kein Login | Keine Serverkosten, kein Datenschutzrisiko, für einen Einzelentwickler wartbar |
| Daten in localStorage + IndexedDB | Alles bleibt auf dem Gerät. Bilder in IndexedDB, weil localStorage bei ~5 MB endet |
| KI mit Schlüssel des Nutzers | Kein Proxy nötig, keine KI-Kosten für den Betreiber, Schlüssel verlässt das Gerät nicht |
| Zwei KI-Anbieter zur Wahl | Google ist kostenlos und macht den Einstieg möglich, Anthropic liefert die beste Qualität. Ein Schlüssel des Betreibers wäre im Browser auslesbar — deshalb bringt jeder seinen eigenen mit |
| HashRouter | GitHub Pages liefert bei Pfad-Routen 404 — Hash-Routen funktionieren immer |
| Tailwind v4 mit `@theme` | Design-Tokens direkt in CSS, keine separate Config-Datei |

## Design-System

Abgeleitet aus den Original-Mockups (`../ChatGPT Image 29. Juli 2026, *.png`).

```
Hintergrund   #05070D → #0B1020 (radialer Verlauf, fixiert)
Karten        rgba(255,255,255,.04) + 1px Rand + backdrop-blur   → Klasse .glass
Akzent        Türkis #2DD4BF → Blau #3B82F6 → Lila #8B5CF6       → Klasse .brand-gradient
Status        Erfolg #22C55E · Warnung #F59E0B · Gefahr #EF4444
Text          #F1F5F9 (ink) · #94A3B8 (ink-muted) · #64748B (ink-faint)
Typo          Inter, Zahlen tabellarisch (Klasse .tnum)
Radien        16px Kacheln · 20px Karten · 26px Sheets
```

Definiert in [src/styles/theme.css](src/styles/theme.css) unter `@theme`.
Nutzung im Markup über die generierten Utilities: `text-ink-muted`, `bg-brand-blue/15`,
`border-danger/30`. **Nicht** `text-[--color-ink]` — diese Syntax erzeugt in Tailwind v4
keine Farbe (stiller Fehler, das Element bleibt weiß).

## Fahrzeugunabhängigkeit — das zentrale Prinzip

Die App darf nichts anzeigen, was zum aktiven Fahrzeug nicht passt. Ein E-Auto bekommt
keinen Ölwechsel angeboten, ein Diesel keine Zündkerzen, ein Motorrad keine Scheibenwischer.

Umgesetzt über zwei Bausteine in [src/lib/vehicleProfile.ts](src/lib/vehicleProfile.ts):

**`vehicleTraits(vehicle)`** — die Ja/Nein-Eigenschaften eines Fahrzeugs
(`hasEngineOil`, `hasSparkPlugs`, `hasChainDrive`, `hasHighVoltageBattery` …).
Danach wird gefiltert: Teile, Reparaturpositionen, Wartungsplan, Anleitungen, Handbuch-Bauteile.

**`vehicleProfile(vehicle)`** — die Preisfaktoren.
Aus Marke (Einstiegs-, Volumen-, Premium-, Luxusmarke), Fahrzeugart und Leistung entstehen
`partsFactor` und `laborFactor`. Referenz mit Faktor 1,0 ist ein Kompaktwagen einer
Volumenmarke. Ein Lkw liegt bei etwa ×2,6 bei den Teilen, ein Motorrad bei ×0,72.
Die Faktoren werden im UI offen genannt, damit die Zahlen nachvollziehbar bleiben.

Daraus folgt für jede Erweiterung:
- Neue Teile und Reparaturen kommen als **Vorlage mit Basispreis** in `data/parts.ts`,
  nicht als fester Preis. Die Umrechnung macht `partsFor()` bzw. `repairJobsFor()`.
- Gilt etwas nur für bestimmte Fahrzeuge, bekommt es ein `requires: (t) => …`.
- **Keine Teilenummern.** Sie gelten immer nur für eine Baureihe und Motorvariante.
  Statt zu raten, ermittelt die App sie auf Wunsch per KI über die Fahrgestellnummer.
- Ändert der Nutzer Antriebsart, Fahrzeugart oder Getriebe, baut der Store den
  Wartungsplan neu auf und übernimmt die erledigten Stände (`mergeMaintenance`).

Geprüft wird das automatisch: `npm run test:vehicles` legt ein E-Auto, ein Motorrad und
einen Diesel-Transporter über die Oberfläche an und stellt sicher, dass jeder Screen
das Richtige zeigt und das Falsche weglässt.

## Datenmodell

Alle Typen in [src/types.ts](src/types.ts), Zustand in [src/store/useAppStore.ts](src/store/useAppStore.ts).

```
Vehicle          Fahrzeugstammdaten inkl. Zustand und Neupreis (Basis der Wertschätzung)
MaintenanceItem  Wartungsposition mit km- und Monatsintervall
ActivityEntry    Verlaufseintrag (Ölwechsel, Rechnung, km-Stand …)
DiagnosisEntry   erfasster Fehlercode inkl. KI-Erklärung
VehicleDocument  Dokument-Metadaten; die Datei liegt unter fileKey in IndexedDB
ChatThread       Unterhaltung mit dem Assistenten
```

Ein Nutzer kann mehrere Fahrzeuge anlegen; `activeVehicleId` bestimmt, worauf sich alle
Screens beziehen.

## Was echt ist und was Schätzung

Diese Unterscheidung ist ein Produktversprechen und muss in jeder Weiterentwicklung erhalten bleiben.

**Echt und exakt**
- Fahrzeugdaten, Kilometerstände, Dokumente, Verlauf — alles vom Nutzer gepflegt
- Wartungsfälligkeiten: berechnet aus km-Stand, Datum und Intervall
- KI-Antworten: echtes Claude-Modell mit dem Fahrzeugkontext des Nutzers

**Erklärte Schätzung** (im UI immer als solche gekennzeichnet)
- **Marktwert** — offengelegte Formel in [src/lib/valuation.ts](src/lib/valuation.ts).
  Der Screen zeigt jeden Faktor einzeln. Keine Marktdatenbank, weil DAT/Schwacke Verträge erfordern.
- **Teilepreise** — Erfahrungswerte aus dem deutschen Teilehandel, kein Live-Feed
- **Reparaturkosten** — Ersatzteilspanne + (Arbeitswert × Stundensatz), Stundensatz einstellbar

**Bewusst anders gelöst als im Masterprompt**
- **OBD-Diagnose** — ein Browser kann keinen Bluetooth-OBD-Dongle auslesen.
  Stattdessen: Fehlercode eintragen, App erklärt ihn (Datenbank + KI) und schätzt die Kosten.
- **3D-Handbuch** — es gibt keine frei lizenzierten 3D-Daten echter Baureihen, Hersteller-CAD
  ist geschützt. Stattdessen baut die App das Fahrzeug selbst aus einem Seitenprofil auf
  ([CarScene3D.tsx](src/features/manual/CarScene3D.tsx)): drehbar, mit verorteten Bauteilen,
  aber bewusst nur die **Bauart** (Pkw, Transporter, Motorrad) — das steht auch im UI. Ohne
  WebGL bleibt die schematische 2D-Ansicht der vollwertige Weg.
- **Bauteile jenseits der Liste** — fest hinterlegt sind gut zwei Dutzend Bauteile, gesucht
  wird nach allem. Was die App nicht kennt, erklärt die KI mit dem Fahrzeugkontext
  ([partExplain.ts](src/lib/partExplain.ts)); den Kostenrahmen rechnet die App daraus selbst
  ([partCost.ts](src/lib/partCost.ts)): Ersatzteilspanne der KI + Arbeitszeit × Stundensatz
  des Nutzers, die Rechnung steht offen daneben.
- **Werkstattsuche** — echte Betriebe aus OpenStreetMap über Overpass, auf Knopfdruck im
  gewählten Umkreis. Google Places wäre genauer, kostet aber Geld und bräuchte einen Server,
  der den Schlüssel versteckt. Der öffentliche Overpass-Dienst ist ein Gemeinschaftsangebot
  ohne Verfügbarkeitszusage — deshalb Wiederholversuch, gespeichertes Ergebnis und eine
  ehrliche Meldung bei Überlastung. Bewertungen und Stundensätze fehlen in OSM und werden
  deshalb bei echten Treffern nicht angezeigt.
- **Fahrzeugfotos** — Pressefotos der Hersteller sind urheberrechtlich geschützt und dürfen
  nicht angezeigt werden. Stattdessen sucht die App ein **frei lizenziertes Foto** der
  Modellreihe über Wikimedia Commons ([src/lib/vehicleImage.ts](src/lib/vehicleImage.ts)),
  speichert es verkleinert auf dem Gerät und nennt Urheber und Lizenz am Bild. Findet sie
  keins, bleibt die SVG-Silhouette. Ein eigenes Foto des Nutzers hat immer Vorrang, und in
  den Einstellungen lässt sich die Suche abschalten.

## Verweise

- Ursprüngliche Vision: `../MERAQ_AUTO_AI_MASTERKIT.zip` (MASTERPROMPT.md)
- Design-Vorlagen: die PNG-Mockups im übergeordneten Ordner
- Umsetzungsstand und nächste Schritte: [PLAN.md](PLAN.md)
- Arbeitsregeln für die Weiterentwicklung: [CLAUDE.md](CLAUDE.md)
