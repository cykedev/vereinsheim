# Ringwerk: Regelset einer Liga bearbeitbar, bis ein Ergebnis eingetragen ist

## Context

Heute sperrt Ringwerk Wertungsmodus, Format, Best-of-Einstellungen und Schuss/Serie einer Liga, sobald ein Spielplan
existiert (`matchupCount > 0`, in `edit/page.tsx` und `actions/update.ts`). Eine frisch generierte Liga ohne ein
einziges Ergebnis lässt sich damit nicht mehr umstellen; der einzige Weg wäre, sie neu anzulegen.

Der User will: Das Regelset bleibt bearbeitbar, **solange kein Ergebnis eingetragen ist**. Ändert sich dabei etwas,
das die Paarungen selbst betrifft, wird der Spielplan neu erzeugt.

Die Grenze „kein Ergebnis“ gibt es schon: `scheduleRegenerationBlocker` in `lib/matchups/regeneration.ts` (entschiedene
Paarungen, Kampflos-Siege, Serien an Paarungen, Playoffs). Sie sperrt heute „Spielplan neu generieren“. Die
Bearbeitungssperre hängt künftig an derselben Regel, sodass beide nie auseinanderlaufen.

## Approach

**Was eine Neugenerierung braucht und was nicht.** Nur das **Format** (Doppelrunde ↔ Best-of-Begegnung) ändert die
Paarungen selbst: Hin- und Rückrunde gegen eine einzige Runde. Wertungsmodus, Best-of-Zahl, „Alle Duelle ausspielen“,
Tiebreaker und Schuss/Serie bestimmen nur, wie Ergebnisse gewertet werden. Ohne Ergebnis ändern sie nichts am
Spielplan; sie werden gespeichert, der Spielplan bleibt.

**Formatwechsel mit Spielplan.** Speichern ändert die Einstellungen und erzeugt den Spielplan im neuen Format neu, in
**einer** serialisierbaren Transaktion mit der Prüfung „kein Ergebnis“ (Konvention §9 „Prüfen und Löschen gehören in
dieselbe Transaktion“). Scheitert die Neugenerierung (etwa weniger als 4 aktive Teilnehmer, Liga nicht aktiv), rollt
die ganze Transaktion zurück: Einstellungen und alter Spielplan bleiben, der User sieht den Grund.

Vor dem Speichern fragt ein `DecisionDialog` (Kein Knopf ohne Folge). Die Action verlangt dafür ein Feld
`replaceSchedule=true`. Fehlt es, obwohl ein Spielplan besteht (etwa weil ein anderer Manager ihn erzeugt hat,
während das Formular offen war), lehnt sie ab, statt still einen Spielplan zu ersetzen.

**Eine Quelle für die Neugenerierung.** Der Kern von `generateCompetitionSchedule` (Prüfen, Löschen, Anlegen,
Protokoll) wandert in eine Funktion `replaceSchedule(tx, competitionId, userId)`, die eine Transaktion nimmt. Die
Action „Spielplan neu generieren“ und das Speichern rufen dieselbe Funktion; die bestehenden Tests von
`generateCompetitionSchedule` halten das Verhalten fest.

**Disziplin** bleibt nach dem Anlegen fix (unverändert, eigener Grund: Faktor-Korrektur, Einschreibungen).

### Oberfläche (Konzept zur Freigabe)

Seite „Wettbewerb bearbeiten“ einer Liga, Kasten „Regelset“:

| Zustand | Wertungsmodus, Format, Gruppenphase, Schuss/Serie | Hinweis über dem Format |
| --- | --- | --- |
| kein Spielplan | bearbeitbar | – |
| Spielplan, kein Ergebnis | bearbeitbar | „Es gibt schon einen Spielplan. Ein anderes Format erzeugt ihn beim Speichern neu.“ |
| Ergebnis eingetragen | gesperrt (wie heute) | Schloss: „Regelset gesperrt: Es sind schon Ergebnisse eingetragen.“ |

Wird das Format bei bestehendem Spielplan geändert, fragt „Speichern“ zuerst (Wortlaut zur Freigabe, kommt zuerst ins
Textbuch, Abschnitt 16):

- **Titel:** Format ändern und Spielplan neu generieren?
- **Worum:** Die Liga hat einen Spielplan. Noch ist kein Ergebnis eingetragen. Das Format wechselt von
  „Doppelrunde“ zu „Best-of-Begegnung“. *(bzw. umgekehrt)*
