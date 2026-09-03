import { chromium } from 'playwright'
const html = `<!doctype html><meta charset="utf-8"><style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;margin:0;padding:34px 40px;width:820px}
h1{font-size:20px;margin:0 0 2px} .klein{font-size:11px;color:#555}
table{width:100%;border-collapse:collapse;margin-top:18px;font-size:13px}
th{text-align:left;border-bottom:2px solid #333;padding:6px 4px;font-size:12px}
td{border-bottom:1px solid #ddd;padding:7px 4px} .r{text-align:right}
.summe{margin-top:14px;width:100%;font-size:13px} .summe td{border:0;padding:3px 4px}
.kopf{display:flex;justify-content:space-between;align-items:flex-start}
.stempel{border:2px solid #b00;color:#b00;padding:4px 10px;font-size:12px;font-weight:bold;transform:rotate(-4deg)}
</style>
<div class="kopf">
<div><h1>Musterwerkstatt GmbH</h1>
<div class="klein">Musterstraße 1 · 12345 Musterstadt · Tel. 01234 567890<br>USt-IdNr. DE000000000</div></div>
<div class="stempel">TESTBELEG – KEINE ECHTE RECHNUNG</div>
</div>
<h2 style="font-size:15px;margin:22px 0 4px">Rechnung Nr. 2026-0815</h2>
<div class="klein">Rechnungsdatum: 14.07.2026 &nbsp;·&nbsp; Fahrzeug: BMW 320d, Kilometerstand 91.240 km</div>
<table>
<tr><th style="width:44px">Pos</th><th>Bezeichnung</th><th class="r" style="width:90px">Betrag</th></tr>
<tr><td>1</td><td>Ölservice: Motoröl 5W-30 (5,5 l), Ölfilter, Dichtring erneuert</td><td class="r">168,50 €</td></tr>
<tr><td>2</td><td>Bremsbeläge Vorderachse erneuert, inkl. Reinigung der Führungen</td><td class="r">289,90 €</td></tr>
<tr><td>3</td><td>Innenraumfilter (Aktivkohle) gewechselt</td><td class="r">48,00 €</td></tr>
<tr><td>4</td><td>Bremsflüssigkeit gewechselt (DOT 4)</td><td class="r">89,00 €</td></tr>
<tr><td>5</td><td>Querlenker vorne links ersetzt, Achsvermessung durchgeführt</td><td class="r">412,00 €</td></tr>
<tr><td>6</td><td>Kleinteile, Reiniger, Altölentsorgung</td><td class="r">24,50 €</td></tr>
</table>
<table class="summe">
<tr><td class="r" style="width:80%">Zwischensumme netto</td><td class="r">1.031,90 €</td></tr>
<tr><td class="r">zzgl. 19 % MwSt.</td><td class="r">196,06 €</td></tr>
<tr><td class="r"><b>Rechnungsbetrag brutto</b></td><td class="r"><b>1.227,96 €</b></td></tr>
</table>
<div class="klein" style="margin-top:20px">Zahlbar sofort ohne Abzug. Für die ausgeführten Arbeiten gilt die gesetzliche Gewährleistung.</div>`
const b = await chromium.launch()
const p = await (await b.newContext({ deviceScaleFactor: 2 })).newPage()
await p.setContent(html)
await p.locator('body').screenshot({ path: 'screenshots/einrichtung/testbeleg.png' })
await b.close()
console.log('Testbeleg erzeugt')
