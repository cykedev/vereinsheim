# Art auch bei einer Scheibe nur aus Probe wählbar

Kindsession nach ADR-035, koordiniert von `local_d0a9fee5-495e-4599-8b2e-174051d8491e`. Branch `feat/probe-kind-choice`
vom lokalen `main` (3f91dd55). Keine Schemaänderung, keine Migration, keine geschützten Pfade außer der Doku im Vault
(kein ADR berührt). Die Dev-Datenbank ist eine Prod-Kopie: nie zurücksetzen.

## Context

Der User hat viele alte Meyton-Ausdrucke in Prod importiert. Die meisten sind Scheiben nur aus Probe (im Modus Probe
gedruckt), einige davon waren Wettkämpfe. Heute ist eine Scheibe nur aus Probe fest Training: `CardScreen` blendet den
`KindToggle` aus (`probeOnlyCard`), `chooseCardKind` lehnt mit `probeOnly` ab („Eine Scheibe nur aus Probe ist
Training.“). Der User will die Art jeder eigenen Scheibe nachträglich korrigieren können.

Entschieden (Koordinator, nicht wieder aufmachen):

- Der Umschalter der Art steht auf jeder eigenen Scheibe, auch nur aus Probe. `chooseCardKind` setzt `kindChoice` ohne
  Sperre. Ohne Wahl bleibt eine Scheibe nur aus Probe Training: `kindChoice ?? (nur Probe ? training : ranking ?? kind)`.
- „Nur Probe“ bleibt ein eigenes Merkmal. Rekorde zählen eine Scheibe nur aus Probe weiter nur mit „Probe einbeziehen“,
  egal welche Art.
- Eine Scheibe nur aus Probe, die Wettkampf ist, bekommt die amtliche Wertung der Disziplin wie jeder Wettkampf.
- In der Liste zeigt die Art ihr Zeichen (Pokal bei Wettkampf), „Probe“ bleibt als Merkmal daneben sichtbar.
- Die Meldung „Eine Scheibe nur aus Probe ist Training.“ entfällt. Neuer Text nur, wenn es nicht anders geht, Wortlaut
  vorher an den Koordinator.

Bestandsaufnahme (wer die Art liest, und was „nur Probe ⇒ Training“ annimmt):

| Stelle | heute | nach dem Plan |
|---|---|---|
| `kindOfRow` (`apps/spiegel/src/lib/db/reads.ts`) | `kindChoice ?? (probeOnly ? null : ranking) ?? kind`: ohne Wahl die Art der Quelle | ohne Wahl `training` (Vorgabe des Koordinators) |
| `official` in `toOverview`, `toPageCard`, `disciplineOptions` | nur Probe: keine Wertung der Disziplin | nur Probe **und Training**: keine; Wettkampf: die der Disziplin |
| `chooseCardKind` (`cards.ts`) + `setCardKind` | `NOT probeOnly`, Ergebnis `probeOnly` mit Meldung | ohne Sperre, `saved` / `missing` |
| `CardScreen` | `KindToggle` nur ohne nur Probe | immer (eigene Scheibe) |
| `kindOf` / `CardKind` der Anzeige (`shot-ui/period/model.ts`) | Wettkampf geht vor, sonst „probe“: Wettkampf nur aus Probe verliert „Probe“ | vierter Wert `competition-probe` |
| `KindMark` (Liste, Fortschritt) | Pokal **oder** „Probe“ | Pokal und daneben „Probe“ |
| `KIND_TEXT`, `EveningBlock.KIND` (Kopie), `cardMeta`, `CardReadout` | „Training nur Probe“ | dazu „Wettkampf nur Probe“ (Wortlaut zur Freigabe, s. u.); `EveningBlock` nimmt `KIND_TEXT` |
| `CardReadout` Schusszahl | „(Probe als Training)“ | Wettkampf: „(Probe als Wettkampf)“ (Wortlaut zur Freigabe) |
| `cardListModel` `ofCard` (`list/evenings.ts`) | `isProbeOnly ? undefined : official` | nur Probe und Training: undefined |
| `newCardChoices` Vorbelegung (`fetch-card/queries.ts`) | `kindOfRow(last, false)`: die Liste zählt auch bei nur Probe | mit dem echten `probeOnly` der letzten Scheibe |
| Filter Art (Liste, Fortschritt, Vergleichen), `PeriodChart` (Pokal, hohler Punkt) | `card.kind` und `probeOnly` getrennt | unverändert richtig |
| Rekorde (`recordsInView`, `itemRecords`), `projectedValues`, `itemValues`, `compare.ts` | „nur Probe“ unabhängig von der Art | unverändert, ein Test hält es fest |