- **Vorher prüfen:** Ist der Spielplan schon verteilt oder ausgedruckt? Dann ist er danach veraltet.
- **Was passiert:**
  - Die Einstellungen werden gespeichert.
  - Der bisherige Spielplan wird gelöscht.
  - Ringwerk erstellt ihn neu für alle aktiven Teilnehmer: eine Runde, jeder gegen jeden. *(Doppelrunde: Hin- und
    Rückrunde, jeder gegen jeden.)* Spieltage und Gegner können sich dabei ändern.
  - Im Protokoll des Wettbewerbs steht danach ein Eintrag.
- **Was nicht passiert:** Einschreibungen bleiben.
- **Rückgängig:** Nicht möglich. Das Format zurückzustellen erzeugt wieder einen neuen Spielplan, nicht den alten.
- **Knopf:** Speichern und Spielplan neu generieren (destruktiv)

Ändert sich nur der Wertungsmodus oder eine andere Einstellung, speichert der Knopf ohne Rückfrage wie heute.

## Files

- `apps/ringwerk/src/lib/matchups/regeneration.ts` — neue reine Funktion `isRulesetLocked(counts)`.
- `apps/ringwerk/src/lib/matchups/replaceSchedule.ts` — **neu**, Kern der Neugenerierung mit Transaktion als Parameter.
- `apps/ringwerk/src/lib/matchups/actions.ts` — `generateCompetitionSchedule` ruft `replaceSchedule`.
- `apps/ringwerk/src/lib/competitions/actions/update.ts` — Sperre aus den Ergebnissen, Transaktion, Formatwechsel.
- `apps/ringwerk/src/app/(app)/competitions/[id]/edit/page.tsx` — `getScheduleStatus` statt `_count.matchups`.
- `apps/ringwerk/src/components/app/competitions/CompetitionForm.tsx` — Props, Rückfrage beim Formatwechsel.
- `apps/ringwerk/src/components/app/competitions/competition-form/BasicFieldsSection.tsx` — Sperre des Wertungsmodus.
- `apps/ringwerk/src/components/app/competitions/competition-form/LeagueFieldsSection.tsx` — Props durchreichen.
- `apps/ringwerk/src/components/app/competitions/competition-form/LeagueGroupPhaseFieldset.tsx` — Sperre, Hinweise.
- `apps/ringwerk/src/lib/consequences.ts` — `leagueFormatChange({ from, to })`.
- Tests: `regeneration.test.ts`, `matchups/actions.test.ts` (Regression), `competitions/actions.test.ts`,
  `consequences.test.ts`, `LeagueGroupPhaseFieldset.test.tsx`.
- Doku: `vault/_attachments/textbuch-ringwerk-treffsicher.md` (Abschnitt 16),
  `vault/apps/ringwerk/phase-locking-and-editability.md`, Abschnitt „Konfiguration“ in
  `vault/apps/ringwerk/ringwerk-features.md` (falls die Sperre dort beschrieben ist).

## Required Docs

- `apps/ringwerk/CLAUDE.md`
- `vault/conventions.md` §2 (Bestätigungen), §6 (ActionResult), §9 („Prüfen und Löschen gehören in dieselbe
  Transaktion“, „Mocks für Abfragen filtern nach der Bedingung“, „Formulare mit Server Action gesteuert halten“,
  „Eine Sperre prüft ein Test mit einer Transaktion, die sie hält“), §10 (Kein Knopf ohne Folge, So schreiben wir)
- `vault/apps/ringwerk/phase-locking-and-editability.md`, `vault/apps/ringwerk/league-mode.md`
- `apps/ringwerk/src/lib/serializable.ts` (Wiederholung nur sicher, wenn `fn` alles selbst in der Transaktion liest)

## Tasks

### 1. Textbuch: Wortlaut der Rückfrage

In `vault/_attachments/textbuch-ringwerk-treffsicher.md`, Abschnitt „16. Spielplan generieren und neu generieren“,
einen Unterabschnitt „Format ändern bei bestehendem Spielplan“ anlegen: Ort (Wettbewerb bearbeiten, Kasten Regelset,
Knopf „Speichern“), der Wortlaut aus „Oberfläche“ oben (beide Richtungen), dazu die zwei Hinweistexte des Kastens.
Commit `docs(vault): wording for changing the league format with a schedule`.

### 2. Reine Regel `isRulesetLocked`

`regeneration.ts`:

```ts
/** Ob das Regelset einer Liga gesperrt ist: dieselbe Grenze wie für „Spielplan neu generieren“ (ein Ergebnis existiert) */
export function isRulesetLocked(c: ScheduleResultCounts): boolean {
  return scheduleRegenerationBlocker(c) !== null
}
```

