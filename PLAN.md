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
- Smoke-Test über alle 24 Screens im iPhone-Format (`npm run test:smoke`), die ganze Reihe
  in einem Lauf über `npm run verify`
- **Erststart 107 kB gzip.** Das ist die ehrliche Zahl: die `index`-Datei plus alles, was der
  Browser über `modulepreload` mitlädt (`npm run analyze` rechnet es zusammen). Die früher
  genannten 86 kB waren nur die `index`-Datei — daneben lag ein zweiter, ebenfalls
  vorgeladener Chunk mit React Router (23 kB gzip). Als der beim Commit zur Werkstattsuche in
  die `index`-Datei wanderte, sah das nach +22 kB aus; gemessen über alle Startdateien lag der
  Erststart vorher bei 109 kB und liegt heute bei 107 kB. Das frühere Budget von 98 kB hat es
  in dieser Rechnung nie gegeben.
- Zwei Drittel des Erststarts sind React und React Router (rund 70 kB gzip) — daran lässt sich
  ohne Framework-Wechsel nichts drehen. Eigener Code sind knapp 30 kB.
- Erst bei Bedarf geladen: 3D-Szene (145 kB), Charts (101 kB), KI-SDK (41 kB) und jeder
  Screen einzeln (5–7 kB).

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

12. **Kfz-Steuer nach Erstzulassung** ✅ — die App wandte die gestaffelten CO₂-Sätze auf
    jedes Fahrzeug an. Die gelten aber erst ab Erstzulassung 01.01.2021; davor ist der
    Satz linear (2,00 € je g/km), und der Freibetrag lag bei 95 (ab 2014), 110 (ab 2012)
    bzw. 120 g/km. Ein Golf GTI von 2018 wurde dadurch mit 321 € statt 250 € berechnet —
    71 € zu viel pro Jahr. Fahrzeuge mit Erstzulassung vor dem 01.07.2009 werden nach
    Schadstoffklasse besteuert; dort nennt die App jetzt einen Hinweis statt einer Zahl.
    Fehlt das Erstzulassungsdatum, dient das Baujahr als Näherung — sichtbar in der
    Erklärung. Belegt mit `npm run test:calc` (22 Fälle, von Hand nachgerechnet).

13. **3D-Bauteil-Explorer** ✅ — `/manual` zeigt das Fahrzeug räumlich: Karosserie aus einem
    Seitenprofil mit gerundeten Übergängen und ausgeschnittenen Radkästen, nach oben und zu den
    Enden verjüngt, mit eigener Glasfläche und Rädern samt Felge. Ein Motorrad hat keine
    Karosserie und besteht deshalb aus Baugruppen (Motor, Gabel, Lenker, Schwinge, Auspuff,
    Kette); seine Bauteil-Marker haben eigene Positionen (`pos3dBike`), weil sich die am Pkw
    gemessenen nicht umrechnen lassen. Ohne WebGL bleibt der 2D-Weg vollständig bedienbar.
    Three.js liegt allein im Lazy-Chunk (149 kB gzip). Geprüft mit `npm run test:3d`, das
    Pkw, Transporter und Motorrad in jeder Zone aufnimmt — Formfehler bestehen jeden Zahlentest.

14. **Bauteil-Suche mit KI-Erklärung** ✅ — die App kennt gut zwei Dutzend Bauteile fest, ein
    Fahrzeug hat ein paar tausend. Das Suchfeld im Handbuch findet die hinterlegten über alle
    Zonen; alles andere erklärt die KI mit dem Fahrzeugkontext: Funktion, Lage, Symptome,
    Selbstprüfung, Aufwand und Kostenrahmen. Die Kosten sind **gerechnet**, nicht geraten —
    die KI liefert nur die Ersatzteilspanne und die Arbeitszeit, den Stundensatz nimmt die App
    aus den Einstellungen und legt die Rechnung offen. Gibt es das Bauteil am Fahrzeug nicht
    (Ölfilter im E-Auto), sagt die App das, statt hilfreich zu wirken. Aus Diagnose und
    Teilesuche führt `/manual?teil=<id>` direkt zur Stelle im Modell; die Zuordnung von
    Fehlercode und Ersatzteil zum Bauteil steht in den Daten, nicht im Screen.
    Belegt mit `npm run test:part` (Rechnung und Zuordnung) und `npm run test:partsearch`
    (der ganze Weg mit abgefangener KI-Antwort).

