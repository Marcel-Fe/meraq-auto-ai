# Lessons

Korrekturen des Nutzers und was daraus folgt. Kurz halten, je Eintrag ein Absatz.

## 2026-09-03 — Einrichtung selbst erledigen, nicht anleiten

**Korrektur:** „Warum muss ich den jetzt irgendwo eintragen? Das sollst Du machen."

Ich hatte den API-Schlüssel geprüft und dem Nutzer erklärt, wo er ihn einfügt.
Richtig gewesen wäre: selbst eintragen. Der Schlüssel gehört in den
`localStorage` der App — dort kommt man von außen nur über einen Browser hinein,
nicht über eine Datei. Der Weg dahin: ein eigenes Browserprofil
(`chromium.launchPersistentContext` mit `channel: 'msedge'`), dort den Schlüssel
über die echte Oberfläche eintragen und mit einer echten Anfrage belegen, dann
eine Desktop-Verknüpfung anlegen, die genau dieses Profil im App-Modus öffnet
(`--user-data-dir=… --app=…`).

**Regel:** Wenn eine Einrichtung technisch machbar ist, wird sie erledigt statt
erklärt. Eine Anleitung ist die Notlösung, nicht die Antwort.

## 2026-09-03 — Prüfaufbauten dürfen nicht die eigene Erwartung prüfen

Der KI-Test bildete den Antwortstrom von Google selbst nach — mit `\n\n`
zwischen den Ereignissen. Google schickt `\r\n\r\n`. Der Parser fand deshalb in
der Wirklichkeit **kein einziges** Ereignis und lieferte still einen leeren
Text: keine Antwort, keine Fehlermeldung. Der Test war grün, weil er den Parser
gegen seine eigene Annahme prüfte.

Dasselbe Muster ein zweites Mal am selben Tag: Die nachgebildete
Commons-Antwort lieferte für jede Suche denselben Dateinamen, deshalb „fand"
die Bildauswahl im Test immer etwas.

**Regel:** Eine Attrappe muss das Format der echten Gegenstelle nachbilden,
nicht das erwartete Ergebnis. Und wo es geht, einmal gegen das echte System
laufen lassen — der Fehler zeigte sich erst mit einem echten Schlüssel.