## Zur Freigabe beim Koordinator

1. **Wortlaut** (neu, folgt dem Muster „Training nur Probe“): „Wettkampf nur Probe“ für Screenreader, Tooltip, Metazeile
   im Kopf der Scheibe, Kachel auf Start, Namen des Links in der Liste und die Ablesung im Fortschritt; „(Probe als
   Wettkampf)“ hinter der Schusszahl in der Ablesung des Fortschritts. Ohne diese Texte stünde bei einem Wettkampf nur aus
   Probe im Kopf, auf Start und in der Ablesung nur „Wettkampf“, das Merkmal „Probe“ fehlte dort.
2. **Folge der amtlichen Wertung:** Hat der Schütze an einer Scheibe nur aus Probe keine Wertung gewählt, gilt heute die
   Wertung wie am Stand. Stellt er sie auf Wettkampf, gilt die Wertung der Disziplin; weicht die vom Stand ab, wechselt
   die gezeigte Wertung mit der Art (die Seite folgt über `seenScoring`). Das ist die einzige Stelle, an der die Art die
   Wertung ändert; bei anderen Scheiben gilt die der Disziplin schon im Training. Eine gewählte Wertung bleibt.
3. **Ohne Wahl Training statt Art der Quelle:** Heute nimmt eine Scheibe nur aus Probe ohne Wahl `Card.kind`. An der
   Vereinsanlage ist `Status` leer, PDF-Importe setzen `kindChoice` training; in Prod ändert sich dadurch nichts
   Sichtbares, nur fremde Anlagen mit `Status` „Wettkampf“ wären betroffen.

## Approach

Die Regel bleibt an einer Stelle: `kindOfRow` für die Art, eine neue reine Funktion `officialOf` in `reads.ts` für die
Wertung der Disziplin (alle drei Zugriffe nehmen sie). `chooseCardKind` wird ein einfaches `updateMany` über die eigene,
sichtbare Scheibe. In `shot-ui` trägt die Anzeige-Art „nur Probe“ weiter mit, auch beim Wettkampf (`kindOf` gibt
`competition-probe`), `KindMark` zeichnet Pokal und „Probe“ nebeneinander. Gleicher Aufbau der Zelle wie bei anderen
Scheiben: erst das Zeichen der Art, dann das Wort.

## Required Docs

- `apps/spiegel/CLAUDE.md` (Art der Scheibe, Wertung), `packages/shot-ui/CLAUDE.md` (KindToggle, KindMark, kindOf)
- `vault/spiegel/spiegel-navigation.md` „Art der Scheibe“, „Art und Wertung als Symbole“
- `vault/spiegel/spiegel-db-schema.md` „Art der Scheibe“, „Art umschalten“
- `vault/spiegel/spiegel-edge-cases.md` SF-01, `vault/conventions.md` §9 (Mocks filtern nach der Bedingung)

## Tasks

Node 26 je Bash-Aufruf: `unfunction pnpm node npm npx corepack 2>/dev/null; export PATH="$HOME/.nvm/versions/node/v26.12.1/bin:$PATH"`.
Gate je Task im Worktree: `pnpm check` (der Stop-Hook prüft den Haupt-Checkout).

### T1 · Regel der Art und der Wertung der Disziplin (`reads.ts`)

- `kindOfRow`: `row.kindChoice ?? (probeOnly ? "training" : (row.ranking?.kind ?? row.kind))`, Kommentar: ohne Wahl ist
  nur Probe Training, die Wahl gilt immer.
