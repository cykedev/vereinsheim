---
id: treffsicher-meyton-import
type: subsystem
title: "treffsicher-meyton-import"
keywords: [Meyton-Import, Ergebnisimport, PDF-Import, URL-Import, Datenübernahme, import, DoS-Härtung, Einheit-Formular, pdf.js, unpdf, Identity-H, Textextraktion, Type0, Ghostscript]
tags: [subsystem]
subsystem_of: ["[[treffsicher]]"]
relates_to: ["[[training-sessions]]", "[[meyton-pdf-format-change]]"]
documented_in: ["[[treffsicher-requirements#Meyton-PDF Import (Training/Wettkampf)]]"]
---

**TL;DR** Meyton-Import im Einheit-Formular (URL/Datei), textbasiert, ersetzt Formular-Serien; Textextraktion via unpdf/pdf.js (deckt beide Meyton-Druckpfade ab); DoS-Härtung (10MB/15s URL, 20 Seiten, 50k Textitems, 200k Zeichen, 15s Parse-Zeit) — alle Grenzen greifen **während** des Parsens und brechen ab, statt still zu kürzen.

Die Extraktion liegt in `src/lib/sessions/meyton-import/`: `pdfText.ts` (pdf.js-Aufruf + Limits),
`textLayout.ts` (Zeilen-/Spaltenrekonstruktion), dazu die reinen Parser `series.ts`, `dateTime.ts`,
`hitLocation.ts`.

**Die Limits müssen im Stream greifen, nicht danach.** Gemessen an einer präparierten PDF: bei 2382 ms
Parsen feuerten weder `setTimeout(300)` noch `setInterval(1000)` — pdf.js blockiert den Event-Loop
vollständig, eine Zeitgrenze per Timer/`Promise.race` ist also wirkungslos und wird stattdessen im
Lese-Loop gegen `Date.now()` geprüft. Ebenso wird der Text über `page.streamTextContent()` gelesen
statt über `getTextContent()`: letzteres materialisiert die ganze Seite, bevor irgendein Cap greifen
kann (gemessen: 3,2-MB-PDF → 665 MB RSS). Beim Abbruch **kein** `reader.cancel()` — das löst mitten
im Stream nicht auf; `loadingTask.destroy()` beendet den Worker-Task sauber.

**Seitenbewusst.** y-Koordinaten sind seitenlokal und wiederholen sich im selben Report-Template auf
jeder Seite exakt. `PdfTextItem` trägt deshalb die Seitennummer, es wird nie über Seitengrenzen
gruppiert, und die Spaltenkante wird pro Seite zurückgesetzt.

**Fehler statt stiller Kürzung.** Gerissene Limits werfen `MeytonPdfError`; nur diese Meldungen reicht
die Server-Action an den Nutzer durch, pdf.js-Interna bleiben drin.

**`unpdf` ist exakt gepinnt** (kein `^`, abweichend von den anderen app-lokalen Deps): der Parser
verarbeitet untrusted Input, ein Minor-Bump soll nicht ohne sichtbaren Diff landen.

**Ein Codepfad für beide Formate.** pdf.js dekodiert sowohl Literal-Strings (altes
Ghostscript/Type1-PDF) als auch Type0/Identity-H-Hex-Glyph-IDs (neues Qt-PDF) — es gibt bewusst
**keine** Formatunterscheidung im Code (siehe [[meyton-pdf-format-change]]).

**Spaltenschnitt ist Pflicht, nicht Kosmetik.** Meyton druckt die Schussnummern der Scheiben-Grafik
auf **derselben Zeilenhöhe** wie die Schusswerte. `buildTextLinesFromItems` verwirft deshalb alles
links der x-Position der `Serie n:`-Beschriftung; ohne diesen Schnitt liest der Serien-Parser die
Grafik-Nummern als Schüsse ein — **stille Falschdaten statt eines Fehlers**.

**Fixtures:** `meyton-import/__fixtures__/` hält je ein echtes PDF pro Druckpfad; der
Integrationstest `meytonFixtures.test.ts` pinnt Serien, Datum und Trefferlage exakt.
