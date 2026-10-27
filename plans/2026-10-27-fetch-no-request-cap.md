# Holen mit Ausdruck ohne Grenze der Aufträge

## Context

„Scheibe holen“ (`/scan`) legt mit jedem Weg eine Scheibe vom Ausdruck an und dazu einen Auftrag an die Anlage
(`CardRequest`), damit die Brücke später die Rohdaten liefert. `fetchCard`
(`apps/spiegel/src/lib/fetch-card/queries.ts`) verweigert das ab `MAX_OPEN_REQUESTS = 10` ungefüllten offenen
Aufträgen je Konto (`tooMany`), und dann entsteht auch keine Scheibe. Der User hat viele alte eigene Ausdrucke einzeln
hochgeladen und wurde blockiert: „das darf auch nicht beim import blockieren“.

Fest (Auftrag der koordinierenden Session):

- Mit Ausdruck (QR, Link, Upload) entsteht die Scheibe immer, samt Werten. Kein `tooMany` auf diesem Weg.
- Die Daten der Anlage sollen trotzdem kommen (Maximum an Daten). Die Grenze schützt die Brücke vor zu vielen
  Aufträgen auf einmal; diesen Zweck behalten.
- Nur ID und Tag ohne Ausdruck: Die Grenze darf bleiben, die Meldung auch.

### Was die Grenze heute tatsächlich schützt

- Der Vertrag nimmt bis 1.000 Aufträge im Zustand (`packages/ingest-contract/src/v1/api.ts`, `requests … .max(1_000)`),
  `bridgeState` schickt bis `MAX_CARD_REQUESTS = 1_000` (`apps/spiegel/src/lib/ingest/bridges.ts`). Die Zehn steckt
  nur beim Anlegen in `fetchCard`.
- Die Brücke liest jede ScheibenID eines Auftrags sofort, auf Rang 1 vor dem Budget des Leerlaufs, auch während
  geschossen wird (`SetRequested` in `apps/spiegel-bridge/internal/watch/watch.go`: „Es ist je Auftrag eine Scheibe,
  und jemand wartet darauf“). Ein neuer Auftrag löst `Resend` aus. 300 Aufträge auf einmal wären 300 ungebremste
  Lesungen der SSMDB2 in einer Runde. **Das** ist die Last, vor der die Zehn schützt, und sie entsteht erst durch den
  Zustand, nicht durch das Anlegen.
- Die Brücke holt den Zustand jede Minute (`StateEvery`), der Heartbeat meldet jede Minute (`HeartbeatEvery`), was
  nicht in der Ablage, an einem anderen Tag oder gehalten ist (`recordRequestOutcomes`); was sie schickt, füllt das
  Einlesen. Ein Auftrag im Zustand endet also meist nach ein bis zwei Minuten (gefüllt oder geschlossen), solange die
  Brücke läuft.

### Abwägung

- **(a) Über der Grenze kein Auftrag**, die Scheibe steht wie nach „zurückgezogen“ („ohne Werte“), „Von der Anlage“
  bietet das Holen später an. Kein Schema. Aber die Daten der Anlage kommen nur, wenn der Schütze jede Scheibe einzeln
  nachholt, und das scheitert wieder an der Grenze. Widerspricht „Maximum an Daten“.
- **(b) Aufträge über der Grenze warten**, die Brücke bekommt je Konto nur die ältesten zehn ungefüllten. Rückt einer
  auf (gefüllt, nicht gefunden, anderer Tag, gehalten, zurückgezogen, abgelaufen), kommt beim nächsten Zustand der
  nächste dran. **Das braucht weder Schema noch neuen Zustand noch neue Texte:** Die Reihenfolge ist die Kennung
  (`orderBy: { id: "asc" }`, wie heute), und „wartet auf die Anlage“ / „Spiegel holt die Werte, sobald die Anlage läuft“
  stimmen für einen wartenden Auftrag genauso. Die Brücke sieht je Konto nie mehr, als die alte Grenze zuließ.
