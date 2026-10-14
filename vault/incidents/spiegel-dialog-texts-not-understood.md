---
id: spiegel-dialog-texts-not-understood
type: incident
title: "Spiegel: Dialoge in der Sprache des Codes, für den Admin unverständlich"
keywords: [verständlichkeit, dialog, decisiondialog, folgen, alltagssprache, fachbegriffe, meldungen aufheben, nicht meine, wieder zulassen, admin, texte, textbuch, schreibregeln, consequences]
tags: [incident, spiegel, ux]
relates_to: ["[[conventions]]", "[[spiegel-privacy]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 14. Oktober 2026: Der Dialog „Meldungen ‚nicht meine‘ … aufheben?“ (P2d) war fachlich richtig und hatte alle
Abschnitte der Regel „Kein Knopf ohne Folge“, der User verstand ihn trotzdem nicht („diesen dialog hier verstehe ich
überhaupt nicht“, „wir müssen dringend an der verständlichkeit arbeiten“). Die Regel sichert, **dass** Folgen genannt
werden, nicht, **dass** man sie versteht.

## Was ihn unverständlich machte

- Er setzte Vorwissen voraus: Dass „Nicht meine“ die Scheiben gelöscht und gesperrt hat, stand nirgends.
- Interne Begriffe: „Meldung“, „die Brücke darf wieder schicken“, „holt nach“, „Offen“ ohne Ort.
- Mehrere Bedingungen in einem Satz („…, soweit Meyton sie noch hat, wenn gerade niemand schießt“), Semikolons.
- Der Knopf nannte den technischen Vorgang („Meldungen aufheben“) statt des Ziels („Wieder zulassen“).

## Regel (Vorschlag, mit dem User abzustimmen)

Erst sagen, was vorher geschah, dann die Frage. Ein Gedanke je Satz. Die Wörter des Users statt der des Codes.
Bereiche der App mit Ort („in der App unter ‚Offen‘“). Konkret: wer merkt was, wann. Der Knopf sagt, was man will.
Wortlaut-Tests in `consequences.test.ts` halten nur fest, was einmal geschrieben wurde; ob es verständlich ist, prüft nur
ein Mensch. Deshalb Texte vor dem Umsetzen dem User zum Lesen vorlegen (Textbuch: alt → neu).
