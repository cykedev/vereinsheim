# Ausgeglichene A/B-Verteilung im Liga-Spielplan

**Datum:** 2026-10-03 · **Branch:** `feat/schedule-home-away-balance` · **App:** ringwerk

## 1. Context (warum)

Im Vorrunden-Spielplan einer Best-of-Liga mit 5 Schützen steht ein Schütze in **allen 4**
Begegnungen als „Teilnehmer A“, andere 3× als B (Screenshot des Users, 2026-10-02). Ursache ist die
Circle-Method in `generateBestOfSchedule.ts` und `generateSchedule.ts`. Der Teilnehmer an Position 0
bleibt fest und steht in jeder Runde links, ist also immer A. Für alle anderen hängt die Seite nur
von ihrer momentanen Position im Kreis ab. Die Rückrunde (`DOUBLE_ROUND_ROBIN`) gleicht das über
die ganze Saison aus, **je Runde** aber nicht. Best-of hat keine Rückrunde.

Für die **Wertung** ist A/B bedeutungslos. `scoring/bestOf.ts` und `calculateBestOfStandings`
behandeln beide Seiten symmetrisch (geprüft 2026-10-02). Die Seite ist aber das, was Schützen auf
dem Aushang sehen, und gilt im Verein als „wer ist dran“. Eine ungleiche Verteilung wirkt deshalb
unfair.

## 2. Entscheidungen

**E1: Kanonische Konstruktion statt Nachkorrektur.** Die Paarungen entstehen nach der kanonischen
1-Faktorisierung (de Werra / Berger-Tabelle). Die Teilnehmer `0 … m-1` (`m = n-1`) stehen im Kreis,
der letzte (`∞`) ist fest. In Runde `r` (0-basiert):

- `∞` spielt gegen `r`. `∞` ist A, wenn `r` gerade ist, sonst B.
- Für `i = 1 … n/2-1` spielen `(r+i) mod m` und `(r-i) mod m`. A ist `(r+i)` bei ungeradem `i`,
  sonst `(r-i)`.

Bei ungerader Teilnehmerzahl ist `∞` der Dummy, seine Begegnung ist das Freilos (`awayId = null`,
`homeId` = der echte Teilnehmer, wie bisher).

**Prototyp für n = 2 … 30** (`node`, Session 2026-10-03):

- Jede Paarung kommt genau einmal vor.
- Niemand spielt zweimal am selben Spieltag.
- Jeder hat genau ein Freilos.
- Die Seiten sind ausgeglichen:
  - ungerades n: jeder genau gleich oft A wie B;
  - gerades n: |A − B| ≤ 1. Mehr ist nicht möglich, weil jeder `n-1` Begegnungen hat, also eine
    ungerade Zahl.

Verworfen wurde eine gierige Nachkorrektur („wer seltener A war, wird A“). Der Prototyp ließ
dabei für n = 5, 9, 13, 17, 21 Schützen bei ±2 stehen.

**E2: Eine Quelle für beide Formate.** Neue reine Funktion `roundRobinRounds(participantIds)` in
`lib/matchups/roundRobin.ts`. `generateBestOfSchedule` gibt ihr Ergebnis unverändert zurück.
`generateSchedule` nimmt es als Hinrunde und spiegelt es für die Rückrunde (A ↔ B, Freilose
bleiben). Damit ist jede Runde für sich ausgeglichen, und über die Saison spielt jedes Paar genau
einmal je Seite.

**E3: Bestehende Spielpläne bleiben unverändert.** Die Änderung wirkt nur bei der Generierung.
Neu generieren lässt sich ein Spielplan wie bisher nur, solange keine Paarung abgeschlossen ist
(`generateCompetitionSchedule`). Laufende Ligen mit Ergebnissen behalten ihre Verteilung. Ein
Umschreiben von A/B auf bestehende Paarungen ist **nicht** Teil dieses Plans: An Serien und
Duellen hängt die Zuordnung zu Teilnehmern, das wäre ein eigener, riskanter Eingriff.

**E4: Andere Reihenfolge der Paarungen ist in Ordnung.** Welche Begegnung an welchem Spieltag
stattfindet, ändert sich gegenüber der alten Circle-Method. Fachlich verlangt ist nur „jeder gegen
jeden, ein Spieltag ohne Doppelbelegung“. Die bestehenden Tests prüfen genau diese Eigenschaften
und keine konkrete Reihenfolge.

## 3. Dateien

| Datei | Änderung |
| --- | --- |
| `apps/ringwerk/src/lib/matchups/roundRobin.ts` (neu) | `roundRobinRounds` |
| `apps/ringwerk/src/lib/matchups/roundRobin.test.ts` (neu) | Eigenschaften n = 2 … 16 |
| `apps/ringwerk/src/lib/matchups/generateBestOfSchedule.ts` | delegiert an `roundRobinRounds` |
| `apps/ringwerk/src/lib/matchups/generateBestOfSchedule.test.ts` | + Balance-Test (5 Schützen, Screenshot-Fall) |
| `apps/ringwerk/src/lib/matchups/generateSchedule.ts` | Hinrunde aus `roundRobinRounds`, Rückrunde gespiegelt |
| `apps/ringwerk/src/lib/matchups/generateSchedule.test.ts` | + Balance je Runde |
| `vault/apps/ringwerk/league-mode.md` | Spielplan-Konstruktion + Balance |