- **Empfehlung: (b) ohne Schema.** Die Grenze wandert vom Anlegen in den Zustand der Brücke (`openRequestsOf`), dorthin,
  wo die Last entsteht. Je Konto, damit 70 alte Ausdrucke eines Schützen die Aufträge der anderen nicht verdrängen.

### (c) Was sonst auffiel

- Die Brücke verträgt mehr als zehn Aufträge (Vertrag 1.000, Heartbeat meldet bis `MaxRequestsDone = 100`); die
  Grenze ist eine Frage der Last der SSMDB2 in einer Runde, nicht des Formats. Keine neue Brücke, kein neuer Vertrag.
- Durchsatz: zehn je Konto und Minute, grob. 70 alte Ausdrucke sind bei laufender Brücke nach etwa 10–20 Minuten
  durch; alte Scheiben, die die Ablage nicht mehr hat, enden mit „nicht gefunden“.
- Die Frist von 30 Tagen zählt ab `createdAt`, auch für einen wartenden Auftrag. Läuft die Brücke, rückt die Schlange
  in Minuten nach, die Frist greift praktisch nur bei ausgeschalteter Brücke, und dann stimmt „Die Anlage hat sich 30
  Tage nicht gemeldet“. Randfall: Zehn Aufträge eines Kontos, die die Brücke schickt, die das Einlesen aber weder füllt
  noch schließt (der „bewusst offene“ Fall in [[spiegel-assignment]], eine Scheibe der Brücke über eine Zustimmung kam
  zuerst), belegen das Fenster bis zur Frist; die dahinter enden dann ebenfalls mit „keine Antwort“. Nicht in diesem
  Plan, im Bericht als offen.
- `printout-import` (Ordner alter Ausdrucke, `fetch-card/import.ts`) legt bewusst keinen Auftrag an. Mit dem Fenster
  könnte er es gefahrlos tun (Maximum an Daten). Nicht in diesem Plan, als Folgepunkt an die koordinierende Session.
- Reihenfolge älteste zuerst: Ein heute gescannter Ausdruck wartet hinter alten Uploads desselben Kontos. Hat der
  Schütze eine Zustimmung per Sportpass, kommt die Scheibe ohnehin über sie; sonst ein paar Minuten Verzug. Bewusst so
  gelassen (eine Regel, wie heute).

## Approach

1. **`fetchCard`:** Die Grenze gilt nur noch ohne Ausdruck (`file === null`). Mit Ausdruck entsteht der Auftrag immer,
   in allen drei Zweigen (neue Scheibe, eigene öffnen, aus dem Papierkorb zurück).
2. **`openRequestsOf`:** liefert je Konto alle gefüllten offenen Aufträge und die ältesten `MAX_OPEN_REQUESTS`
   ungefüllten, dann älteste zuerst bis `limit`. Die Auswahl ist eine reine Funktion (`requestWindow`), die
   Ungefüllt-Regel dieselbe wie `UNFILLED` (keine Scheibe oder Scheibe ohne Quelle).
3. Einlesen (`openRequestsFor`) bleibt: Es nimmt jeden offenen Auftrag, auch einen wartenden. Kommt eine Scheibe eines
   wartenden Auftrags über eine Zustimmung, füllt sie ihn, wie heute.
4. Meldung `tooMany` bleibt, nur noch für die getippte ID. Der Wortlaut „Es warten schon zehn Scheiben auf die Anlage.
   Warte, bis die Anlage sie geliefert hat.“ stimmt nicht mehr genau, wenn vom Upload schon 40 warten. **Vorschlag**
   (neuer Text, erst an die koordinierende Session): „Es warten schon zehn oder mehr Scheiben auf die Anlage. Mit dem
   Ausdruck geht es trotzdem, oder warte, bis die Anlage einige geliefert hat.“ Ohne OK bleibt der alte Text.
