---
id: meyton-pdf-format-change
type: incident
title: "meyton-pdf-format-change"
keywords: [Meyton PDF Import kaputt, keine Serien gefunden, Formatwechsel, Identity-H, Type0, Hex-Glyph-IDs, Qt 5.12.8, Ghostscript Type1, ToUnicode, pdf.js, unpdf, selbstgeschriebener Parser, synthetische Fixtures, Fremdformat]
tags: [incident, treffsicher]
relates_to: ["[[treffsicher-meyton-import]]", "[[treffsicher-testing-conventions]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 2026-09-01 (treffsicher): Meyton hat den Druckpfad gewechselt (Ghostscript/Type1 →
Qt 5.12.8/Type0-Identity-H). Der selbstgeschriebene PDF-Extractor kannte nur Literal-Strings und
lieferte für die neuen PDFs **0 Zeichen** → Import brach mit „Keine Meyton-Serien im PDF gefunden."
ab. Ersetzt durch unpdf/pdf.js, das beide Formate über **einen** Codepfad liest.

## Was passiert war

Die neuen PDFs zeichnen Text als **Hex-Glyph-IDs** (`<0001> Tj`, ein Glyph pro Operator) mit
subsetteten Type0/Identity-H-Fonts: 1274 `Tj`-Operatoren, davon 1274 hex, **0 Literal-Strings**.
Der Eigenbau-Extractor matchte nur `(...) Tj` und `[...] TJ` → leerer Text.

Die alten PDFs kamen von **GPL Ghostscript 9.55.0** mit Type1-Fonts. Es war also kein
Versionssprung innerhalb eines Generators, sondern ein **Wechsel der ganzen Toolchain** — ein
weiterer Wechsel ist jederzeit möglich.

Einen Hex-Zweig zu ergänzen hätte nicht gereicht: die Glyph-IDs sind pro Font-Subset verschieden
(dieselbe ID ist in drei Fonts drei verschiedene Zeichen) und nur über die **ToUnicode-CMap des
gerade aktiven Fonts** auflösbar; Positionen stecken in `Tm`/`Td` **plus** einem `q`/`Q`/`cm`-
Matrix-Stack. Das ist ein Mini-PDF-Interpreter.

## Lehren

**Bei Fremdformat-Importen gehören echte Beispieldateien als Fixture ins Repo.** Die bisherigen
Tests bauten ihre PDFs selbst (`deflateSync` + handgeschriebener Stream) und konnten einen
Formatwechsel der realen Quelle **strukturell nicht bemerken** — sie testeten exakt die Annahme,
die falsch geworden war.

**Fremdformat-Parsing nicht selbst bauen**, wenn es eine gepflegte Bibliothek gibt: der
Eigenbau-Parser deckte genau eine Ausprägung eines Formats ab und brach beim ersten Wechsel.

**Fehlermeldungen müssen Ursachen trennen.** „kein Text extrahierbar" und „Text da, aber keine
Serien" liefen in eine gemeinsame Meldung — das hat die Diagnose verschleiert. Inzwischen getrennt.

## Nebenbefund

`STOP_KEYWORDS` enthielt `"zaehler"`, die PDFs schreiben aber `Zähler:` — das Keyword traf nie, und
diese Zeile besteht ausschließlich aus Werten im gültigen Schussbereich (`18 16 6 0 0 …`). Bisher
rettete nur die Reihenfolge im Dokument vor elf Phantom-Schüssen. `"trefferkreis"` fehlte ebenfalls
(ein enger Trefferkreis druckt einen Wert im Schussbereich). Beides mit Regressionstests behoben.