15. **Bauteilfoto** ✅ — „wo sitzt es" beantwortet das Modell, „wie sieht es aus" nur ein
    echtes Bild. Zu jedem Bauteil sucht die App ein frei lizenziertes Foto auf Wikimedia
    Commons und zeigt es im Sheet mit Urheber und Lizenz. Gesucht wird mit einem eigenen
    Begriff je Bauteil (`imageQuery`, englisch — so heißen die Dateien dort), nicht mit dem
    deutschen Anzeigenamen. Die Auswahl wirft Zeichnungen, Patentskizzen, Logos und alles
    ohne freie Lizenz weg und gibt im Zweifel **nichts** zurück: Ein falsches Bauteilfoto
    wäre schlimmer als keines, der Nutzer sucht danach unter seiner Motorhaube. Treffer und
    Misserfolge landen verkleinert in IndexedDB — jedes Öffnen des Sheets liefe sonst ins
    Netz. Belegt mit `npm run test:partimage` (Auswahl und Lizenzen) und im UI-Test;
    `npm run check:partimages` fragt Commons wirklich und zeigt, dass jedes der
    19 Bauteile ein passendes Foto findet.

16. **Anleitungen als Reparatur-Assistent** ✅ — die elf Abläufe sahen für jedes Auto gleich aus
    und vergaßen beim Neuladen sogar den Fortschritt. Jetzt begleiten sie einen echten
    Nachmittag in der Garage: Die abgehakten Schritte liegen je Fahrzeug und Anleitung im
    Store (`guideProgress`, Store-Version 9), „Schritt 3 von 6" steht sichtbar darüber.
    Was bei genau diesem Fahrzeug anders ist, kommt strukturiert von der KI
    (`SYSTEM_GUIDE_ADAPT`, `guideAdapt.ts`) — jeder Hinweis steht an dem Schritt, zu dem er
    gehört, statt in einem Absatz darüber. „Selbst machen oder machen lassen" ist eine
    offengelegte Rechnung gegen die passende Werkstattposition (`jobId` je Anleitung,
    `guideCost.ts`): Verglichen wird nur, was sich unterscheidet — das Material zahlt man in
    beiden Fällen, gespart wird die Arbeitszeit. Die eigene Zeit bleibt eine Zeitangabe und
    wird nicht in Euro umgerechnet. Bei sicherheitsrelevanten Arbeiten steht über der
    Ersparnis, dass Geld hier nicht das Argument ist. Von acht der elf Anleitungen führt ein
    Weg nach `/manual?teil=<id>`; und ist der letzte Schritt erledigt, **bietet** die App an,
    die Arbeit in Wartungsplan und Verlauf einzutragen — mit sichtbarer Liste dessen, was
    gespeichert wird, und erst auf Bestätigung. Belegt mit `npm run test:guide` (Rechnung,
    Zuordnung, Bereinigung der KI-Antwort) und im Smoke-Test (Fortschritt übersteht das
    Neuladen, der Eintrag landet wirklich im Verlauf).

17. **Werkstattrechnung erklären** ✅ — der Beleg ist der Moment, in dem am meisten Geld
    fließt und am wenigsten verstanden wird. `/invoice` scannt ihn (Kamera oder Datei) und
    übersetzt ihn Zeile für Zeile: was gemacht wurde, warum man das macht, welches Bauteil
    gemeint ist — mit Foto aus Commons und Sprung nach `/manual?teil=<id>`. Dazu Fragen, die
    der Nutzer der Werkstatt stellen kann, und was daraus für die nächsten Monate folgt.
    **Den Preis bewertet nicht die KI**, sondern `invoiceCheck.ts`: übliche Spanne aus der
    Werkstattposition für genau dieses Fahrzeug plus dem eingestellten Stundensatz, mit
    offengelegter Rechnung. Die Spanne ist absichtlich großzügig, und auch „deutlich darüber"
    bleibt eine Frage an die Werkstatt, kein Urteil. Die KI darf keine Bauteil-Id und keine
    erfundene Werkstattposition liefern — beides prüft die App gegen ihre eigenen Daten.
    Übernommen in Verlauf und Wartungsplan wird erst auf Bestätigung, mit Datum und
    Kilometerstand **des Belegs**. Belegt mit `npm run test:invoice` (Rechnung, Bereinigung,
    Zuordnung) und `npm run test:invoicescan` (der ganze Weg mit abgefangener KI-Antwort).

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