5. Kein Schema, keine Migration, kein neuer Vertrag, keine neue Brücke.

## Files

- `apps/spiegel/src/lib/card-requests/queries.ts` — Kommentar von `MAX_OPEN_REQUESTS`, neue reine Funktion
  `requestWindow`, `openRequestsOf` nutzt sie; Kopfkommentar um das Fenster ergänzt.
- `apps/spiegel/src/lib/card-requests/queries.test.ts` — Tests für `requestWindow` (rein).
- `apps/spiegel/src/lib/fetch-card/queries.ts` — `overLimit` nur ohne Ausdruck; Kopfkommentar und Kommentar von
  `fetchCard`.
- `apps/spiegel/src/lib/fetch-card/queries.test.ts` — der Test „zehn ungefüllte offene Aufträge“ geteilt in: getippte
  ID → `tooMany`; mit Ausdruck → `created` mit offenem Auftrag, auch beim Öffnen einer eigenen Scheibe ohne Auftrag und
  beim Zurückholen aus dem Papierkorb.
- `apps/spiegel/src/lib/ingest/requests.test.ts` — Zustand mit zwölf ungefüllten + einem gefüllten Auftrag eines
  Kontos und einem Auftrag eines anderen Kontos: die ältesten zehn, der gefüllte, der des anderen; nach Schließen eines
  davon rückt der elfte nach.
- nur bei OK zum Text: `apps/spiegel/src/lib/fetch-card/texts.ts` (+ `texts.test.ts`, falls dort der Wortlaut steht).
- Doku: `apps/spiegel/CLAUDE.md` („Scheibe holen“, Satz „höchstens zehn ungefüllte offene Aufträge“, und
  `bridgeState`), `vault/spiegel/spiegel-assignment.md` (Punkt 6 Rückweg „zählt zur Grenze von zehn“, „Getippte ID“
  Punkt 1, Punkt 2 Auftrag), `vault/spiegel/spiegel-ingest-pipeline.md` (Zustand der Brücke, falls dort Aufträge
  beschrieben sind; prüfen), `vault/decisions/adr-028.md` nur, wenn dort eine Grenze steht (bisher keine gefunden →
  nicht anfassen).

## Required Docs

- `vault/spiegel/spiegel-assignment.md` (Holen, Getippte ID, Auftrag)
- `vault/spiegel/spiegel-navigation.md` („Von der Anlage“, Holen)
- `vault/spiegel/spiegel-ingest-pipeline.md` (Zustand der Brücke, Aufträge)
- `vault/decisions/adr-028.md`
- `apps/spiegel/CLAUDE.md` („Scheibe holen“, „Ingest-API“, Tests gegen die Dev-Datenbank)
- `vault/conventions.md` §9 (Mocks filtern nach der Bedingung; Tests fassen nur eigene Zeilen an; Eigenschaftstests per
  Mutation gegenprüfen)

## Tasks

### Task 1 — Fenster der Aufträge im Zustand der Brücke

In `apps/spiegel/src/lib/card-requests/queries.ts`:

```ts
/**
 * so viele ungefüllte offene Aufträge eines Kontos nennt der Zustand der Brücke zugleich: Die Brücke liest jede ScheibenID
 * eines Auftrags sofort, auch während geschossen wird. Weitere warten, bis einer endet. Eine getippte ID ohne Ausdruck
 * legt darüber keinen Auftrag an (`fetchCard`).
 */
export const MAX_OPEN_REQUESTS = 10

/**
 * was die Brücke von den offenen Aufträgen sieht (rein): je Konto alle gefüllten (die Scheibe wird noch ergänzt) und die
 * ältesten `max` ungefüllten; die Folge bleibt, wie sie kommt (älteste zuerst)
 */
export function requestWindow<T extends { userId: string; filled: boolean }>(
  rows: readonly T[],
  max = MAX_OPEN_REQUESTS
): T[] {
  const unfilled = new Map<string, number>()
  return rows.filter((row) => {
    if (row.filled) return true
    const n = unfilled.get(row.userId) ?? 0
    unfilled.set(row.userId, n + 1)
    return n < max
  })
}
```

