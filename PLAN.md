# PLAN — MERAQ AUTO AI

## Phase 1 — Fundament ✅ abgeschlossen

| Bereich | Route | Status |
|---|---|---|
| Onboarding (Splash + 4 Slides) | `/onboarding` | ✅ |
| Dashboard | `/` | ✅ |
| Mein Fahrzeug (Stammdaten, km pflegen, Foto) | `/vehicle` | ✅ |
| Fahrzeug anlegen / bearbeiten | `/vehicle/new`, `/vehicle/:id/edit` | ✅ |
| Diagnose (Fehlercode + KI-Erklärung) | `/diagnosis` | ✅ |
| Wartungsplan | `/maintenance` | ✅ |
| Bauteil-Explorer | `/manual` | ✅ |
| Anleitungen + Detail | `/guides`, `/guides/:id` | ✅ |
| Marktwert mit offengelegter Rechnung | `/value` | ✅ |
| Teile & Preise | `/parts` | ✅ |
| Reparaturkosten-Kalkulation | `/repair-costs` | ✅ |
| Dokumente (Foto/PDF + KI-Auslesen) | `/documents` | ✅ |
| Werkstattsuche | `/workshops` | ✅ |
| Mehr (Versicherung, Steuer, HU, Rückruf, Fahrtenbuch, Hilfe) | `/more` | ✅ |
| KI-Assistent (Streaming, Bilder, Verlauf) | `/assistant` | ✅ |
| Einstellungen (API-Schlüssel, Modell, Export) | `/settings` | ✅ |

Infrastruktur ✅
- PWA installierbar (Manifest, Service Worker, Icons aus dem Markenlogo)
- Automatischer Deploy nach GitHub Pages bei jedem Push auf `main`
- Smoke-Test über alle 17 Screens im iPhone-Format (`npm run test:smoke`)
- Erststart-Bundle 98 kB gzip; KI-SDK und Charts werden erst bei Bedarf geladen

## Phase 2 — Tiefe

Reihenfolge nach Nutzen pro Aufwand:

1. **Wartungsintervalle anpassbar** — eigene km-/Monatswerte je Position eintragen,
   statt nur die Standardwerte zu nutzen.
2. **Kostenauswertung** — Kosten pro Kategorie und pro 1.000 km, Jahresvergleich.
   Die Daten liegen bereits in `ActivityEntry.costEur`.
3. **Rechnung fotografieren → Aktivität** — die KI liest Betrag, Datum und Leistung aus
   und legt daraus einen Verlaufseintrag an. Baut auf dem bestehenden Dokument-Auslesen auf.
4. **Erinnerungen** — Web-Push oder Kalender-Export (.ics) für HU, Service und Ablaufdaten.
5. **VIN-Decoder** — aus der Fahrgestellnummer Marke, Baujahr und Werk ableiten,
   damit das Anlegen eines Fahrzeugs schneller geht.
6. **Fehlercode-Datenbank erweitern** — aktuell 18 genormte Codes; herstellerspezifische
   Codes ergänzen (die KI fängt sie bereits ab).
7. **Mehrere Fahrzeuge im Vergleich** — Kosten und Wert nebeneinander.

## Phase 3 — Ausbau

- **Echte Werkstattsuche** über eine Karten-Schnittstelle (Overpass ist kostenlos,
  Google Places genauer aber kostenpflichtig)
- **Echte Marktwerte** über einen Datenanbieter — erst sinnvoll, wenn die App Einnahmen hat
- **OBD-Anbindung** — braucht eine native Hülle (Capacitor) mit Bluetooth-Zugriff
- **Werkstattmodus** — mehrere Fahrzeuge, Kundenzuordnung, Auftragsverwaltung
- **Backend mit Konto** — nur wenn Synchronisierung über mehrere Geräte gewünscht ist.
  Bis dahin ersetzt der JSON-Export in den Einstellungen das Backup.
- **AR-Modus** — WebXR ist auf iOS stark eingeschränkt; realistisch erst mit nativer Hülle

## Bewusst nicht geplant

- Werbung oder Datenweitergabe — widerspricht dem Versprechen „Daten bleiben auf dem Gerät"
- Finanzamtstaugliches Fahrtenbuch — hohe formale Anforderungen, hohes Haftungsrisiko
- Verbindliche Fahrzeugbewertung — dafür braucht es einen zertifizierten Gutachter
