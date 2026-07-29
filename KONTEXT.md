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
- **3D-Handbuch** — es gibt keine frei lizenzierten 3D-Fahrzeugmodelle.
  Stattdessen: schematischer Bauteil-Explorer mit antippbaren Zonen und KI-Vertiefung.
- **Werkstattsuche** — Beispieldatensatz, keine echten Betriebe. Für eine echte Umkreissuche
  bräuchte es eine Karten-Schnittstelle (Google Places, Overpass).
- **Fahrzeugfotos** — statt fremder Pressefotos eine eigene SVG-Silhouette; der Nutzer kann
  ein eigenes Foto hinterlegen.

## Verweise

- Ursprüngliche Vision: `../MERAQ_AUTO_AI_MASTERKIT.zip` (MASTERPROMPT.md)
- Design-Vorlagen: die PNG-Mockups im übergeordneten Ordner
- Umsetzungsstand und nächste Schritte: [PLAN.md](PLAN.md)
- Arbeitsregeln für die Weiterentwicklung: [CLAUDE.md](CLAUDE.md)
