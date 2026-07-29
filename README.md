# MERAQ AUTO AI

**Mehr Leben. Weniger Stress.**

Dein Fahrzeug-Assistent als App fürs Handy — Wartung, Diagnose, Marktwert, Dokumente
und ein KI-Assistent, der Dein Fahrzeug kennt.

👉 **[marcel-fe.github.io/meraq-auto-ai](https://marcel-fe.github.io/meraq-auto-ai/)**

---

## Auf dem Handy installieren

1. Die Adresse oben im Handy-Browser öffnen.
2. **iPhone (Safari):** Teilen-Symbol → *Zum Home-Bildschirm*
   **Android (Chrome):** Menü ⋮ → *App installieren*
3. Fertig — die App startet ab jetzt im Vollbild wie eine normale App.

## KI-Assistent aktivieren

Der Assistent nutzt Deinen eigenen Anthropic-Schlüssel. Er wird **nur auf Deinem Gerät**
gespeichert und direkt an Anthropic geschickt — diese App hat keinen Server, der ihn sehen könnte.

1. Schlüssel erstellen: [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. In der App: **Einstellungen** → *API-Schlüssel* einfügen → **Speichern & prüfen**
3. Steht dort „Schlüssel funktioniert", ist der Assistent einsatzbereit.

Ohne Schlüssel funktioniert alles andere trotzdem — nur die KI-Antworten fehlen.

## Funktioniert mit jedem Fahrzeug

Auto, Motorrad, Transporter, Lkw, Bus oder Wohnmobil — Benziner, Diesel, Hybrid oder Elektro.
Die App passt sich an, statt für alle dasselbe zu zeigen:

- Ein **E-Auto** bekommt keinen Ölwechsel und keine Zündkerzen angeboten, dafür die
  Zustandsprüfung der Hochvoltbatterie.
- Ein **Motorrad** bekommt Kettenpflege und Ventilspiel statt Klimaservice und Scheibenwischer.
- Ein **Diesel** bekommt Glühkerzen, AGR-Ventil und Partikelfilter statt Zündkerzen.
- **Teile- und Reparaturpreise** werden auf Dein Fahrzeug umgerechnet — nach Marke
  (Dacia rechnet anders als Porsche), Fahrzeugart und Leistung. Der Faktor steht offen dabei.

Fahrzeug anlegen: **Fahrzeug → Weiteres Fahrzeug anlegen**. Marke, Modell, Baujahr,
Kilometerstand und Antrieb reichen — den Rest kannst Du später ergänzen.

## Was drin ist

| Bereich | Was es kann |
|---|---|
| **Dashboard** | Fahrzeug auf einen Blick, Marktwert-Verlauf, fällige Wartung, Verlauf |
| **Mein Fahrzeug** | Stammdaten, Kilometerstand pflegen, eigenes Foto, mehrere Fahrzeuge |
| **Diagnose** | Fehlercode eintragen → Ursachen, Dringlichkeit, Kostenschätzung, KI-Erklärung |
| **Wartung** | Ölwechsel, Inspektion, Bremsflüssigkeit … mit Fälligkeit aus km und Datum |
| **Handbuch** | Bauteile antippen → Funktion, typische Probleme, KI-Vertiefung |
| **Anleitungen** | 10 Schritt-für-Schritt-Anleitungen mit Werkzeug-, Material- und Sicherheitshinweisen |
| **Marktwert** | Schätzung mit vollständig offengelegter Rechnung, Verlauf, Verkaufswege |
| **Teile & Preise** | Original / OEM / Aftermarket / Gebraucht im Vergleich |
| **Reparaturkosten** | Ersatzteile + Arbeitszeit × Stundensatz, Stundensatz einstellbar |
| **Dokumente** | Fahrzeugschein, Rechnungen, HU-Bericht fotografieren; KI liest sie aus |
| **Werkstatt** | Liste mit Entfernung über Deinen Standort |
| **KI-Assistent** | Chat mit Fahrzeugkontext, Fotos analysieren, Antworten in Echtzeit |

## Ehrlich gesagt

Manches lässt sich im Browser nicht echt umsetzen — das ist in der App überall gekennzeichnet:

- **Kein OBD-Auslesen.** Ein Browser kommt nicht an den Bluetooth-Stecker im Auto.
  Du trägst den Code ein, die App erklärt ihn.
- **Kein echtes 3D-Modell.** Es gibt keine frei nutzbaren Herstellerdaten.
  Stattdessen ein schematischer Bauteil-Explorer.
- **Marktwert und Preise sind Schätzungen.** Echte Bewertungsdaten (DAT, Schwacke) kosten
  Anbieterverträge. Die App zeigt Dir stattdessen jede Rechnung offen — nutze die Zahlen
  als Orientierung, nicht als Verhandlungsgrundlage.
- **Die Werkstätten sind Beispieldaten**, keine echten Betriebe.

## Deine Daten

Alles bleibt in Deinem Browser (localStorage und IndexedDB). Kein Konto, kein Server,
keine Übertragung — außer Deinen Fragen an die KI, die direkt an Anthropic gehen.

Löschst Du die Browserdaten, sind die Fahrzeugdaten weg. Unter **Einstellungen → Daten
exportieren** bekommst Du eine JSON-Sicherung (ohne API-Schlüssel).

## Für Entwickler

```bash
npm install
npm run dev          # Entwicklungsserver
npm run build        # TypeScript prüfen + Produktions-Build
npm run preview      # gebaute App lokal testen
npm run test:smoke   # alle Screens im iPhone-Format prüfen + Screenshots
npm run icons        # PWA-Icons aus dem Markenlogo neu erzeugen
```

Arbeitsregeln stehen in [CLAUDE.md](CLAUDE.md), Hintergrund in [KONTEXT.md](KONTEXT.md),
Roadmap in [PLAN.md](PLAN.md).

Deploy passiert automatisch bei jedem Push auf `main`.
