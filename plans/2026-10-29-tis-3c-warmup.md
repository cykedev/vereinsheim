# 3c · Einschießen

Teilplan von Stufe 3 aus `plans/2026-10-26-treffsicher-in-spiegel.md` (Basisbranch `feat/treffsicher-in-spiegel`),
Kindsession `tis-3c-warmup`, Branch `feat/tis-3c-warmup` von `main` (`39dca9f4`), zurück nach `main`. Entscheidungen:
Designkonzept 3c/3e (vom User am 29. Oktober 2026 mit allen Empfehlungen freigegeben,
https://claude.ai/artifact/84tuTUTfmPcxXVXYQMSnKV) und „Entschieden mit dem User am 29. Oktober 2026 (Planung Stufe 3)“
im Koordinationsplan. Abweichungen und Fragen stehen am Ende unter „Offene Punkte“; die Kindsession wartet auf deren
Entscheidung, bevor sie Aufgabe 2 beginnt.

## Kontext

Eine Scheibe „nur Probe“ ist in Spiegel zweierlei: ein Training, das ganz im Probe-Modus geschossen wurde, oder der
Probe-Block vor (oder nach) einer Wertung am selben Abend, der nach ADR-027 eine eigene Scheibe ist. Fortschritt,
Vergleichen, Start und Rekorde zählen heute beides mit (Schalter „Scheiben nur aus Probe mitzählen“, Vorgabe ja). Das
Einschießen ist meist schwächer und drückt den Schnitt. Das Tagebuch (Stufe 2c, nur im Basisbranch) rechnet seine Form
schon mit einer Regel je Abend (`countedCards` in `src/diary/analysis/form.ts`): Probe zählt nur an einem Abend ohne
Wertung. 3c bringt dieselbe Regel nach `main`, für alle Übersichten, und geht als eigenes Release, weil es auch ohne
Tagebuch nützt.

**Die Regel (freigegeben):** Eine Scheibe „nur Probe“ ist **Einschießen**, wenn es an ihrem Abend (Tag in der
Anzeige-Zone, vor 4 Uhr der Vortag, `eveningDay`) in ihrer Familie eine sichtbare Scheibe gibt, die nicht „nur Probe“
ist. Einschießen zählt in Fortschritt, Vergleichen, Start (Schnitte, Form, Formband, Rekorde) und bei den Rekorden nur
mit dem Schalter „Einschießen mitzählen“ (Vorgabe aus). Jede andere Scheibe „nur Probe“ zählt immer, wie ein Training.
Die Liste der Scheiben zeigt alle Scheiben und nennt das Einschießen. Keine Aktion je Scheibe („Als Wertung zählen“
entfällt).

**Stand der Daten** (Dev-Datenbank = Prod-Kopie, 29. Oktober 2026, nur sichtbare Scheiben mit Familie und Scheibenbild,
Abend in `Europe/Berlin`): 92 Scheiben „nur Probe“ in 7 Konten, davon **33 Einschießen** nach der Regel (je Konto, nach
Zahl absteigend: 57/5, 11/11, 10/10, 5/3, 5/1, 3/2, 1/1). Alle 33 sind gemessen (`raw`); 17 davon liegen nur **nach**
einer Wertung des Abends (siehe Offene Punkte 1). Die 46 Scheiben „nur Probe“ vom Ausdruck liegen alle an Abenden ohne
Wertung. Die Demo-Daten (`seed:own --demo` mit `tools/private/own-cards.json`) haben an der Dev-Anlage 4 Scheiben „nur
Probe“, 2 davon Einschießen, 2 Trainings im Probe-Modus: Beide Zustände sind belegt, neue Demo-Scheiben braucht es nicht.

## Ansatz

### Wo die Regel gilt: beim Lesen, ohne Schema und ohne neue Projektion

Die Übersichten lesen Projektionen ohne Schüsse (`ownerCards` → `OverviewCard`). Alles, was die Regel braucht, steht
dort schon: `startedAtMs` (Abend), `family.slug` und `projection.probeOnly`. Die Regel gilt deshalb beim Lesen, in
`overviewCards` (`src/lib/overview.ts`), das Start, Liste, Fortschritt und Vergleichen gemeinsam nutzen (im Basisbranch
auch das Tagebuch über `resultFormCards`). Kein Schema-Change, keine Migration, `PROJECTION_VERSION` bleibt (in `main`
6). Das Merkmal hängt nicht an einer einzelnen Scheibe: Löscht der Schütze die Wertung eines Abends oder ändert ihre
Disziplin, wird die Probe davor beim nächsten Lesen wieder ein Training. Gespeichert wäre das eine zweite Autorität.

### Fachkern: eine reine Funktion

Neu `packages/shot-core/src/analysis/warmup.ts`, exportiert über `./analysis` (`index.ts`):

```ts
// Einschießen (SF-05): Probe an einem Abend mit Wertung zählt in den Übersichten nicht, ein Training ganz im
// Probe-Modus schon. Rein: Abend und Familie bestimmt der Aufrufer (`markWarmup` in `shot-ui`).

/** eine Scheibe, wie die Regel sie braucht: ihr Abend (ISO-Tag), ihre Familie und ob sie nur aus Probe besteht */
export interface WarmupCandidate {
  id: string
  evening: string
  family: string
  probeOnly: boolean
}

/**
 * Die Scheiben, die Einschießen sind: nur Probe an einem Abend, an dem dieselbe Familie eine Scheibe hat, die nicht nur
 * Probe ist (auch eine ohne Werte, die auf die Anlage wartet). Die Folge am Abend zählt nicht.
 */
export function warmupIds(cards: readonly WarmupCandidate[]): Set<string> {
  const key = (card: WarmupCandidate) => `${card.family}\u0000${card.evening}`
  const scored = new Set(cards.filter((card) => !card.probeOnly).map(key))
  return new Set(cards.filter((card) => card.probeOnly && scored.has(key(card))).map((card) => card.id))
}
```

`ProjectedCard` (`projection.ts`) bekommt ein Feld, das nur beim Lesen gesetzt und nie gespeichert wird:

```ts
  /** Einschießen (`warmupIds`): beim Lesen gesetzt (`markWarmup`), nie in der Projektion gespeichert */
  warmup?: true
```

### Abend und Familie: `markWarmup` in `shot-ui`

`eveningDay` liegt in `shot-ui` (`period/calendar.ts`), der Fachkern hat keine Zeitzonen. Neu
`packages/shot-ui/src/period/warmup.ts`, Export `./period/warmup` in `packages/shot-ui/package.json`:

```ts
/** der Grund am „–“, wo Einschießen nicht zählt (Liste, Fortschritt, Ablesung) */
export const WARMUP_REASON = "Einschießen zählt nicht"

/**
 * Setzt `warmup` an jeder Scheibe, die Einschießen ist (`warmupIds`), und nimmt es an allen anderen weg; die Folge
 * bleibt. Der Abend ist `eveningDay` in `timeZone`. Eine Scheibe ohne Familie ist nie Einschießen und macht keins.
 */
export function markWarmup<T extends ProjectedCard>(
  cards: readonly T[],
  options: { timeZone: string; familyOf: (card: T) => string | null }
): T[]
```

Umsetzung: Kandidaten nur aus Scheiben mit Familie, `evening: eveningDay(card.startedAtMs, timeZone)`,
`probeOnly: card.projection.probeOnly`; dann `cards.map(({ warmup: _, ...card }) => ids.has(card.id) ? { ...card,
warmup: true } : card)` (Typ über `as T`).

### Die Option heißt überall `includeWarmup`

Auf der Ebene der Übersichten gibt es keine Option „nur Probe“ mehr. `includeProbeOnly` wird **`includeWarmup`**
(Vorgabe `false`), und es filtert `warmup`, nicht `probeOnly`:

- `shot-core/projection.ts`: `projectedValues(cards, metric, scoring, { includeWarmup? })` überspringt
  `card.warmup && !includeWarmup`; `pooledMean(cards, scoring)` rechnet ohne Einschießen (ohne Option);
  `recordsInView(card: { kind; warmup?: boolean }, options: { kind?; includeWarmup? })` filtert Art und Einschießen;
  `projectedRecords(cards, scoring, { kind?, includeWarmup? })` reicht `warmup` durch. Die Zeile
  `if (!options.includeProbeOnly && card.flags.includes(FLAG_COUNTED_AS_MATCH)) return false` entfällt,
  `recordsInView` nimmt keine `flags` mehr.
- Auf Ebene der Schüsse bleibt `includeProbeOnly` (`cardShots`, `cardValues`, `cardRecordCandidates`,
  `periodRecords`): Es sagt dort, ob die Probe einer Scheibe „nur Probe“ wie Wertung zählt; die Projektion rechnet
  immer mit `true`. In `periodRecords` entfällt nur die Bedingung mit `FLAG_COUNTED_AS_MATCH`, damit Projektion und
  Schüsse gleich bleiben (der Test hält das fest).
- `FLAG_COUNTED_AS_MATCH` bleibt exportiert und in `CARD_FLAGS` (die Liste filtert nach ihm, zwei Scheiben der Dev-DB
  tragen es), wird aber nirgends mehr ausgewertet. Neuer Kommentar an der Konstante: „Probe, die als Wertung zählen
  sollte (SF-05). Wird nicht ausgewertet: Ein Training ganz im Probe-Modus zählt ohnehin, Einschießen regelt
  `warmupIds`. Bleibt als Kennung, weil Scheiben es tragen.“
- `shot-ui/period/item.ts`: `PeriodItem.warmup?: true` (Doku: „Einschießen: zählt nur mit `includeWarmup`“);
  `itemValues`/`itemRecords` mit `{ includeWarmup? }` wie oben. `fromProjection` reicht `card.warmup` durch,
  `lightCard` (`period/model.ts`) auch.
- `shot-ui/period/state.ts`: `PeriodState.includeWarmup: boolean` (Vorgabe `false`), Aktion
  `{ type: "setIncludeWarmup"; include: boolean }`, `setFilters` mit `includeWarmup`.
- `shot-ui/period/model.ts`: `options = { includeWarmup: state.includeWarmup }`; `counted = cards.filter((card) =>
  state.includeWarmup || !card.warmup)`; `excludedProbeOnly` wird **`excludedWarmup`** (`state.includeWarmup ? 0 :
  cards.filter((c) => c.warmup).length`); `patternIds(model, includeWarmup)`; in `reasons` bekommt jede nicht gezählte
  Einschieß-Scheibe `WARMUP_REASON` (unabhängig davon, ob Scheiben `detail` tragen); `itemRecords(…, { kind,
  includeWarmup })`. Umfang, Wochen und Kalender zählen weiter alle Scheiben (geschossen ist geschossen).
- `shot-ui/nav/routes.ts`: `ProgressQuery.includeWarmup` und die beiden Zeiträume-Formen von `CompareQuery`; Schlüssel
  **`warmup=1`** nur, wenn an (`["warmup", query.includeWarmup ? "1" : null]`), gelesen als
  `params.get("warmup") === "1"`. `sighters` liest keine Funktion mehr: Eine alte Adresse mit `sighters=0` oder
  `sighters=1` öffnet mit der Vorgabe (Einschießen aus), ohne Fehler. Der Cookie `spiegel-period` trägt nur den
  Zeitraum (`encodeChoice`) und ist nicht betroffen. `withRememberedChoice` sieht `sighters` weiter als eigene Abfrage
  (dann gilt die Vorgabe statt des gemerkten Zeitraums); harmlos, bleibt.
- `shot-ui/nav/navigate.ts` (`compareFromProgress`, `periodStateFromRoute`), `compare/CompareControls.tsx`,
  `compare/model.ts` (`groupCompareModel`: `items.filter((item) => input.includeWarmup || !item.warmup)`),
  `apps/spiegel/src/lib/compare.ts` (`counts`), `apps/spiegel/tools/measure.ts`: mitgezogen.
- Treffsicher kennt kein Einschießen (`probeOnly: false` in `periodItems.ts`): `statistics/page.ts` setzt
  `includeWarmup: false` statt `includeProbeOnly: true`, `StatisticsScreen.tsx` `warmupSwitch={false}`, Test
  `page.test.ts` entsprechend. Das Verhalten von Treffsicher ändert sich nicht.

Bis Aufgabe 5 setzt niemand `warmup`; nach Aufgabe 4 zählen deshalb alle Scheiben „nur Probe“ wie heute mit der
Vorgabe. Das prüft die Zählung (Aufgabe 1) als Zwischenstand.

### Lesen: `overviewCards` markiert

`overviewCards(db, ownerId, timeZone)` bekommt die Zone als dritten Parameter:

```ts
  const shown = markWarmup(listable(cards), { timeZone, familyOf: (card) => card.family?.slug ?? null })
```

Aufrufer: `startPageData`, `listPageData`, `progressPageData` (`context.timeZone`), `comparePageData`
(`context.timeZone`). `ownerCards` für das Blättern auf der Seite einer Scheibe bleibt ohne Markierung (es braucht nur
die Folge der Ids). Gelöschte, wartende und ignorierte Scheiben kommen nie in `shown` (`VISIBLE_CARD`): Eine gelöschte
Wertung macht kein Einschießen.

### Liste der Scheiben

- `ListRow.warmup?: true` (aus `card.warmup`).
- Der Abstand rechnet über `projectedValues(ofKind, …)` ohne Option, also ohne Einschießen: Einschießen drückt den
  Schnitt davor nicht. Eine Einschieß-Zeile hat keinen Abstand, Grund `WARMUP_REASON` (statt „keine Scheibe davor“).
- Ergebnis und Ø je Schuss der Zeile stehen leise: `text-muted-foreground`, nicht fett, auch nicht die Wertung der
  Scheibe. Die Liste rechnet keinen Ø über Zeilen; die Monatszeile zählt Scheiben und Schuss weiter (Umfang).
- `KindMark({ kind, warmup })`: bei `warmup` unter dem Zeichen `<span data-warmup-word className="block text-xs
  text-muted-foreground">Einschießen</span>`, der Screenreader hört „Training nur Probe, Einschießen“. Das Wort „Probe“
  bleibt bei jeder Scheibe „nur Probe“. `EveningList` gibt `warmup` an `KindMark`, `rowName` (Name des Links) nennt
  nach der Art „Einschießen, zählt nicht“.
- Dieselbe `KindMark` steht in der Liste im Fortschritt (`period/CardList.tsx`, `warmup` aus `PeriodItem`) und die
  Kacheln auf Start nennen „Einschießen“ in ihrer Metazeile (`[time, KIND_TEXT[row.kind], row.warmup ? "Einschießen" :
  null, provenance]`) und im Namen des Links. Eine Sache, ein Wort, an jeder Stelle.

### Start

Die Kacheln des Abends zeigen alle Scheiben (wie die Liste). Der Ø des Abends (`pooledMean`), Streifen, Formband,
Schnitt davor, Satz und neue Rekorde rechnen ohne Einschießen; die Grundlage (`basis`) nur über die gezählten Scheiben
des Abends (`!card.warmup`). Die Schusszahl im Kopf des Blocks bleibt der Umfang (alle Scheiben). „Form“ unten rechnet
über `periodModel` mit `initialPeriodState`, also ohne Einschießen.

### Fortschritt und Vergleichen

- **Blatt „Filter“** (`PeriodPicker`): Prop `warmupSwitch` (Vorgabe `true`) statt `probeOnlySwitch`, `includeWarmup`
  statt `includeProbeOnly`. Die Zeile: Checkbox „Einschießen mitzählen“, darunter leise der Hinweis aus dem Textbuch.
  `filterSummary` hängt „mit Einschießen“ an, wenn an (statt „ohne Probe-Scheiben“, wenn aus). `PeriodControls` reicht
  `warmupSwitch` durch.
- **Kopf:** `PeriodHeader.meta` wird `readonly ReactNode[]` (mit „ · “ dazwischen, Treffsicher gibt weiter Texte).
  Neu in `period/words.ts`: `periodCountText(cards: number, warmup: number, words = CARD_WORDS)` → „14 Scheiben“ bzw.
  „14 Scheiben, 2 Einschießen nicht gezählt“ (mit `countOf`, also „1 Scheibe“). `ProgressScreen` setzt diesen Text
  und, wenn `model.excludedWarmup > 0`, dahinter `<HelpButton label="Was heißt Einschießen?" helpId="einschiessen"
  onClick={() => onHelp("einschiessen")} />`.
- **Verlauf (`PeriodChart`): keine Änderung.** Punkte kommen aus `values`, die ohne Schalter kein Einschießen
  enthalten; mit Schalter stehen Einschieß-Punkte hohl wie jede Scheibe „nur Probe“, Trainings im Probe-Modus bleiben
  hohl. Begründung: hohl heißt in Spiegel „Probe“, wie das Probe-Eck. Ein drittes Zeichen nur für Einschießen wäre neu
  zu lernen, und mit Schalter zählt es ja.
- **Ablesung:** Ist eine Einschieß-Scheibe gewählt (etwa über `pick` aus der Adresse), sagt der Grund aus `reasons`
  „Einschießen zählt nicht“.
- **Vergleichen** hat kein Blatt „Filter“: Es übernimmt `warmup=1` aus dem Fortschritt („Genauer vergleichen“), wie
  heute `sighters` (siehe Offene Punkte 4).

### Hilfe

Neu in `VIEW_HELP` (`packages/shot-help/src/guide.ts`) die Erklärung `einschiessen`; geändert die Themen `rekorde`
(`caution`) und `gegen-den-schnitt` (`what`) in `topics.ts`. Texte unten. Danach `pnpm --filter
@vereinsheim/shot-help docs` (erzeugt `vault/spiegel/spiegel-statistics-help.md` neu).

## Neue Texte (gehen erst zum User, dann ins Textbuch Spiegel, dann in den Code)

Geschrieben für die Regel „ein Abend mit Wertung“ (freigegeben). Entscheidet der Koordinator Offene Punkte 1 anders,
gelten die Texte in Klammern.

1. **Blatt „Filter“, Schalter:** „Einschießen mitzählen“. Darunter leise: „Probe an einem Abend, an dem du in derselben
   Disziplin auch mit Wertung schießt. Ein Training ganz im Probe-Modus zählt immer.“ („Probe vor einer Wertung am
   selben Abend. Ein Training ganz im Probe-Modus zählt immer.“)
2. **Chip „Filter“**, nur wenn an: „… · mit Einschießen“.
3. **Kopf im Fortschritt:** „14 Scheiben, 2 Einschießen nicht gezählt“, dahinter „?“ mit dem Namen „Was heißt
   Einschießen?“.
4. **Hilfe `einschiessen`**, Titel „Einschießen“.
   - Was: „Einschießen ist Probe an einem Abend, an dem du in derselben Disziplin auch mit Wertung schießt. Meist ist es
     das Warmschießen davor. Es zählt nicht im Schnitt, im Verlauf, in der Form und bei den Rekorden, damit es deinen
     Schnitt nicht drückt. Ein Training ganz im Probe-Modus zählt mit, wie ein Training mit Wertung.“ („Einschießen ist
     Probe vor einer Wertung am selben Abend, in derselben Disziplin. Es zählt nicht … [Rest gleich]“)
   - So liest du es: „Ein Abend reicht bis 4 Uhr morgens. Unter „Scheiben“ steht das Einschießen mit allen anderen
     Scheiben, unter der Art steht „Einschießen“, seine Zahlen stehen leise. Im Fortschritt zählst du es mit
     „Einschießen mitzählen“ im Blatt „Filter“ mit. Vergleichen übernimmt diese Wahl.“
5. **Liste, Fortschritt, Start:** das Wort „Einschießen“ unter der Art bzw. in der Metazeile der Kachel; der Grund am
   „–“: „Einschießen zählt nicht“; im Namen des Links: „…, Training nur Probe, Einschießen, zählt nicht, …“.
6. **Hilfe `rekorde`, `caution`:** der Satz „Eine Scheibe nur aus Probe zählt mit, solange „Scheiben nur aus Probe
   mitzählen“ im Blatt „Filter“ an ist (die Vorgabe); dann gilt ihre Probe wie Wertung, in Serien zu zehn. Ebenso eine
   Scheibe, deren Probe du als Wertung zählst.“ wird: „Ein Training ganz im Probe-Modus zählt mit, seine Probe gilt
   wie Wertung, in Serien zu zehn. Einschießen zählt nur mit „Einschießen mitzählen“ im Blatt „Filter“.“
7. **Hilfe `gegen-den-schnitt`, `what`:** „…, und Scheiben nur aus Probe nur, wenn sie mitzählen.“ wird „…, und
   Einschießen nur, wenn es mitzählt.“

## Dateien

- Neu: `packages/shot-core/src/analysis/warmup.ts` (+ `warmup.test.ts`), `packages/shot-ui/src/period/warmup.ts` (+
  `warmup.test.ts`), `apps/spiegel/tools/warmup-census.ts` (nur auf dem Branch, Aufgabe 11 löscht es).
- `packages/shot-core`: `src/analysis/index.ts`, `projection.ts` (+ Test), `records.ts` (+ Test), `CLAUDE.md`.
- `packages/shot-ui`: `package.json` (Export), `period/item.ts`, `fromProjection.ts`, `model.ts` (+ Test), `state.ts`
  (+ Test), `PeriodPicker.tsx`, `PeriodHeader.tsx` (+ Test), `words.ts` (+ Test), `CardList.tsx`, `season.test.ts` und
  `__snapshots__/season.test.ts.snap`, `testSeason.ts`, `nav/routes.ts` (+ Test), `nav/navigate.ts`,
  `compare/model.ts` (+ Test), `compare/CompareControls.tsx`, `list/evenings.ts` (+ Test), `list/EveningList.tsx` (+
  Test), `list/KindMark.tsx` (+ Test), `start/model.ts` (+ Test), `start/EveningBlock.tsx` (+ Test), `CLAUDE.md`.
- `packages/shot-help`: `src/guide.ts`, `src/topics.ts`; erzeugt: `vault/spiegel/spiegel-statistics-help.md`.
- `apps/spiegel`: `src/lib/overview.ts` (+ `overview.test.ts`), `src/lib/compare.ts` (+ Test), `src/lib/db/reads.test.ts`
  (Rekorde mit `FLAG_COUNTED_AS_MATCH`), `src/components/progress/ProgressScreen.tsx`, `usePeriodPattern.ts`
  (Kommentar), `tools/measure.ts`, `tools/pruefen.ts`, `package.json` (Skript `warmup-census`, Aufgabe 11 wieder weg),
  `CLAUDE.md`.
- `apps/treffsicher`: `src/lib/statistics/page.ts` (+ Test), `src/components/app/statistics/StatisticsScreen.tsx`.
- Vault: `vault/spiegel/spiegel-langzeit.md`, `spiegel-vergleichen.md`, `spiegel-navigation.md`, `spiegel-ui-design.md`,
  `spiegel-edge-cases.md`, `spiegel-statistics.md`.
- **Keine geschützten Pfade:** kein Schema, keine Migration, kein `compose.yml`/`Caddyfile`, nichts unter `scripts/`,
  `.claude/` oder `vault/decisions/`. Keine neue Brücke nötig.

## Required Docs

- `vault/conventions.md` §2 („–“ mit Grund, Hilfe mit „?“), §3 (Kontrast: leise heißt `text-muted-foreground` ohne
  Opazität), §6, §8 (Gate), §9 („Charakterisierungstests müssen die falsche Quelle erkennen können“, „Eigenschaftstests
  per Mutation gegenprüfen“, „Neue Felder ändern eine Charakterisierung, die jedes Feld festschreibt“, „Tests gegen die
  Dev-Datenbank fassen nur eigene Zeilen an“, „Datenlage vor der Sichtprüfung abgleichen“, „Prettier nicht auf
  Vault-Notes“, „Ein Feld fester Breite … am Telefon“), §10 („So schreiben wir“).
- `apps/spiegel/CLAUDE.md` („Übersichten lesen keine Schüsse“, „Fortschritt“, Skriptprüfung), `packages/shot-core/CLAUDE.md`,
  `packages/shot-ui/CLAUDE.md`, `packages/shot-help/CLAUDE.md` (eine Quelle, `docs`).
- `vault/spiegel/spiegel-langzeit.md` (Blatt „Filter“, „Training nur aus Probe“), `spiegel-vergleichen.md`,
  `spiegel-navigation.md` (Adressen, Liste), `spiegel-ui-design.md` („Sonderfälle in der Oberfläche“),
  `spiegel-edge-cases.md` (SF-05, SF-11), `vault/decisions/adr-027.md` (Probe-Block als eigene Scheibe), `adr-031.md`
  (Projektion beim Schreiben, Filter beim Lesen).
- Code: `packages/shot-core/src/analysis/projection.ts`, `records.ts`, `card-shots.ts`; `packages/shot-ui/src/period/*`,
  `list/*`, `start/model.ts`, `nav/routes.ts`; `apps/spiegel/src/lib/overview.ts`, `compare.ts`, `db/reads.ts`
  (`OverviewCard`, `toOverview`), `db/visible.ts`; `tools/pruefen.ts` (`progress`, `listFilterSheet`, `noSideScroll`).

## Aufgaben

Jede Aufgabe endet mit `pnpm check` (grün) und einem Commit (vorher `pnpm check && git commit`, nie mit `;`). Es kommt
kein Paket dazu.

0. **Branch und Plan.** `feat/tis-3c-warmup` von `main` (`39dca9f4` oder neuer, vorher `git log -1 main` gegen
   `origin/main` prüfen); diese Datei als erster Commit `docs(plans): sub-plan 3c (warmup)`. Im Worktree
   `apps/spiegel/.env` und `apps/spiegel/tools/private` aus dem Haupt-Checkout verlinken (nur mit `[ -e … ] ||`),
   Node 26 im `PATH`.

1. **Zählung vorher.** `apps/spiegel/tools/warmup-census.ts`, Skript `"warmup-census": "tsx tools/warmup-census.ts"`.
   Nur lesend, gegen die Dev-Datenbank wie `measure.ts` (`process.env.DATABASE_URL ?? DEV_DATABASE_URL`, `PrismaPg`).
   Ablauf: alle `ownerId` mit sichtbaren Scheiben (`db.card.groupBy({ by: ["ownerId"], where: { ownerId: { not: null },
   deletedAt: null, ownerPending: false } })`), nach Kennung sortiert, Konto `i` = Position (nie Name, E-Mail oder
   Kennung ausgeben). Je Konto `progressPageData(db, ownerId, { ...DEFAULT_PROGRESS, choice: { type: "all" }, family },
   { timeZone: "Europe/Berlin", nowMs: Date.now(), named: [] })` für jede Familie aus `families`. Eine Zeile je Konto und
   Familie, genau in dieser Form:
   `Konto 3 · luftpistole · alle 120 · gezählt 118 · Schuss 4400 · Ø 8.912 · Rekorde 14`
   (`alle` = `model.cards.length`, `gezählt` = `model.summary.cards`, `Schuss` = `model.summary.shots`, `Ø` =
   `summary.mean?.toFixed(3) ?? "–"`, `Rekorde` = `recordRows(model.records, state.scoring).length`). Dazu je Konto und
   Familie die Zahl des Einschießens **aus SQL**, unabhängig vom Code der Regel (dieselbe Abfrage wie im Kontext:
   `CardProjection.probeOnly`, Abend über `at time zone 'Europe/Berlin'` mit 4-Uhr-Grenze, `exists` einer Scheibe
   derselben Familie und desselben Abends mit `not probeOnly`, Filter wie `VISIBLE_CARD` plus Familie und
   `Discipline.targetId`), als eigene Zeile `SQL Konto 3 · luftpistole · Einschießen 5`. Lauf auf dem unveränderten
   Stand: `pnpm --filter spiegel warmup-census > reports/2026-10-29-tis-3c-census-before.txt` (gitignored, nie
   committen; enthält Leistungsdaten anderer Mitglieder). Erwartet: Summe der SQL-Zeilen 33. Commit `chore(spiegel):
   census of probe-only cards per account and family`.

2. **Die Regel im Fachkern.** `warmup.ts` wie oben, Export in `analysis/index.ts`. Tests `warmup.test.ts` (Fixtures
   so, dass eine Regel ohne Familie oder ohne Abend ein anderes Ergebnis gäbe):
   - Probe und Wertung, gleicher Abend, gleiche Familie → die Probe ist Einschießen, die Wertung nicht.
   - Probe allein am Abend → kein Einschießen; zwei Probe-Scheiben ohne Wertung → keine.
   - Probe in Familie A, Wertung in Familie B am selben Abend → kein Einschießen.
   - Probe am Abend davor, Wertung am Abend danach → kein Einschießen.
   - Probe **nach** der Wertung am selben Abend → Einschießen (die Folge zählt nicht; bei Entscheidung B in Offene
     Punkte 1 kippt genau dieser Fall).
   - Eine Scheibe ohne Werte (`probeOnly: false`, wartet auf die Anlage) zählt als Wertung.
   - Die Folge der Eingabe ändert nichts (umgedrehte Liste → dieselbe Menge).
   Mutationsproben (Datei vorher mit `cp` sichern, aus der Kopie zurück, nicht `git checkout`): Schlüssel ohne Familie
   → „andere Familie“ rot; `!card.probeOnly` → `true` → „zwei Probe-Scheiben ohne Wertung“ rot. Commit
   `feat(shot-core): warmup rule for probe-only cards`.

3. **Abend und Familie in `shot-ui`.** `period/warmup.ts` (`markWarmup`, `WARMUP_REASON`), Export
   `"./period/warmup": "./src/period/warmup.ts"`. Tests `warmup.test.ts` mit `projectCard` aus Fixtures (oder
   `ProjectedCard`-Literalen) in `Europe/Berlin`:
   - Wertung 10.03.2026 19:00 MEZ (18:00 UTC), Probe 11.03.2026 02:30 MEZ (01:30 UTC) → Einschießen; Probe 11.03.2026
     04:30 MEZ (03:30 UTC) → keins.
   - Umstellung: Wertung 24.10.2026 20:00 MESZ (18:00 UTC), Probe 25.10.2026 03:30 MEZ (02:30 UTC) → Einschießen; Probe
     25.10.2026 04:30 MEZ (03:30 UTC) → keins.
   - `familyOf` gibt null: weder Einschießen noch Wertung für andere.
   - Ein `warmup: true` am Eingang, das nach der Regel nicht gilt, fällt weg; die Folge bleibt.
   Mutationsprobe: `eveningDay(…)` durch `formatIsoDate(new Date(ms), timeZone)` ersetzen → die 4-Uhr-Fälle rot.
   Commit `feat(shot-ui): mark warmup cards per evening and family`.

4. **`includeWarmup` statt `includeProbeOnly` durch alle Schichten.** Wie unter „Die Option heißt überall
   `includeWarmup`“: `ProjectedCard.warmup`, `projectedValues`, `pooledMean`, `recordsInView`, `projectedRecords`,
   `periodRecords` (ohne Bedingung mit `FLAG_COUNTED_AS_MATCH`), Kommentar an `FLAG_COUNTED_AS_MATCH`; `PeriodItem`,
   `fromProjection`, `lightCard`, `itemValues`, `itemRecords`, `PeriodState`, Reducer, `periodModel` (`excludedWarmup`,
   `counted`, `reasons` mit `WARMUP_REASON`, `patternIds`), Routen (`warmup=1`), `navigate.ts`, Vergleichen
   (`compare/model.ts`, `CompareControls.tsx`, `src/lib/compare.ts`), `PeriodPicker`/`PeriodControls` (`warmupSwitch`,
   Name der Checkbox noch „Scheiben nur aus Probe mitzählen“ bis Aufgabe 8), `ProgressScreen` (`excludedWarmup`, Key,
   `patternIds`), `measure.ts`, Treffsicher. `tsc` findet jede Stelle. Tests:
   - `projection.test.ts`: Gleichheit Projektion = Schüsse bleibt: `projectedValues(PROJECTED, …)` gleich
     `cardValues(CARDS, …, { includeProbeOnly: true })`; mit einer als `warmup` markierten Karte (die Sonderfall-Karte
     „probe“) gleich `cardValues` ohne sie, mit `includeWarmup: true` gleich mit ihr; dasselbe für Rekorde gegen
     `periodRecords(…, { includeProbeOnly: true })`. Die Karten „counted“ und „counted-match“ zählen jetzt immer
     (Erwartung im Kommentar: das Merkmal wird nicht ausgewertet).
   - `records.test.ts` (Fall um Zeile 256) und `apps/spiegel/src/lib/db/reads.test.ts` (Zeilen 72 und 129): Eine Scheibe
     mit `FLAG_COUNTED_AS_MATCH` zählt für Rekorde wie ohne.
   - `period/model.test.ts`: `excludedWarmup` 1 mit einer Einschieß-Scheibe und Vorgabe, 0 mit `includeWarmup`; ein
     Training im Probe-Modus (`probeOnly`, ohne `warmup`) zählt mit Vorgabe in Ø, Rekorden und `basis`; `reasons` nennt
     `WARMUP_REASON`; `patternIds` ohne die Einschieß-Scheibe. Fixture: Die Einschieß-Scheibe hat den schwächsten Ø, so
     dass ihr Mitzählen den Ø sichtbar ändert.
   - `state.test.ts`, `routes.test.ts` (Fortschritt und beide Zeiträume-Formen: ohne Schlüssel aus, `warmup=1` an, Hin
     und zurück; `sighters=0` und `sighters=1` ergeben die Vorgabe), `compare/model.test.ts`, `PeriodHeader.test.tsx`
     (Prop), Treffsicher `page.test.ts`.
   - `season.test.ts`: Der Schnappschuss ändert nur den Schlüssel `excludedProbeOnly` → `excludedWarmup`. Vor `vitest
     -u` alte gegen neue Zeilen halten (kleines Skript, Lesson §9): nur dieser Schlüssel anders, alle Werte gleich.
     `testSeason.ts`: Die Karte „gezaehlt“ bleibt (Merkmal ohne Wirkung), ein Test mit `includeProbeOnly: false` wird
     einer mit `includeWarmup: false`, die erwartete Zahl ist dann 0, solange keine Karte `warmup` trägt; dazu eine Karte
     mit `warmup: true` im Testsaison-Satz, damit `excludedWarmup > 0` belegt ist.
   Danach `pnpm --filter spiegel warmup-census` (Werkzeug auf `includeWarmup` umgestellt, Vorgabe aus): Ausgabe
   identisch mit der Datei von vorher (`diff`), denn noch trägt keine Scheibe `warmup`. Commit `refactor(shot-ui):
   warmup option replaces probe-only option in overviews`.

5. **Beim Lesen markieren.** `overviewCards(db, ownerId, timeZone)` mit `markWarmup`, alle Aufrufer. Tests in
   `overview.test.ts` (eigenes Konto und eigene Familie je Fall, nach dem Muster von „Scheiben ohne Einzelschüsse“;
   eine Scheibe „nur Probe“ entsteht aus `generateSeason` mit allen Schüssen `stellung: 0`, `series: null`):
   - Abend mit Probe 18:20 und Wertung 19:00 → Liste: Zeile `warmup`; Fortschritt „Alles“: `excludedWarmup` 1, `summary.cards`
     ohne sie; mit `includeWarmup: true` mit ihr.
   - Abend mit nur einer Probe-Scheibe → zählt in Fortschritt und Start.
   - Probe am Abend einer **gelöschten** Wertung (`deletedAt` gesetzt) → kein Einschießen.
   - Probe in LP, Wertung in LG am selben Abend → kein Einschießen.
   - `comparePageData` (Zeiträume, Vorgabe) zählt die Einschieß-Scheibe nicht, mit `includeWarmup` schon
     (`compare.test.ts`).
   Mutationsprobe: in `ownerCards` `...VISIBLE_CARD` durch `ownerPending: false, ...SHOWN_DISCIPLINE` ersetzen → der Fall
   „gelöschte Wertung“ rot (weitere Tests werden mit rot, im Bericht nennen). `warmup-census` umstellen: zweimal
   rechnen, mit `includeWarmup: true` (Zeilen wie vorher) und mit `false` (Zeilen mit Zusatz `· nicht gezählt N`).
   Erwartet: die Zeilen „an“ gleich der Datei von vorher; „aus“: `alle` gleich, `nicht gezählt` gleich der SQL-Zahl
   jeder Familie, `gezählt` um höchstens diese Zahl kleiner. Ausgabe nach
   `reports/2026-10-29-tis-3c-census-after.txt`. Commit `feat(spiegel): overviews leave warmup out by default`.

6. **Liste der Scheiben und Wort an jeder Stelle.** `ListRow.warmup`, Abstand ohne Einschießen und Grund
   `WARMUP_REASON`, leise Zahlen, `KindMark({ kind, warmup })`, `rowName`, Fortschritt-Liste, Kacheln auf Start (Meta
   und Name). Tests:
   - `evenings.test.ts`: Folge Wertung 9,5 / Einschießen 8,0 / Wertung → der Abstand der dritten Scheibe rechnet ohne
     die 8,0 (mit ihr wäre er klar anders, Wert im Test ausrechnen); die Einschieß-Zeile hat `delta` null mit
     `WARMUP_REASON`. Mutationsprobe: `includeWarmup: true` im Fenster → rot.
   - `EveningList.test.tsx`: `[data-warmup-word]` nur an der Einschieß-Zeile; ihre Ergebnis- und Ø-Zellen tragen
     `text-muted-foreground` und nicht `font-semibold`; der Link nennt „Einschießen, zählt nicht“; ein Training im
     Probe-Modus trägt „Probe“ und kein Wort.
   - `KindMark.test.tsx`, `EveningBlock.test.tsx` (Meta „… · Training nur Probe · Einschießen“).
   Commit `feat(shot-ui): name warmup cards in the lists and on start`.

7. **Start rechnet ohne Einschießen.** `start/model.ts`: `basis` nur über `!card.warmup`; Ø, Streifen, Band, Rekorde
   über die Optionen aus Aufgabe 4 (prüfen, dass kein `includeWarmup: true` übrig ist). Test `start/model.test.ts`:
   Abend mit Einschießen 8,0 und Wertung 9,5 → `mean` ist der der Wertung, `rows` hat beide, `basis` null (alle
   gezählten zählen), `shots` beider; ein Abend nur mit Probe → `mean` der Probe. Commit `feat(shot-ui): start
   counts the evening without warmup`.

8. **Hilfe und Texte.** Erst die Texte aus „Neue Texte“ vom User bestätigen lassen (über die Koordination) und ins
   Textbuch. Dann `VIEW_HELP` `einschiessen`, `topics.ts` (`rekorde`, `gegen-den-schnitt`), `pnpm --filter
   @vereinsheim/shot-help docs`; `PeriodPicker` (Name, Hinweis, `filterSummary`), `periodCountText`, `PeriodHeader.meta`
   als `ReactNode[]`, `ProgressScreen` mit „?“. Tests: `words.test.ts` (`periodCountText` mit 1 und 14 Scheiben, 0 und 2
   Einschießen), `PeriodHeader.test.tsx` (Name und Hinweis im Blatt, „Alles · Wettkampf · mit Einschießen“, Meta mit
   Knoten), Tests in `shot-help` (Stil, Abgleich mit dem Vault-Leitfaden). Commit `feat(spiegel): explain warmup in the
   progress header and the filter sheet`.

9. **Skriptprüfung.** In `tools/pruefen.ts` neuer Abschnitt `await section("Einschießen", () => warmup(page))` nach
   „Fortschritt“. Bei 390 und 360 px:
   - `/cards`: eine Zeile mit `[data-warmup-word]`; ihre Zellen `[data-rings]`, `[data-decimal]`, `[data-mean]` haben
     die Klasse `text-muted-foreground`; ihr `[data-delta]` nennt „Einschießen zählt nicht“; eine Zeile mit
     `[data-kind="probe"]` ohne `[data-warmup-word]` gibt es auch. Fehlt eins: FAIL mit „Demo-Daten ohne Einschießen
     bzw. ohne Training im Probe-Modus; vorher seed:own --demo“. Kein seitliches Scrollen (`noSideScroll`, Pfad
     `/cards`).
   - `/progress?range=all`: Der Kopf nennt „Einschießen nicht gezählt“, `[data-help="einschiessen"]` öffnet das Blatt
     mit dem Titel „Einschießen“. Blatt „Filter“ öffnen: Checkbox „Einschießen mitzählen“ aus, anhaken, „Übernehmen“ →
     Adresse mit `warmup=1`, der Chip endet auf „mit Einschießen“, der Kopf nennt nichts mehr, die Zahl der
     `[data-card-point]` ist größer. Zurückschalten. Kein seitliches Scrollen (`/progress?range=all`).
   - `/progress?sighters=0`: lädt ohne Skriptfehler, Chip ohne „mit Einschießen“.
   Commit `test(spiegel): browser check for warmup`.

10. **Doku.** `spiegel-langzeit.md` (Blatt „Filter“: „Einschießen mitzählen“ statt „Scheiben nur aus Probe mitzählen“;
    der Absatz „Training nur aus Probe“ wird „Einschießen“ mit der Regel, `markWarmup` beim Lesen, Vorgabe aus;
    Treffsicher: `warmupSwitch={false}`); `spiegel-vergleichen.md` (Zeile „ein Zeitraum“: „mit Art und Einschießen wie
    im Fortschritt“); `spiegel-navigation.md` (Adressen `warmup=1` statt `sighters=0`, Zeilen 51, 86, 89; „nur Probe“
    in den Filtern; Liste: Wort „Einschießen“ unter der Art; Zeile 506 „Probe einbeziehen“ → Einschießen);
    `spiegel-ui-design.md` (Sonderfälle: „Als Wertung zählen“ entfällt; neuer Punkt „Einschießen“: Liste nennt es,
    Zahlen leise, Übersichten zählen es nur mit Schalter); `spiegel-edge-cases.md` (SF-05: **Entschieden (29. Oktober
    2026)**, keine Aktion; ein Training ganz im Probe-Modus zählt, Einschießen nach `warmupIds` nicht; Merkmal
    `als-wertung-gezaehlt` bleibt in `CARD_FLAGS`, wird nicht ausgewertet; Beleg: Tests in `warmup.test.ts` und
    `overview.test.ts`. SF-11: Einschießen nennt die Liste beim Wort); `spiegel-statistics.md` §9 (Rekorde ohne
    Einschießen, Training im Probe-Modus zählt); `apps/spiegel/CLAUDE.md` („Übersichten lesen keine Schüsse“: Satz zu
    `markWarmup` in `overviewCards`); `packages/shot-core/CLAUDE.md` (Zeilen 95 und 135, `warmup.ts` in der Tabelle);
    `packages/shot-ui/CLAUDE.md` (Exporttabelle `period/warmup`, Zeilen 69, 70, 84, 107, 192 bis 200, 228 und 229).
    Vault-Notes nicht mit Prettier formatieren; `node .claude/vault-lint.mjs` bzw. `/sync-graph` grün. Commit `docs:
    warmup rule in the vault and package notes`.

11. **Zählung nachher und Aufräumen.** `warmup-census` ein letztes Mal (Ergebnis wie in Aufgabe 5), Zahlen in den
    Bericht von `/validate` (nur Summen je Konto, keine Leistungswerte). Dann Werkzeug und Skript löschen (die Regel
    hätte sonst eine zweite Autorität in SQL). Commit `chore(spiegel): remove the warmup census`.

## Tests und Verifikation

- `pnpm check` im Worktree grün (lint, format, test, tsc, `next build` aller Apps), Vault-Lint grün. Das Stop-Gate prüft
  den Haupt-Checkout, nicht den Worktree: das Gate im Worktree selbst laufen lassen.
- Mutationsproben aus Aufgaben 2, 3, 5 und 6, je mit Ergebnis (welcher Test rot) im Bericht.
- Zählung: „an“ gleich vorher (`diff` leer), „aus“ wie in Aufgabe 5 erwartet, Summe des Einschießens 33 (wenn sich
  die Dev-Datenbank nicht geändert hat; sonst die Zahl aus SQL).
- Browser: Dev-Server aus dem Worktree auf Port **3025** (`pnpm --filter spiegel exec next dev --webpack --port 3025`,
  ein geschriebenes `AGENTS.md` danach löschen); der User meldet sich selbst an. Vorher die Daten abgleichen (Lesson
  §9): welches Konto hat welchen Abend mit Einschießen. Telefon (390 und 360 px) und Desktop, hell und dunkel:
  - Scheiben: ein Abend mit Einschießen (Wort unter „Probe“, Zahlen leise, Abstand „–“ mit Grund, die Wertung danach
    mit Abstand ohne das Einschießen); ein Abend nur mit Probe (nur „Probe“, Zahlen normal).
  - Fortschritt „Alles“: Kopf „… Scheiben, N Einschießen nicht gezählt“ mit „?“; Blatt „Filter“ mit Schalter und Hinweis;
    an: Punkte des Einschießens hohl im Verlauf, Kopf ohne Satz, Chip „mit Einschießen“; „Genauer vergleichen“ trägt
    `warmup=1` nach Vergleichen.
  - Start: ein Abend mit Einschießen, falls belegt (sonst „nicht belegt“ mit dem Test aus Aufgabe 7).
  - Eine alte Adresse `/progress?sighters=0`: Vorgabe, kein Fehler.
- Skriptprüfung `pnpm --filter spiegel pruefen` mit eigenem Build **nur auf Signal der Koordination** (Dev-Datenbank und
  Ports teilen sich die Sessions), mit dem Befehl, den die Koordination nennt; danach Demo-Daten zurück, wie die
  Koordination es sagt.

## Offene Punkte für den Koordinator (Empfehlung zuerst)

**Entschieden am 29. Oktober 2026:** Punkt 1 hat der User entschieden: **Variante B**. Einschießen ist nur eine
Scheibe „nur Probe“ vor einer Wertung ihres Abends in ihrer Familie, auch zwischen zwei Wertungen (in der Dev-DB 16); Probe nach der letzten Wertung
zählt wie ein Training. Die Kindsession setzt die im Plan beschriebene Änderung für B um und wartet vor Aufgabe 2 nicht
mehr. Die übrigen Punkte hat der Koordinator so entschieden, wie sie empfohlen sind: Familie statt Disziplin,
Vergleichen übernimmt `warmup=1`, der Satz bleibt im Kopf, eine Scheibe ohne Werte zählt als Wertung,
`als-wertung-gezaehlt` bleibt vorerst, der Rebase des Basisbranchs stellt das Tagebuch auf `card.warmup` um, die
Projektion der geteilten Dev-DB springt hin und her (hinnehmen), 3c und 3e gehen in ein Release. Abweichungen davon
meldet die Kindsession und wartet.

1. **Probe nach der Wertung.** Die freigegebene Regel nennt jede Scheibe „nur Probe“ an einem Abend mit Wertung
   Einschießen, die Texte im Konzept sagen „Probe **vor** einer Wertung“. In der Dev-Datenbank liegen 17 der 33 nur
   **nach** einer Wertung, mit im Schnitt 26 Schuss (10 bis 40), im Median 45 Minuten nach ihr: eher Training im
   Probe-Modus nach einem Wettkampf oder einem Wertungsblock als Warmschießen. **Empfehlung: B, nur Probe vor einer
   Wertung desselben Abends und derselben Familie ist Einschießen.** Dann sind es 16 (je Konto in der Folge oben: 3, 5,
   3, 2, 1, 2, 0), und die Texte des Konzepts stimmen. Änderung im Plan: `WarmupCandidate` bekommt `startedAtMs`, die
   Regel sucht je Familie und Abend den Beginn der letzten Wertung (`startedAtMs < last`), der Fall „Probe nach der
   Wertung“ in Aufgabe 2 kippt, die Texte in Klammern gelten. Die Tagebuch-Auswertung (2c, Regel A) zöge beim Rebase
   mit (Punkt 9). Plan und Zählung sind für A geschrieben, bis der Koordinator entscheidet.
2. **Familie, nicht Disziplin.** Konzept und Koordinationsplan sagen „derselben Disziplin“, der Auftrag „Familie“.
   **Empfehlung: Familie**, wie die Tagebuch-Auswertung (`resultFormCards` filtert nach Familie) und wie Fortschritt und
   Liste zählen (LP 40 als Probe vor LP 60 als Wertung ist Einschießen). Die 33 des Konzepts sind die Zahl nach Familie
   (nach Disziplin wären es 30). In den Texten heißt die Familie wie überall „Disziplin“.
3. **Zahl der Konten:** In der Dev-Datenbank 92 Scheiben „nur Probe“ in 7 Konten, nicht in 10 wie im Konzept
   (sichtbar, mit Familie und Scheibenbild). **Empfehlung:** im Koordinationsplan korrigieren, sonst nichts.
4. **Vergleichen hat kein Blatt „Filter“.** Der Schalter steht nur im Fortschritt; Vergleichen übernimmt `warmup=1`
   über „Genauer vergleichen“, wie heute `sighters`. **Empfehlung:** so lassen, kein neues Bedienelement auf
   Vergleichen.
5. **Ort des Satzes:** Der Kopf (wie heute „N nur Probe nicht gezählt“, Entscheidung 3), nicht die Zeile unter der
   großen Zahl wie in der Skizze. **Empfehlung:** Kopf.
6. **Wort unter der Art statt neben dem Namen:** Die Liste hat keine Spalte mit Namen, die Art steht in der Spalte
   „Art“ (`KindMark`, darunter heute schon die Herkunft). Dasselbe Wort auch in der Liste im Fortschritt und auf den
   Kacheln von Start (eine Sache, ein Wort). **Empfehlung:** so.
7. **Eine Scheibe ohne Werte zählt als Wertung** (ein Scan, der auf die Anlage wartet, ist nicht „nur Probe“, ADR-033),
   wie im Tagebuch. **Empfehlung:** so; ein gescannter Ausdruck ist fast immer die Wertung des Abends.
8. **`FLAG_COUNTED_AS_MATCH`** bleibt Konstante und Kennung, wird nicht mehr ausgewertet. Zwei Scheiben der
   Dev-Datenbank tragen es (beide mit Wertung, gemessen, daneben `ueber-soll`, Herkunft im Code nicht zu finden: kein
   Schreiber setzt es). Sie zählten bei Rekorden nur mit dem alten Schalter an (der Vorgabe) und zählen nach 3c immer:
   mit Vorgabe keine sichtbare Änderung. **Empfehlung:** später entfernen (Kennung, Name in `ListControls`, Fixtures),
   wenn eine Abfrage in Prod (User, nur lesend) 0 oder nur diese beiden zeigt; dazu dort klären, woher sie kommen.
9. **Rebase des Basisbranchs** (nach dem Merge von 3c): `resultFormCards` ruft `overviewCards(db, ownerId, timeZone)`
   (die Zone hat sie schon); `countedCards` in `src/diary/analysis/form.ts` und `src/parts/transfer/diary-preview.ts`
   **auf `card.warmup` umstellen (Empfehlung)**, `FormCard` bekommt `warmup` aus `OverviewCard`, `countedCards` und
   seine Tests fallen weg; so gibt es eine Regel, und eine Entscheidung zu Punkt 1 gilt überall. Dazu
   `src/diary/goals/queries.ts` (`includeProbeOnly: false` im Link → Schlüssel weglassen) und
   `src/diary/goals/measure.ts` (`!card.probeOnly` schließt heute jedes Training im Probe-Modus aus; **Empfehlung:**
   `!card.warmup`, damit Ziel und Fortschritt dieselben Scheiben zählen). `PROJECTION_VERSION` (main 6, Basisbranch 7)
   berührt 3c nicht.
10. **Dev-Server der Kindsession auf der geteilten Dev-Datenbank:** Der Code aus `main` hat `PROJECTION_VERSION` 6, die
    Dev-Datenbank steht auf 7 (Basisbranch). Beim Start rechnet `refreshStaleProjections` alle Projektionen auf 6 um,
    `series` fehlt dann, bis der Haupt-Checkout neu startet und auf 7 zurückrechnet. **Empfehlung:** hinnehmen (so lief
    es schon für 1f), den Haupt-Checkout nach den Prüfungen der Kindsession einmal neu starten.
11. **Treffsicher ändert sich nur im Namen** (`includeWarmup`, `warmupSwitch`), braucht aber ein neues Image im Release
    von 3c. 3e läuft parallel in Treffsicher und berührt `StatisticsScreen.tsx` und `statistics/page.ts` voraussichtlich
    nicht; wenn doch, ist der Konflikt eine Zeile. **Empfehlung:** 3c und 3e in einem Release, Reihenfolge egal.
12. **Demo-Daten:** Beide Zustände kommen aus `tools/private/own-cards.json` (eigene Scheiben, erlaubt als Fixtures).
    Ohne die Datei erzeugt `demoCardSeeds` zufällig, ob es einen Abend nur mit Probe gibt. **Empfehlung:** so lassen;
    die Prüfung sagt dann genau, was fehlt.
13. **Die Seite einer Scheibe** nennt das Einschießen nicht (nicht im Konzept). **Empfehlung:** nicht in 3c.
