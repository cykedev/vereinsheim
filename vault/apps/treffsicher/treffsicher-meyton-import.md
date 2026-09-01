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

**TL;DR** Meyton-Import im Einheit-Formular (URL/Datei), textbasiert, ersetzt Formular-Serien; Textextraktion via unpdf/pdf.js (deckt beide Meyton-Druckpfade ab); DoS-Härtung (10MB/15s URL, 20 Seiten, 200k Zeichen, 15s Parse-Timeout).

Die Extraktion liegt in `src/lib/sessions/meyton-import/`: `pdfText.ts` (pdf.js-Aufruf + Limits),
`textLayout.ts` (Zeilen-/Spaltenrekonstruktion), dazu die reinen Parser `series.ts`, `dateTime.ts`,
`hitLocation.ts`.

**Ein Codepfad für beide Formate.** pdf.js dekodiert sowohl Literal-Strings (altes
Ghostscript/Type1-PDF) als auch Type0/Identity-H-Hex-Glyph-IDs (neues Qt-PDF) — es gibt bewusst
**keine** Formatunterscheidung im Code (siehe [[meyton-pdf-format-change]]).

**Spaltenschnitt ist Pflicht, nicht Kosmetik.** Meyton druckt die Schussnummern der Scheiben-Grafik
auf **derselben Zeilenhöhe** wie die Schusswerte. `buildTextLinesFromItems` verwirft deshalb alles
links der x-Position der `Serie n:`-Beschriftung; ohne diesen Schnitt liest der Serien-Parser die
Grafik-Nummern als Schüsse ein — **stille Falschdaten statt eines Fehlers**.

**Fixtures:** `meyton-import/__fixtures__/` hält je ein echtes PDF pro Druckpfad; der
Integrationstest `meytonFixtures.test.ts` pinnt Serien, Datum und Trefferlage exakt.