- Neu, exportiert: `officialOf(official: Scoring | null, kind: CardKind, probeOnly: boolean)` → `probeOnly && kind !==
  "competition" ? null : official`. Kommentar: die Wertung der Disziplin gilt im Training und im Wettkampf, nur ein
  Training nur aus Probe hat keine (dann wie am Stand).
- `toOverview` und `toPageCard`: erst `kind = kindOfRow(…)`, dann `official = officialOf(row.discipline.officialScoring,
  kind, probeOnly)`.
- `disciplineOptions`: Select um `kind`, `kindChoice`, `ranking: { select: { kind: true } }` erweitern, `kind =
  kindOfRow(card, probeOnly)`, `scoring: scoringOfRow(card, officialOf(row.officialScoring, kind, probeOnly))`.
- Tests `kind.test.ts`: nur Probe ohne Wahl in Wettkampf-Liste und mit Quelle `competition` → `training`; nur Probe mit
  Wahl `competition` → `competition`; `officialOf` alle vier Fälle.
- Test `reads.test.ts` („ein Training nur aus Probe hat keine amtliche Wertung …“) ergänzen: dieselbe Scheibe mit
  `kindChoice: competition` hat `official` `rings` in `familyCards`, `ownerCards`, `cardWithShots`, und
  `disciplineOptions` gibt die Wertung der Disziplin; danach `kindChoice` zurück auf null (`finally`).

### T2 · Art wählen ohne Sperre (`chooseCardKind`, `setCardKind`)

- `cards.ts`: Doc-Kommentar ohne „nur Probe ist immer Training“; Rückgabe `Promise<"saved" | "missing">`;
  `updateMany({ where: own, data: { kindChoice } })`, `count === 1 ? "saved" : "missing"`.
- `card-kind-actions.ts`: Zweig `probeOnly` und Kommentar „bleibt Training“ entfernen.
- Tests gegen die Dev-Datenbank (filtert echt nach der Bedingung, stärker als ein Mock nach §9; Zeilen, die nicht
  zählen dürfen, sind dabei: fremd, gelöscht, unbekannt): `reads.test.ts` „chooseCardKind“: nur Probe → `saved`,
  `kindChoice` `competition`, `familyCards` zeigt die Scheibe als `competition` mit `projection.probeOnly` true;
  `card-kind-actions.test.ts`: „eine Scheibe nur aus Probe bekommt die gewählte Art“ statt der Ablehnung.

### T3 · Vorbelegung der Art im Blatt „Neue Scheibe“ (`fetch-card/queries.ts`)

- Select der letzten Scheibe um `projection: { select: { probeOnly: true } }`, `kindOfRow(last, last.projection?.probeOnly
  ?? false)`. Test in `queries.test.ts`, falls dort die Vorbelegung schon geprüft wird; sonst ein Fall dazu (letzte
  Scheibe nur aus Probe in einer Wettkampf-Liste → Vorbelegung `training`).

### T4 · Anzeige der Art in `shot-ui`

- `period/model.ts`: `CardKind = "training" | "competition" | "probe" | "competition-probe"`; `kindOf`: Wettkampf
  mit nur Probe → `competition-probe`. Kommentare nennen Wettkampf und Training nur aus Probe.
- `list/KindMark.tsx`: `KIND_TEXT["competition-probe"] = "Wettkampf nur Probe"` (nach Freigabe); Zeichen: Pokal bei
  `competition` und `competition-probe`, „Probe“ bei `probe` und `competition-probe`, nebeneinander (Pokal zuerst,
  Abstand `ml-1`), beide `aria-hidden` mit Tooltip, der volle Name einmal `sr-only`. Doc-Kommentar anpassen.
- `start/EveningBlock.tsx`: die Kopie `KIND` durch `KIND_TEXT` ersetzen.
- `list/evenings.ts` `ofCard`: `card.scoring ?? (isProbeOnly(card) && card.kind !== "competition" ? undefined :
  card.official)`.