Test in `regeneration.test.ts`: `false` für alle Zähler 0; `true`, wenn je einer von `completed`, `walkover`,
`series`, `playoffs` 1 ist (vier Fälle). Commit `feat(ringwerk): ruleset lock follows the result lock`.

### 3. `replaceSchedule` aus `generateCompetitionSchedule` herauslösen

Neue Datei `lib/matchups/replaceSchedule.ts` (kein `"use server"`, exportiert eine Funktion, die keine Action ist):

```ts
import type { Prisma } from "@/generated/prisma/client"
export async function replaceSchedule(
  tx: Prisma.TransactionClient,
  competitionId: string,
  userId: string
): Promise<string | null>
```

Inhalt: der heutige Körper der Transaktion aus `actions.ts` Zeilen 39–113 unverändert (Wettbewerb lesen, `ACTIVE`,
mindestens 4 aktive Einschreibungen, `scheduleRegenerationBlocker(await getScheduleResultCounts(competitionId, tx))`,
Paarungen nach `leagueFormat`, `deleteMany` mit `series: { none: {} }`, `createMany`, Protokoll
`SCHEDULE_GENERATED`/`SCHEDULE_REGENERATED`). Alle Prüfungen laufen vor dem ersten Schreiben, damit ein Problem nichts
hinterlässt. Den Kommentar zu Sperre, Löschen und Anlegen mitnehmen.

`generateCompetitionSchedule` wird zu `problem = await serializable((tx) => replaceSchedule(tx, competitionId,
session.user.id))`; Fehlerbehandlung, `revalidatePath` und `revalidatePublicPdf` bleiben.

Prüfen: `pnpm --filter ringwerk exec vitest run src/lib/matchups` grün, ohne Teständerung.
Commit `refactor(ringwerk): schedule replacement takes a transaction`.

### 4. `updateCompetition`: Sperre aus den Ergebnissen, Formatwechsel in der Transaktion

In `actions/update.ts`:

1. Parsen (`BaseSchema.safeParse`) und die Passwort-Hash-Berechnung (bcrypt) bleiben **vor** der Transaktion (kein
   bcrypt in einer Transaktion, die wiederholt wird). `replaceSchedule: formData.get("replaceSchedule") === "true"`
   lesen.
2. Den Slug-Konflikt weiter vorher prüfen wie heute (braucht `competition.status`; dafür den Wettbewerb vorher lesen
   wie heute, in der Transaktion aber erneut).
3. Der Rest läuft in `serializable(async (tx) => { … })`:
   - Wettbewerb lesen (Felder wie heute plus `leagueFormat`), `counts = await getScheduleResultCounts(id, tx)`,
     `matchupCount = await tx.matchup.count({ where: { competitionId: id } })`,
     `playoffsStarted = counts.playoffs > 0` (statt eigenem `playoffMatch.count`).
   - `rulesetLocked = isRulesetLocked(counts)`.
   - `formatChanges = type === "LEAGUE" && !rulesetLocked && parsed.data.leagueFormat !== undefined &&
     parsed.data.leagueFormat !== competition.leagueFormat`.
   - `mustReplace = formatChanges && matchupCount > 0`. Ist `mustReplace` und fehlt `replaceSchedule`, zurückgeben:
     `"Inzwischen gibt es einen Spielplan. Bitte die Seite neu laden und noch einmal speichern."` (nichts geschrieben).
   - `tx.competition.update(…)` mit denselben Feldern wie heute; alle Stellen, die `rulesetLocked` nutzen, bleiben,
     nur die Quelle ändert sich.
   - `tx.auditLog.create(…)` für `COMPETITION_UPDATED` wie heute, `details` zusätzlich `leagueFormat` (neuer Wert bei
     `formatChanges`, sonst der gespeicherte).
   - Ist `mustReplace`: `const problem = await replaceSchedule(tx, id, session.user.id)`; bei `problem` eine
     `ScheduleReplaceError(problem)` (kleine lokale Klasse) werfen, damit Postgres alles zurückrollt.
   - Rückgabe `null`.
4. Außerhalb: `ScheduleReplaceError` → `{ error: "Format nicht geändert: " + message }`; `isConflict` →
   `{ error: "Der Wettbewerb wurde gleichzeitig geändert. Bitte die Seite neu laden und es noch einmal versuchen." }`;
   sonst `console.error` und `{ error: "Wettbewerb konnte nicht gespeichert werden. Bitte erneut versuchen." }`.
