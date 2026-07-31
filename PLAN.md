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
| **Fahrzeuge vergleichen** (2–3 Fahrzeuge nebeneinander) | `/compare` | ✅ |

Fahrzeugunabhängigkeit ✅
- Teile, Reparaturen, Wartungsplan, Anleitungen und Handbuch richten sich nach dem
  konkreten Fahrzeug (Antriebsart, Fahrzeugart, Getriebe)
- Preise skalieren nach Marke, Fahrzeugart und Leistung — der Faktor ist im UI sichtbar
- Wartungsplan wandert mit, wenn der Nutzer die Antriebsart korrigiert
- Automatisch geprüft mit E-Auto, Motorrad und Diesel-Transporter (`npm run test:vehicles`)

Infrastruktur ✅
- PWA installierbar (Manifest, Service Worker, Icons aus dem Markenlogo)
- Automatischer Deploy nach GitHub Pages bei jedem Push auf `main`
- Smoke-Test über alle 23 Screens im iPhone-Format (`npm run test:smoke`)
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

7. **Fehlercode-Datenbank erweitern** ✅ — 62 genormte Codes statt 18, dazu Hochvolt-,
   Getriebe- und Bordnetz-Codes. Jeder Code hat ein optionales `requires`, deshalb sieht
   ein E-Auto nur die 21 Codes, die es bei ihm geben kann. Herstellerspezifische Codes
   (P1xxx) kommen bewusst NICHT in die Liste — sie bedeuten je Hersteller etwas anderes;
   eingetippt werden sie weiterhin von der KI mit Fahrzeugkontext erklärt.

8. **Echtes Fahrzeugbild** ✅ (auf Wunsch vorgezogen) — die App sucht zum angelegten
   Fahrzeug ein frei lizenziertes Foto der Modellreihe (Wikimedia Commons), speichert es
   verkleinert auf dem Gerät und zeigt es auf Startseite, Fahrzeug-, Teile- und
   Nachschlagen-Screen mit Urheber und Lizenz. Abschaltbar in den Einstellungen.
   Der Treffer wird auf Plausibilität geprüft — lieber kein Bild als ein falsches.

9. **Mehrere Fahrzeuge im Vergleich** ✅ — `/compare` stellt zwei bis drei Fahrzeuge
   nebeneinander: Kosten pro Monat und km, Wertverlust, Kraftstoff bzw. Strom, Wartung,
   Versicherung, Kfz-Steuer und Marktwert. Gerechnet wird mit den bestehenden Bausteinen
   (`calculateCosts`, `valuate`) je Fahrzeug, zusammengestellt in `src/lib/compare.ts`.
   Das jeweils günstigere Fahrzeug wird pro Zeile hervorgehoben – außer wo der Vergleich
   nicht ehrlich wäre: Fehlt der Hubraum, bleibt die Steuer „—" statt 0 €, und wo ein
   Fahrzeug mit erfassten Belegen gegen ein geschätztes antritt, entfällt die Wertung.

10. **KI kostenlos nutzbar** ✅ — die App spricht wahlweise mit Google Gemini oder
    Anthropic Claude. Ein Schlüssel aus Google AI Studio ist gratis und ohne Kreditkarte
    zu bekommen; damit ist der Assistent für jeden nutzbar, ohne dass der Betreiber zahlt.
    Ein Schlüssel des Betreibers käme nicht in Frage — er wäre im Browser auslesbar.
    Beide Anbieter liegen hinter `askAi()` / `askAiStructured()`, kein Feature-Screen
    kennt den Unterschied. Google-Modelle werden beim Prüfen des Schlüssels abgefragt
    statt fest hinterlegt. Der Datenschutz-Unterschied (Google wertet Eingaben im
    kostenlosen Kontingent aus) steht offen in den Einstellungen.
    Geprüft mit `npm run test:ai` über abgefangene Antworten — ohne Guthabenverbrauch.

11. **Echte Werkstattsuche** ✅ — `/workshops` sucht auf Knopfdruck echte Betriebe im
    Umkreis (5/10/25 km) über OpenStreetMap. Gesucht wird passend zum Fahrzeug: ein
    Motorrad bekommt Motorradwerkstätten, ein Transporter auch Nutzfahrzeug-Betriebe.
    Bewertungen und Stundensätze zeigt die App bei echten Treffern **nicht** — die
    stehen nicht in den Daten und wären erfunden. ODbL-Namensnennung ist eingebaut.
    Der öffentliche Overpass-Dienst weist etwa jede dritte Anfrage ab, deshalb: eine
    einzige optimierte Abfrage (statt drei getrennter – das war der Unterschied
    zwischen 1,6 s und Timeout), ein stiller Wiederholversuch und das letzte Ergebnis
    bleibt gespeichert. Live gemessen: 3,6 s für 57 Betriebe. Store-Version 8.

## Phase 3 — Ausbau
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
