# PDF-Kopf (mit QR-Code und URL) auf jeder Seite

**Datum:** 2026-10-03 · **Branch:** `feat/pdf-header-every-page` · **App:** ringwerk

## 1. Context (warum)

Der Seitenkopf mit Titel, Disziplin, Erstelldatum und (bei veröffentlichten Wettbewerben) QR-Code
und URL steht heute nur auf Seite 1. Im Vereinsheim werden nicht immer alle Seiten aufgehängt.
Eine Folgeseite allein hat dann weder Titel noch QR-Code. Wunsch des Users (2026-10-03): **der
ganze Kopf auf jeder Seite**.

## 2. Entscheidungen

**E1: react-pdf `fixed` am Kopf-View.** Ein `fixed`-Element im normalen Fluss wiederholt
react-pdf auf jeder Seite, und es macht ihm dort Platz. Der Prototyp vom 2026-10-03 (90 Zeilen
über 3 Seiten) zeigt Seite 2: Kopf oben, Zeile 45 beginnt darunter, nichts überlappt. Die
Fußzeile nutzt `fixed` schon so. Kein eigener Kopf-Mechanismus.

**E2: Alle fünf Haupt-PDFs.** Spielplan, Best-of-Spielplan, Playoffs (Bracket- **und**
Detailseiten), Rangliste (Event) und Saison-Tabelle. Damit wiederholt sich der Kopf auch in den
öffentlich ausgelieferten PDFs. Dort erscheint er ohne QR-Code, weil die öffentlichen Builder
kein `publicLink` übergeben. Starter- und Teilnehmerliste bleiben unverändert, es sind keine
Aushänge.

**E3: Playoff-Detailseiten bekommen den QR-Code.** Bisher hatte nur die Bracket-Seite einen.
Bracket-Seite: weiter kompakt (48 pt, sonst rutscht das Achtelfinal-Bracket weg, siehe
`PlayoffsPdf.test.tsx`). Detailseiten im Hochformat: Standard (64 pt).

**E4: Folgen bewusst in Kauf genommen.** Auf Folgeseiten steht weniger Inhalt, ein langes PDF
kann also eine Seite mehr bekommen. Abschnitte mit `break` (Spielplan, Best-of) beginnen weiter
auf neuer Seite, jetzt unter dem Kopf.

## 3. Dateien

| Datei | Änderung |
| --- | --- |
| `apps/ringwerk/src/lib/pdf/SchedulePdf.tsx` | `fixed` am Kopf-View (`PdfHeader`) |
| `apps/ringwerk/src/lib/pdf/BestOfSchedulePdf.tsx` | `fixed` am Kopf-View (`PdfHeader`) |
| `apps/ringwerk/src/lib/pdf/PlayoffsPdf.tsx` | `fixed` am Kopf-View; Detailseite erhält `publicLink` |
| `apps/ringwerk/src/lib/pdf/EventRankingPdf.tsx` | `fixed` am inline Kopf-View |
| `apps/ringwerk/src/lib/pdf/SeasonStandingsPdf.tsx` | `fixed` am inline Kopf-View |
| `apps/ringwerk/src/lib/pdf/SchedulePdf.test.tsx`, `BestOfSchedulePdf.test.tsx`, `PlayoffsPdf.test.tsx` | Kopf je Seite |
| `vault/apps/ringwerk/pdf-public-urls.md` | Layout-Abschnitt |

## Required Docs

- `vault/apps/ringwerk/ringwerk-code-conventions.md` → „PDF-Layout“ (Worst Case rendern, Seitenzahl
  per Test)
- `vault/apps/ringwerk/pdf-public-urls.md` (QR-Code nur interne Exporte)

## 4. Tasks

### Task 1: Kopf auf jeder Seite (Test zuerst)

Tests. Ein gemeinsamer Zähler `pageCount(buffer)` (Regex `/\/Type\s*\/Page(?!s)/g`, wie in
`PlayoffsPdf.test.tsx`) zählt die Seiten, `extractPdfText` liefert den Text.

- `SchedulePdf.test.tsx`: 60 Hinrunden-Paarungen (Teilnehmer `p0 … p11`, rotierend gebildet, Status
  `PENDING`) mit `publicLink` → mindestens 2 Seiten. Die Anzahl von „Erstellt:“ im Text ist gleich
  der Seitenzahl. Die Anzahl von „api/public/c/liga-2026/pdf“ ist gleich der Seitenzahl.
- `BestOfSchedulePdf.test.tsx`: dasselbe mit 60 Best-of-Paarungen.
- `PlayoffsPdf.test.tsx`: das 16er-Bracket mit `publicLink` → „Erstellt:“ und die URL je Seite.
  Damit sind auch die Detailseiten abgedeckt, die heute keinen QR-Code haben.

Vor der Änderung beobachtet: rot (je Seite nur auf Seite 1).

Implementierung: In allen fünf Dateien bekommt der Kopf-View `<View style={styles.headerBlock}>`
das Prop `fixed`. In `PlayoffsPdf.tsx` bekommt der `PdfHeader` der Detailseite
`publicLink={publicLink}` (Standardgröße). Den Kommentar „Nur der PdfHeader der Bracket-Seite …“
entfernen bzw. anpassen, falls vorhanden.

Event und Saison haben keine Test-Fixtures mit Mehrseitigkeit, und die Typen sind aufwendig
nachzubauen. Sie bekommen dieselbe einzeilige Änderung und werden in der Validierung an echten
Daten belegt (Prod-Kopie: Saisons und Event mit Serien).

Commit: `feat(ringwerk): repeat the PDF header with QR code on every page`.

### Task 2: Doku

`vault/apps/ringwerk/pdf-public-urls.md`, Abschnitt „QR-Code auf internen Exporten“: „rechts im
Seitenkopf (Seite 1)“ ersetzen durch „rechts im Seitenkopf, der sich auf **jeder** Seite
wiederholt (`fixed`)“. Ergänzen, dass die Playoff-Detailseiten den Code seit 2026-10-03 auch
tragen. Danach `node .claude/vault-lint.mjs`.

Commit: `docs(vault): note the repeated PDF header`.

## 5. Verification

1. `pnpm check` grün (Dev-Server vorher stoppen, `.next` räumen).
2. Prod-Kopie, Dev-Server, der User ist angemeldet. Interne Exporte über den Browser holen
   (localhost-Empfänger, siehe Memory `browser-pane-file-transfer`) für Spielplan einer
   1-gegen-1-Liga, Jahrespreis-Saison (Saison-Tabelle) und Werner-Sommer-Event (Rangliste). Je
   Seite rendern (`pdftoppm`) und den QR-Code dekodieren: auf **jeder** Seite derselbe Link.
   Sichtprüfung einer Folgeseite: Kopf oben, Inhalt darunter, nichts überlappt.
3. Öffentliches PDF einer Liga: Kopf auf jeder Seite, **kein** QR-Code auf irgendeiner Seite.
4. Mehrseitige Fälle, die die Daten nicht hergeben, als „nicht belegt“ mit dem abdeckenden Test
   vermerken.