`openRequestsOf` liest ohne `take` alle offenen Aufträge aktiver Konten der Anlage (`orderBy: { id: "asc" }`, `select`
dazu `userId` und `card: { select: { sourceId: true } }`), bildet `filled = row.card?.sourceId != null` (dieselbe Regel
wie `UNFILLED`/`FILLED`), wendet `requestWindow` an, schneidet auf `limit` und gibt `{ id, scheibenId, day }` zurück.
Kommentar: „was die Brücke holen soll: offene Aufträge aktiver Konten der Anlage mit ihrem Abend, je Konto die ältesten
`MAX_OPEN_REQUESTS` ungefüllten (`requestWindow`), älteste zuerst, höchstens `limit`“.

Tests in `card-requests/queries.test.ts` (rein, ohne Datenbank):

- zwei Konten, A mit 12 ungefüllten und 1 gefüllten dazwischen, B mit 2 ungefüllten: A die ersten 10 ungefüllten und
  den gefüllten, B beide, Folge unverändert.
- ohne den ersten ungefüllten von A (geschlossen): der elfte rückt nach.
- `max = 0`: nur gefüllte.

Gegenprobe: `return n < max` testweise durch `return true` ersetzen (Backup per `cp`), Tests müssen rot werden,
zurückkopieren.

Test in `ingest/requests.test.ts` („Zustand und Heartbeat mit Aufträgen“): ein eigenes Konto der Test-Anlage mit
`MAX_OPEN_REQUESTS + 2` ungefüllten Aufträgen (ohne Scheibe, `request(...)`-Helfer oder `db.cardRequest.create`) und
einem gefüllten (Scheibe der Brücke), dazu ein Auftrag von `site.ownerId`: `bridgeState(...).requests` enthält die
ältesten zehn ungefüllten, den gefüllten und den des anderen Kontos, nicht die zwei jüngsten. Dann den ältesten auf
`missing` setzen: der elfte erscheint. Aufräumen im `finally` (Aufträge, Scheiben, Konto).

### Task 2 — `fetchCard` ohne Grenze mit Ausdruck

In `apps/spiegel/src/lib/fetch-card/queries.ts`:

```ts
// mit Ausdruck entsteht der Auftrag immer, die Brücke sieht je Konto nur die ältesten zehn (`requestWindow`); eine
// getippte ID ohne Ausdruck legt über der Grenze keinen an
const overLimit = async () =>
  file === null &&
  (await tx.cardRequest.count({ where: { userId, status: "open", ...UNFILLED } })) >= MAX_OPEN_REQUESTS
```

Die drei Aufrufe (`restored`, `opened`, `created`) bleiben, wie sie sind. Kopfkommentar der Datei und Kommentar von
`fetchCard` um den Satz ergänzen: „Mit Ausdruck legt Holen immer an; die Grenze der Aufträge gilt nur für die getippte
ID.“ `tooMany` im Typ `FetchResult` bekommt den Kommentar `/** getippte ID ohne Ausdruck: schon zehn ungefüllte offene
Aufträge */`.

Tests in `fetch-card/queries.test.ts`, der bestehende Test „zehn ungefüllte offene Aufträge …“ wird zu:

- „getippte ID: über zehn ungefüllten offenen Aufträgen keine weitere Scheibe; gefüllte zählen nicht“ (wie heute,
  `file: null`).
- „mit Ausdruck über der Grenze: die Scheibe entsteht samt offenem Auftrag“: dasselbe Konto mit zehn ungefüllten
  Aufträgen, dann `withChoice(id, { userId: user, file: file(id) })` → `created`, ein offener Auftrag mit dieser
  `cardId`.