5. Nach Erfolg wie heute `revalidatePublicPdf(id)` und `revalidateCompetitionPaths()`; bei `mustReplace` zusätzlich
   `revalidatePath(`/competitions/${id}/schedule`)` und `revalidatePath(`/competitions/${id}/participants`)` (wie die
   Action „Spielplan generieren“).

Den Kommentar „Group phase / format is locked once a schedule (matchups) exists.“ ersetzen durch die neue Regel (mit
Verweis auf `isRulesetLocked`), ebenso „BEST_OF_SINGLE group-phase config — locked once a schedule exists“.

Tests in `competitions/actions.test.ts` (Mock `db.$transaction` ruft `fn(txMock)`; `matchup.count` filtert nach
`where.status` wie Prisma, Konvention §9, damit die Sperre wirklich an den Ergebnissen hängt; `series.count` als Mock
dazu):

- **ersetzen** „sperrt die Gruppenphase weiter bei Paarungen …“ durch zwei Fälle:
  - Paarungen da, kein Ergebnis → `scoringMode: "RINGS"` und `shotsPerSeries: 40` werden geschrieben, Playoff-Felder
    auch; `replaceSchedule` wird nicht aufgerufen (Format gleich).
  - eine Paarung `COMPLETED` → `scoringMode`, `shotsPerSeries`, `leagueFormat` sind `undefined`.
  - je ein Fall für eine Serie an einer offenen Paarung und einen Kampflos-Sieg: gesperrt.
- Formatwechsel DRR → Best-of, Paarungen da, kein Ergebnis, `replaceSchedule=true` → `leagueFormat:
  "BEST_OF_SINGLE"` geschrieben, `replaceSchedule` (gemockt über `vi.mock("@/lib/matchups/replaceSchedule")`) mit
  `("c1", userId)` aufgerufen, Ergebnis `success`.
- dasselbe ohne `replaceSchedule=true` → Fehlertext „Inzwischen gibt es einen Spielplan …“, kein `update`.
- Formatwechsel ohne Paarungen → `leagueFormat` geschrieben, `replaceSchedule` nicht aufgerufen.
- `replaceSchedule` liefert „Mindestens 4 aktive Teilnehmer …“ → Ergebnis `{ error: "Format nicht geändert: …" }`,
  und die Transaktion wurde mit einem Fehler verlassen (Mock von `$transaction` sieht die Ausnahme).
- Gegenprobe (nicht committen): `isRulesetLocked` testweise durch `matchupCount > 0` ersetzen → die Fälle „Paarungen
  da, kein Ergebnis“ müssen rot werden; aus Backup zurückkopieren.

Die übrigen `updateCompetition`-Tests an die Transaktion anpassen (gleiche Erwartungen, Mocks über `txMock`).
Commit `feat(ringwerk): edit a league's ruleset until a result exists`.

### 5. Seite und Formular

`edit/page.tsx`: `getScheduleStatus(id)` in das `Promise.all`; an `CompetitionForm` statt `hasMatchups`:
`hasSchedule={schedule.hasSchedule}` und `rulesetLocked={schedule.regenerationBlocker !== null}`. (Für Event und
Saison ist beides `false`, `getScheduleStatus` zählt dort 0.)

`CompetitionForm.tsx`:
- Props `hasMatchups` → `hasSchedule` und `rulesetLocked` (Doku-Kommentare anpassen).
- `const needsReplace = hasSchedule && !rulesetLocked && competition?.type === "LEAGUE" && form.leagueFormat !==
  competition.leagueFormat`.
- `useRef<HTMLFormElement>`, Zustand `replaceOpen`, `replaceConfirmed`.
- `onSubmit`: ist `needsReplace && !replaceConfirmed` → `e.preventDefault()`, `setReplaceOpen(true)`, return; sonst
  `setSubmitted(true)`.
- Verstecktes Feld `<input type="hidden" name="replaceSchedule" value={replaceConfirmed ? "true" : ""} />`.
- Zweiter `DecisionDialog` mit `leagueFormatChange({ from: competition.leagueFormat, to: form.leagueFormat })`;
  `onConfirm`: `flushSync(() => setReplaceConfirmed(true))`, Dialog schließen, `formRef.current?.requestSubmit()`.
- Wechselt das Format zurück oder scheitert das Speichern, `replaceConfirmed` zurücksetzen (Effekt auf
  `form.leagueFormat` und auf einen Fehler im Zustand).

`BasicFieldsSection.tsx`: Prop `hasMatchups` → `rulesetLocked`; Sperre des Wertungsmodus
`isPending || (rulesetLocked && (type === "LEAGUE" || competition?.type === "LEAGUE"))`.

