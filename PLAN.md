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
| **Teil im Foto finden** (Vision + Marker im eigenen Bild) | `/part-finder` | ✅ |
| **Gesamtkosten** (Wertverlust, Steuer, Sprit, Wartung) | `/costs` | ✅ |
| **Kostenvoranschlag** (Positionen, MwSt., Export) | `/quote` | ✅ |
| **Fahrzeug nachschlagen** (Gebrauchtwagen-Check ohne Anlegen) | `/lookup` | ✅ |
| **Erinnerungen** (Termine als Kalender-Datei) | `/reminders` | ✅ |

Fahrzeugunabhängigkeit ✅
- Teile, Reparaturen, Wartungsplan, Anleitungen und Handbuch richten sich nach dem
  konkreten Fahrzeug (Antriebsart, Fahrzeugart, Getriebe)
- Preise skalieren nach Marke, Fahrzeugart und Leistung — der Faktor ist im UI sichtbar
- Wartungsplan wandert mit, wenn der Nutzer die Antriebsart korrigiert
- Automatisch geprüft mit E-Auto, Motorrad und Diesel-Transporter (`npm run test:vehicles`)

Infrastruktur ✅
- PWA installierbar (Manifest, Service Worker, Icons aus dem Markenlogo)
- Automatischer Deploy nach GitHub Pages bei jedem Push auf `main`
- Smoke-Test über alle 21 Screens im iPhone-Format (`npm run test:smoke`)
- Erststart-Bundle 98 kB gzip; KI-SDK und Charts werden erst bei Bedarf geladen

## Phase 2 — Tiefe

Erledigt ✅

1. **Wartungsintervalle anpassbar** ✅ — Intervall in km und Monaten, letzte Erledigung
   und Notiz sind im Wartungs-Sheet editierbar. Eigene Positionen lassen sich anlegen
   und löschen; die Auswahl der Wartungsart bleibt fahrzeuggerecht (`kindsForVehicle`).
   Selbst angelegte und angepasste Positionen überleben einen Neuaufbau des Plans
   (`custom`/`edited` in `MaintenanceItem`, Store-Version 4).
2. **Rechnung fotografieren → Aktivität** ✅ — Rechnungen und Serviceheft-Einträge werden
   strukturiert ausgelesen (`SYSTEM_INVOICE`) und als Formular zur Prüfung angeboten.
   Nach Bestätigung entsteht ein Verlaufseintrag mit Betrag und Kilometerstand, passende
   Wartungspositionen werden auf Datum und km-Stand des Belegs gesetzt. Damit rechnet
   `/costs` mit echten Zahlen statt mit einer Schätzung.
3. **Fahrzeugschein fotografieren → Fahrzeug anlegen** ✅ — `SYSTEM_REGISTRATION` liest die
   genormten Felder (B, D.1–D.3, E, J, P.1–P.3, V.7) und füllt das Formular vor; unsicher
   gelesene Werte werden benannt und am Feld markiert. Hubraum und CO₂ sind jetzt
   eingebbar — ohne sie ließ sich die Kfz-Steuer gar nicht berechnen.

4. **Bauteil-Erkennung merken** ✅ — eine Erkennung lässt sich am Fahrzeug merken (Foto in
   IndexedDB, Marker im Store als `PartScan`, Store-Version 5). Gemerkte Aufnahmen stehen
   auf dem Startbildschirm des Teilefinders und öffnen sich ohne neue KI-Anfrage.

5. **Erinnerungen** ✅ — `/reminders` sammelt HU-Termin, zeitliche Wartungsintervalle und
   Ablaufdaten der Dokumente und exportiert sie als Kalender-Datei (.ics) mit Vorlauf-
   Erinnerung je Termin. Bewusst kein Web-Push: Das bräuchte einen Server, den es hier
   nicht gibt. Rein km-basierte Positionen bleiben außen vor — für sie gibt es kein Datum.

6. **VIN-Decoder** ✅ — `src/lib/vin.ts` löst die Fahrgestellnummer offline auf: Hersteller
   und Land aus den ersten drei Stellen (WMI), Modelljahr aus der zehnten. Das Formular
   zeigt das Ergebnis unter dem VIN-Feld an, die Marke lässt sich mit einem Tipp übernehmen,
   und Tippfehler (I, O, Q, falsche Länge) werden benannt. Das Werk (elfte Stelle) bleibt
   bewusst außen vor — dafür gibt es keine öffentliche Norm, jede Zuordnung wäre geraten.

Als Nächstes, nach Nutzen pro Aufwand:

7. **Fehlercode-Datenbank erweitern** — aktuell 18 genormte Codes; herstellerspezifische
   Codes ergänzen (die KI fängt sie bereits ab).
8. **Mehrere Fahrzeuge im Vergleich** — Kosten und Wert nebeneinander.

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