## Required Docs

- `vault/apps/ringwerk/league-mode.md`
- `vault/conventions.md` §9 (Charakterisierungstests müssen die falsche Quelle erkennen können)

## 4. Tasks

### Task 1: `roundRobinRounds` (Test zuerst)

`roundRobin.test.ts`, für jedes `n` von 2 bis 16 (`ids = p0 … p{n-1}`):

- Jede ungeordnete Paarung echter Teilnehmer kommt genau einmal vor (`n(n-1)/2`).
- Je `roundIndex` taucht jeder Teilnehmer höchstens einmal auf. Die Spieltage laufen `1 … m` mit
  `m = n-1` (gerade) bzw. `n` (ungerade).
- Ungerades n: Jeder hat genau ein Freilos. Gerades n: kein Freilos.
- Balance: Ungerades n ergibt für jeden `A − B = 0`, gerades n ergibt `|A − B| ≤ 1`.
- `n < 2` liefert `[]`.

Ein Zusatztest pinnt den Fall aus dem Screenshot gegen die alte Konstruktion: 5 Schützen, und
**keiner** ist in allen seinen Begegnungen A.

Implementierung wie E1:

```ts
export interface RoundRobinMatch {
  homeId: string
  awayId: string | null // null = Freilos (BYE)
  roundIndex: number // 1-basiert (= Spieltag)
}

/**
 * Einfachrunde „jeder gegen jeden“ mit ausgeglichener A/B-Verteilung (kanonische
 * 1-Faktorisierung, Berger-Tabelle): bei ungerader Teilnehmerzahl ist jeder genau gleich oft A
 * wie B, bei gerader höchstens einmal öfter. Bei ungerader Zahl erhält jeder genau ein Freilos.
 */
export function roundRobinRounds(participantIds: string[]): RoundRobinMatch[]
```

Commit: `feat(ringwerk): add a balanced round-robin construction`.

### Task 2: `generateBestOfSchedule` delegiert

Der Rumpf wird zu `return roundRobinRounds(participantIds)`. Der Kopfkommentar beschreibt die
Konstruktion samt Balance. `BestOfMatchup` bleibt als Typ-Alias von `RoundRobinMatch` exportiert,
damit `actions.ts` unverändert bleibt.

Neuer Test in `generateBestOfSchedule.test.ts`: Für 5 Teilnehmer ist jeder 2× A und 2× B. Er ist
vor der Umstellung rot (alte Konstruktion: `a` 4× A), danach grün. Den roten Lauf vor der
Implementierung beobachten.

Commit: `fix(ringwerk): balance sides in best-of league schedules`.

### Task 3: `generateSchedule` (Doppelrunde)

Die Hinrunde wird aus `roundRobinRounds` gemappt (`round: "FIRST_LEG"`). Die Rückrunde spiegelt
jede Hinrunden-Paarung (`homeId ↔ awayId`, `round: "SECOND_LEG"`, gleicher `roundIndex`).
Freilose bleiben ungespiegelt (`homeId` = Teilnehmer, `awayId = null`), wie heute. Kopfkommentar
anpassen.

Neuer Test: 5 Teilnehmer, Hinrunde je Teilnehmer 2× A / 2× B. Er ist vor der Umstellung rot.
Bestehende Tests (Spiegelung, ein Freilos je Runde, jeder gegen jeden) bleiben unverändert grün.

Commit: `fix(ringwerk): balance sides per leg in double round-robin schedules`.

### Task 4: Doku

`vault/apps/ringwerk/league-mode.md`: Spielplan-Abschnitt bzw. TL;DR von „Circle-Method“ auf
„kanonische Konstruktion (Berger-Tabelle) mit ausgeglichener A/B-Verteilung“ umstellen, E1/E3
kurz festhalten, `keywords:` um `Heimrecht, Seitenverteilung, Berger-Tabelle, A/B-Ausgleich`
ergänzen. Danach `node .claude/vault-lint.mjs`.

Commit: `docs(vault): describe the balanced schedule construction`.

## 5. Verification

1. `pnpm check`: alle fünf Gates grün.
2. Dev-Server, Testliga mit 5 Teilnehmern (Dev-DB, eigene Testdaten): Matchups löschen bzw. eine
   neue Liga ohne Ergebnisse anlegen, über die UI „Spielplan generieren“, dann per SQL je
   Teilnehmer A/B zählen. Erwartet: jeder 2/2. Dasselbe mit 4 Teilnehmern: jeder 2/1 oder 1/2.
3. Den Spielplan in der UI ansehen: Spalten Teilnehmer A/B, Freilose, Spieltage plausibel.