- `period/CardReadout.tsx`: `(Probe als ${item.kind === "competition" ? "Wettkampf" : "Training"})` (nach Freigabe).
- `NewCardSheet` nimmt `KIND_TEXT[training|competition]`: bleibt.
- Tests: `KindMark.test.tsx` (Wettkampf nur Probe: Pokal und „Probe“, sr-only einmal „Wettkampf nur Probe“),
  `evenings.test.ts` (Zeile `competition-probe`, Wertung der Scheibe die der Disziplin), `CardReadout.test.tsx`
  (`cardKindText` und Schusszahl), `CardList.test.tsx` (data-kind), Test zu `cardMeta` (Metazeile „Wettkampf nur Probe“),
  `EveningBlock`-Test, falls er die Art prüft. Fixture `periodCard(…, { probe: true, kind: "competition" })` in
  `period/testSeason.ts`, falls die Option fehlt.

### T5 · Umschalter auf der Seite (`CardScreen`)

- `KindToggle` ohne Bedingung, Import `probeOnlyCard` entfernen, Kommentar: Art und Wertung als Kreise, auch nur aus
  Probe.
- `CardScreen.test.tsx`: eigene Scheibe nur aus Probe ohne Summen trägt `data-kind-toggle`; mit `kind: "competition"`
  und `official: "rings"` nennt der Wertungskreis die Wertung amtlich (wie bei einem Wettkampf mit Wertung);
  die geteilte zeigt weiter keinen.

### T6 · Rekorde halten (`shot-core`)

- `projection.test.ts` (oder `records`-Test, wo `recordsInView` geprüft ist): Wettkampf nur aus Probe zählt unter `kind:
  "competition"` nicht ohne `includeProbeOnly`, mit schon. Kommentare in `metrics.ts`/`card-shots.ts`, die „nur Probe
  ist Training“ als Art behaupten, sagen „wie Wertung“ (die Rechnung hängt nicht an der Art).

### T7 · Doku

- `vault/spiegel/spiegel-db-schema.md`: „Art der Scheibe“ mit der neuen Regel und `officialOf`; „Art umschalten“ ohne
  Sperre.
- `vault/spiegel/spiegel-navigation.md`: „Art der Scheibe“ (Bedienung: Schalter auf jeder eigenen Scheibe; ohne Wahl ist
  nur Probe Training, die Liste zählt dann nicht; Wettkampf nur aus Probe hat die Wertung der Disziplin), „Ort“ (nur Probe
  nicht mehr „nur der Bruch“), Liste: Pokal und „Probe“ nebeneinander.
- `vault/spiegel/spiegel-edge-cases.md` SF-01 und Leitregel 1: die Art ist wählbar, Rekorde und Verläufe weiter nur mit
  „Probe einbeziehen“ (27. Oktober 2026).
- `apps/spiegel/CLAUDE.md` (Art der Scheibe, Wertung je Scheibe), `packages/shot-ui/CLAUDE.md` (Zeilen `KindToggle`,
  `KindMark`; „die Art aller `kindOf`“). `vault-lint` grün.

### T8 · Plan entfernen

- Letzter Commit löscht `plans/2026-10-27-probe-kind-choice.md`.

## Verification

- `pnpm check` im Worktree grün, `node .claude/vault-lint.mjs` (bzw. `/sync-graph`) grün.
- **Mutationsprobe:** in `chooseCardKind` die Sperre `NOT: { projection: { is: { probeOnly: true } } }` testweise
  zurück → `reads.test.ts` und `card-kind-actions.test.ts` rot; in `officialOf` `kind !== "competition"` durch `true`
  ersetzen → der Test zur amtlichen Wertung rot. Backup per `cp`, nicht `git checkout`.
- **Browser** (Vorschau `spiegel` auf eigenem Port, Konto des Users, er meldet sich selbst an; sonst Demo-Konto):
  eine Scheibe nur aus Probe vom Ausdruck öffnen → Pokal-Kreis da, auf Wettkampf → Metazeile, Wertungskreis „amtlich“;
  Liste mit Filter Art „Wettkampf“ zeigt sie mit Pokal und „Probe“; Fortschritt ohne „Probe einbeziehen“ ohne sie, mit
  ihr; Rekorde unverändert. Danach die Wahl zurück auf null (Dev-Datenbank ist eine Prod-Kopie).
- Nicht im Gate: `pruefen --start` nach `pnpm build` (Art-Kreis, keine Skriptfehler).