`LeagueFieldsSection.tsx`: Props durchreichen (`hasSchedule`, `rulesetLocked`).

`LeagueGroupPhaseFieldset.tsx`: Props `hasSchedule`, `rulesetLocked`; `<fieldset disabled={rulesetLocked ||
isPending}>`; gesperrt der Hinweis mit Schloss „Regelset gesperrt: Es sind schon Ergebnisse eingetragen.“; bei
`hasSchedule && !rulesetLocked` unter dem Format `text-xs text-muted-foreground`: „Es gibt schon einen Spielplan. Ein
anderes Format erzeugt ihn beim Speichern neu.“ Kopfkommentar anpassen („gesperrt, sobald ein Ergebnis existiert“).

Tests `LeagueGroupPhaseFieldset.test.tsx` (`renderToStaticMarkup`, Konvention §9): bestehenden Fall auf die neuen
Props umstellen; neu: gesperrt → `disabled` am fieldset und Text „Regelset gesperrt“; Spielplan ohne Ergebnis → kein
`disabled`, Text „Ein anderes Format erzeugt ihn beim Speichern neu“; kein Spielplan → keiner der beiden Texte.

Commit `feat(ringwerk): ask before a format change replaces the schedule`.

### 6. Folgen-Text

`consequences.ts`, Abschnitt Spielplan:

```ts
export function leagueFormatChange({ from, to }: { from: LeagueFormat; to: LeagueFormat }): Decision
```

Wortlaut genau wie im Textbuch (Task 1); die Namen der Formate „Doppelrunde“ und „Best-of-Begegnung“; der Satz über
die neue Runde nach `to` wie in `scheduleGenerate`. `destructive: true`.

`consequences.test.ts`: in die Liste aller Entscheidungen aufnehmen (alte Wörter, Semikolons), ein Test hält den
Wortlaut beider Richtungen. Teil des Commits aus Task 5 oder eigener Commit davor.

### 7. Vault

- `vault/apps/ringwerk/phase-locking-and-editability.md`: TL;DR „Regelset einer Liga gesperrt, sobald ein Ergebnis
  existiert (`isRulesetLocked`, dieselbe Grenze wie ‚Spielplan neu generieren‘); ein Formatwechsel mit Spielplan
  erzeugt ihn beim Speichern neu. Playoff-Einstellungen bis Playoff-Start.“ Body: welche Felder, warum nur das Format
  eine Neugenerierung braucht, Transaktion und `replaceSchedule=true`. `keywords:` um „Formatwechsel, Spielplan neu
  erzeugen, Ergebnis“ ergänzen (einzeilig, kein Prettier auf den Vault).
- `ringwerk-features` Abschnitt „Konfiguration“ prüfen und den Satz zur Sperre angleichen.
- `/sync-graph`.
Commit `docs(vault): ruleset lock follows results`.

## Verification

1. `pnpm check` grün (lint, format:check, test, tsc, next build) — Stop-Gate.
2. Gegenprobe aus Task 4 dokumentiert (rot mit alter Regel).
3. Browser, Dev-DB (Kopie von Prod) mit einer Liga mit Spielplan und ohne Ergebnis (etwa „1 gegen 1: LG-Auflage“,
   falls dort noch keins steht; sonst eine Prüfdaten-Liga im Zustand `L1`):
   - Bearbeiten: Wertungsmodus und Format bedienbar, Hinweis „Es gibt schon einen Spielplan …“ sichtbar.
   - Nur Wertungsmodus ändern → Speichern ohne Rückfrage; Spielplan unverändert (gleiche Paarungen), Tabelle zeigt
     den neuen Modus.
   - Format auf Best-of → Speichern fragt mit dem Dialog; Abbrechen speichert nichts; Bestätigen → Spielplan eine
     Runde, Protokoll mit „Spielplan neu generiert“ und „Wettbewerb geändert“; zurück auf Doppelrunde → Hin- und
     Rückrunde.
   - Ein Ergebnis eintragen → Bearbeiten zeigt das Schloss, Felder gesperrt; ein manuell gebautes Formular mit
     anderem Format ändert serverseitig nichts (Feld bleibt `undefined`).
   - Am Telefon (390 px): Dialog und Hinweis ohne seitliches Scrollen.
4. Bericht unter `reports/` (Validate), was davon mangels Daten „nicht belegt“ ist.

Ringwerk ist produktiv: eigener Release nach dem Merge; keine Migration, keine neue Brücke nötig.
