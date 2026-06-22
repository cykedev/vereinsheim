# Design: Teilnehmerliste als PDF (Bürodienst)

**Datum:** 2026-05-07  
**Status:** Approved

## Ziel

Aktive Vereinsmitglieder als druckbares PDF exportieren, das der Bürodienst bei Events vor Ort verwenden kann. Die Liste enthält leere Felder zum manuellen Ausfüllen (Disziplin, Einlage) und Kästchen zum Abhaken (Teilnahme, Hat geschossen). Am Ende stehen 10 Leerzeilen für Spontanstarter.

## Neue Dateien

| Datei                                   | Zweck                            |
| --------------------------------------- | -------------------------------- |
| `src/lib/pdf/ParticipantListPdf.tsx`    | react-pdf Dokument               |
| `src/app/api/participants/pdf/route.ts` | API-Route, rendert PDF zu Buffer |

## Geänderte Dateien

| Datei                                 | Änderung                                                        |
| ------------------------------------- | --------------------------------------------------------------- |
| `src/app/(app)/participants/page.tsx` | `PdfDownloadButton` mit href `/api/participants/pdf` hinzufügen |

## Datenbasis

Bestehende Query `getParticipants()` aus `@/lib/participants/queries` — liefert aktive, nicht-Gast-Teilnehmer alphabetisch nach Nachname/Vorname sortiert. Keine neue Query nötig.

## PDF-Layout

**Format:** A4 Portrait, 40pt Ränder (515pt nutzbare Breite), identische Styles wie bestehende PDFs (`src/lib/pdf/styles.ts`).

### Header

Identisch zum bestehenden `PdfHeader`-Pattern:

- Links: Titel "Teilnehmerliste" (groß) + Subtitle "Aktive Vereinsmitglieder"
- Rechts: "Erstellt: DD.MM.YYYY"

### Tabelle

| Spalte         | Breite | Inhalt                                         |
| -------------- | ------ | ---------------------------------------------- |
| Name           | 200pt  | "Nachname, Vorname" (vorgedruckt, linksbündig) |
| Disziplin      | 115pt  | leer (manuell vom Bürodienst auszufüllen)      |
| Einlage        | 60pt   | leer (manuell auszufüllen)                     |
| Teilnahme      | 70pt   | leeres Kästchen □ (zentriert)                  |
| Hat geschossen | 70pt   | leeres Kästchen □ (zentriert)                  |

Summe: 515pt = A4 portrait mit 40pt Rändern.

**Zeilen:**

- Alternierende Zeilen-Farben (weiß / `#f5f5f5`) wie in bestehenden PDFs
- Zeilenhöhe min. 22pt (genug Platz zum Schreiben), `paddingVertical: 6`
- `wrap={false}` auf jeder Zeile → kein Abschneiden an Seitenumbrüchen

**Leerzeilen (Spontanstarter):**

- 10 Stück am Ende der Tabelle
- Gleiche Struktur wie normale Zeilen, aber Namensspalte leer
- Hintergrund: helles Grau (`#fafafa`) für alle 10 Zeilen (kein Alternieren), um sie visuell von den echten Einträgen zu trennen

**Kästchen-Darstellung:**

- Leeres `<View>` mit `borderWidth: 1, borderColor: '#aaaaaa', width: 14, height: 14, borderRadius: 2` zentriert in der Zelle

### Footer

Fix (gleiche Styles wie bestehende PDFs):

- Links: "Teilnehmerliste"
- Rechts: "Seite X / Y"

## API-Route

`GET /api/participants/pdf`

- Auth-Check: eingeloggt (kein spezifisches Role-Check nötig, da Route für alle angemeldeten User)
- Rendert `ParticipantListPdf` via `renderToBuffer`
- Content-Disposition: `attachment; filename="teilnehmerliste.pdf"`

## Download-Button

`PdfDownloadButton` mit `href="/api/participants/pdf"` im Header der Teilnehmerseite, neben dem "Neuer Teilnehmer"-Button. Label: "Teilnehmerliste drucken".