- „mit Ausdruck über der Grenze: eine eigene Scheibe ohne Auftrag (zurückgezogen) bekommt einen neuen“ → `opened`, neuer
  offener Auftrag; und aus dem Papierkorb → `restored`, neuer offener Auftrag. Zum Vergleich ohne Ausdruck in beiden
  Fällen `tooMany`.

Gegenprobe: `file === null &&` testweise entfernen, die neuen Tests müssen rot werden.

### Task 3 — Text (nur mit OK)

Gibt die koordinierende Session den Text frei, in `fetch-card/texts.ts` `tooMany` auf den freigegebenen Wortlaut; die
Schreibregeln prüft `texts.test.ts`. Ohne OK entfällt die Aufgabe.

### Task 4 — Doku

- `apps/spiegel/CLAUDE.md`, „Scheibe holen“: statt „höchstens zehn ungefüllte offene Aufträge“ → „ohne Ausdruck höchstens
  zehn ungefüllte offene Aufträge (`tooMany`), mit Ausdruck immer“; bei `bridgeState`: „je Konto die ältesten zehn
  ungefüllten (`requestWindow`), weitere warten“.
- `vault/spiegel/spiegel-assignment.md`: Punkt 6 „er zählt zur Grenze von zehn“ → „er belegt einen der zehn Plätze im
  Zustand der Brücke“; „Getippte ID“ Punkt 1 „Höchstens zehn ungefüllte offene Aufträge je Konto“ → „Ohne Ausdruck
  höchstens zehn …; mit Ausdruck entsteht der Auftrag immer“; Punkt 2 (Auftrag): ein Satz zum Fenster (je Konto die
  ältesten zehn ungefüllten, die Brücke liest sie sofort, weitere rücken nach, sobald einer endet; Grund: Last der
  SSMDB2 in einer Runde). Zeile „Stand“ um „Fenster der Aufträge im Zustand“ ergänzen, „Keine neue Brücke“ bleibt.
- `vault/spiegel/spiegel-ingest-pipeline.md`: wo der Zustand Aufträge nennt, das Fenster ergänzen (prüfen, sonst nichts).
- `keywords:` in `spiegel-assignment` um „fenster der aufträge, warteschlange, grenze von zehn“ ergänzen.
- `node .claude/vault-lint.mjs` (bzw. der Weg aus `/sync-graph`) grün.

### Task 5 — Plan entfernen

Letzter Commit: `git rm plans/2026-10-27-fetch-no-request-cap.md`.

## Test steps

- `pnpm --filter spiegel exec vitest run src/lib/card-requests src/lib/fetch-card src/lib/ingest/requests.test.ts`
- Gegenproben aus Task 1 und 2 (Backup per `cp`, nicht `git checkout`).
- Gate im Worktree: `pnpm check`.

## Verification

- `/validate` im Browser mit dem Demo-Konto (`seed:own --demo`, Dev-Server aus dem Worktree auf :3022): per Skript zehn
  ungefüllte offene Aufträge für das Demo-Konto an der Anlage aus `requestSiteId` anlegen (ScheibenIDs aus dem Bereich
  `0x7fff0bxx`, fester Tag), dann auf `/scan` einen erfundenen Ausdruck hochladen (`tools/printout-sample.ts --values
  --id 7fff0c01`): Die Scheibe entsteht mit Werten, „Von der Anlage“ sagt „wartet auf die Anlage“. Danach eine getippte
  ID → Meldung `tooMany`. `bridgeState` per Skript: das Demo-Konto mit genau zehn ungefüllten, der neue Auftrag nicht
  dabei. Aufräumen: angelegte Aufträge, die neue Scheibe samt Ausdruck endgültig, dann `seed:own` für das eigene Konto.
- Optional `pnpm --filter spiegel bridge-e2e` (echte Brücke gegen den eigenen Build), wenn Docker und Go bereitstehen.
- Neue Brücke: nein. Vertrag unverändert.
