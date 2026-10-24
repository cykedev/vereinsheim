# Spiegel: Disziplin einer Scheibe ändern

## Context

Der User (24. Oktober 2026): „wenn z. B. Auflage auf einer LP-Scheibe geschossen wurde, dann will ich das manuell
ändern können.“ Die Disziplin, die am Stand in Meyton gewählt ist, bestimmt in Spiegel die Familie (Luftpistole oder
Luftpistole Auflage), die Schusszahl und die Wertung der Disziplin. Steht am Stand die falsche, landet die Scheibe in
der falschen Familie: in Liste, Fortschritt, Rekorden und auf Start. Heute kann nur der Admin eine ganze Disziplin
umordnen ([[spiegel-target-library]]), nie eine einzelne Scheibe.

Heute gilt: Jeder Stand schreibt `Card.disciplineId` neu (`cardFeatures` in `writeRevision`), auch das Neu-Lesen
(`rereadOutdatedKeys`). Eine Wahl braucht deshalb einen Platz, den kein Stand anfasst, wie `kindChoice` und
`scoringChoice`.

## Approach

- **D1 Wo die Wahl steht:** `Card.disciplineId` bleibt die Disziplin, mit der Spiegel überall rechnet (Familie für den
  Index, Scheibenbild, Schusszahl, Gegenprobe, Zählen im Admin, `SHOWN_DISCIPLINE`). Neu ist `Card.sourceDisciplineId
  Int?`: die Disziplin aus Meyton, solange der Schütze eine andere gewählt hat; null heißt keine eigene Wahl. So bleiben
  alle Abfragen, Joins und Filter, wie sie sind. Verworfen: eine Spalte `disciplineChoiceId`, die jede Abfrage als
  `choice ?? disciplineId` lesen müsste (Familie im Index, `VISIBLE_CARD`, `refreshDisciplineCards`, Admin-Zahlen).
- **D2 Jeder Stand respektiert die Wahl:** `writeRevision` liest zuerst die vorhandene Scheibe. Hat sie eine Wahl
  (`sourceDisciplineId` nicht null), bleibt `disciplineId` die gewählte; `sourceDisciplineId` bekommt die Disziplin des
  Stands. Ist die des Stands gleich der gewählten (Meyton nachträglich richtig), fällt die Wahl weg (null). Die Merkmale
  rechnet dann `recomputeDisciplineCard` in derselben Transaktion mit der gewählten Disziplin neu (Gegenprobe,
  Schusszahl, `complete`, Projektion), statt der Merkmale, die der Adapter mit der Disziplin aus Meyton gerechnet hat.
- **D3 Wählbar** sind die Disziplinen der Anlage mit demselben Scheibenbild wie die aus Meyton, nicht ignoriert. Die Werte
  bleiben, wie Meyton sie gemessen hat; mit einem anderen Scheibenbild stünden die Treffer auf Ringen, mit denen Meyton
  nicht gewertet hat. Hat die Disziplin aus Meyton kein Scheibenbild, gibt es keine Wahl (der Admin ordnet sie erst
  ein). Gruppiert nach Familie, sortiert nach Familie und Name; die aktuelle steht vorn markiert.
- **D4 Zurück:** Die Disziplin aus Meyton zu wählen hebt die Wahl auf (`sourceDisciplineId` null).
- **D5 Wer:** nur die eigene, sichtbare Scheibe (`VISIBLE_CARD`), auch Admins nur ihre eigenen; nicht auf der geteilten
  Seite. Unter der Sperre wie `writeRevision` (Advisory-Lock Quelle und ScheibenID, dann die Zeile).
- **D6 Folgen:** Die Familie zieht mit (Liste, Fortschritt, Rekorde, Start); gewählte Wertung und Art bleiben; die
  Wertung der Scheibe folgt der Vorgabe der neuen Disziplin, wenn keine gewählt ist. An der Meyton-Anlage ändert sich
  nichts. Rückgängig: die Disziplin aus Meyton wieder wählen.
- **D7 Oberfläche:** am Ende der Seite einer Scheibe, über Teilen, ein Abschnitt „Disziplin“: der Name, bei eigener Wahl
  darunter leise „An der Anlage: LP 40“. Der Knopf „Disziplin ändern“ öffnet ein Blatt (`Sheet` aus Design 2) mit den
  Möglichkeiten als Liste von Knöpfen je Familie; die Wahl öffnet die Rückfrage (`DecisionDialog`, Texte aus
  `consequences.ts`). Nach dem Speichern `router.refresh()`. Ohne Wahlmöglichkeit (keine andere Disziplin mit demselben
  Scheibenbild) zeigt der Abschnitt nur den Namen.
- **D8 Texte** (neu, vom User fürs Textbuch zu lesen), nach den Schreibregeln:
  - Titel „Disziplin ändern?“; about „Die Scheibe vom Di 13.10.2026 um 19:12 hat die Disziplin LP 40. Du stellst sie
    auf LP 40 Auflage.“
  - check „Wähle die Disziplin, die du wirklich geschossen hast.“
  - happens: „Die Scheibe zählt dann bei Luftpistole Auflage. Das gilt in Liste, Fortschritt und Rekorden.“ (nur bei
    anderer Familie); „Spiegel prüft die Schusszahl mit der neuen Disziplin.“; „Spätere Stände aus Meyton ändern das
    nicht mehr.“
  - notHappening: „Die Werte der Schüsse bleiben, wie Meyton sie gemessen hat.“, „An der Meyton-Anlage ändert sich
    nichts.“
  - undo „Jederzeit hier wieder ändern, auch zurück auf LP 40 aus Meyton.“
  - Rücknahme (Wahl = Meyton): Titel „Disziplin aus Meyton nehmen?“, about „… hat die Disziplin LP 40 Auflage. Du stellst
    sie zurück auf LP 40, wie an der Anlage gewählt.“, happens ohne „Spätere Stände …“, dafür „Spätere Stände aus Meyton
    gelten wieder.“
  - Knopf „Ändern“ bzw. „Zurückstellen“.

## Files

- `apps/spiegel/prisma/schema.prisma`, neue Migration `apps/spiegel/prisma/migrations/<ts>_card_source_discipline/`
- `apps/spiegel/src/lib/db/cards.ts` (`writeRevision`, `chooseCardDiscipline`, `disciplineOptions`)
- `apps/spiegel/src/lib/card-discipline-actions.ts` (+ Test)
- `apps/spiegel/src/lib/db/reads.ts` (`PageCard.sourceDiscipline`)
- `apps/spiegel/src/lib/admin/consequences.ts` (+ Test)
- `apps/spiegel/src/components/card/CardDiscipline.tsx`, `CardScreen.tsx`, `src/app/(app)/cards/[id]/page.tsx`
- `apps/spiegel/src/lib/db/cards-choice.test.ts` (neu)
- `apps/spiegel/tools/pruefen.ts` (eine Prüfung: Abschnitt da, Blatt öffnet, Esc schließt)
- Vault: `vault/spiegel/spiegel-db-schema.md`, `spiegel-navigation.md` (Seite einer Scheibe), `spiegel-target-library.md`,
  `apps/spiegel/CLAUDE.md` (Regel „Disziplin je Scheibe“), `spiegel-roadmap.md` (Status SP-1.1)

## Required Docs

- `apps/spiegel/CLAUDE.md` (Schichten, Wahl wie Wertung und Art, Kein Knopf ohne Folge, Migrationen nur anhängen)
- `vault/conventions.md` §2, §10
- `vault/spiegel/spiegel-target-library.md`, `vault/decisions/adr-031.md`

## Tasks

1. Schema und Migration: `sourceDisciplineId Int?` mit Relation `SourceDiscipline` (`onDelete: NoAction` wie
   `disciplineId`), Index nicht nötig. SQL über `prisma migrate diff` erzeugen, mit `prisma migrate deploy` anwenden
   (die Dev-Datenbank will sonst einen Reset), `prisma generate`.
2. `writeRevision` nach D2, Test zuerst (`cards-choice.test.ts`): eine Wahl übersteht einen neuen Stand mit derselben
   und mit neuen Schüssen; Merkmale nach der gewählten Disziplin (Schusszahl); gleiche Disziplin aus Meyton hebt die Wahl
   auf.
3. `chooseCardDiscipline(db, { cardId, ownerId, disciplineId })` → `"saved" | "missing" | "notAllowed"` und
   `disciplineOptions(db, { cardId, ownerId })` nach D3/D4, Tests: fremde Scheibe, gelöschte, ignorierte Disziplin,
   anderes Scheibenbild, andere Anlage, zurück auf Meyton.
4. Server Action `setCardDiscipline(cardId, disciplineId)` mit `shooterId`/`isCardIdInput`, Ganzzahl prüfen,
   `revalidatePath("/", "layout")`, Test wie `card-kind-actions.test.ts`.
5. `consequences.ts`: `cardDiscipline({ evening, from, to, family, toSource })`, Tests mit Wortlaut und `OLD_WORDS`.
6. Lesen: `PageCard.sourceDiscipline: string | null`; die Seite lädt die Möglichkeiten (`disciplineOptions`) nur für den
   Besitzer.
7. `CardDiscipline.tsx` (Abschnitt, Blatt, Rückfrage), in `CardScreen` über Teilen; Markup-Test.
8. Skriptprüfung: Abschnitt „Disziplin“ steht da, das Blatt öffnet und schließt mit Esc, ohne zu speichern.
9. Vault und `apps/spiegel/CLAUDE.md`.

## Verification

- `pnpm check` grün.
- Gegen die Dev-Datenbank: eine eigene Scheibe (seed:own) umstellen, Liste und Fortschritt der neuen Familie zeigen sie,
  zurückstellen; im Browser geprüft (Dev-Server, angemeldet nur, wenn der User eine Sitzung hat; sonst Skriptprüfung mit
  Demo-Konto und `seed:own --demo`, danach `seed:own` im selben Befehl).
- Mutation: die Wahl in `writeRevision` testweise ignorieren → der Test „übersteht einen neuen Stand“ fällt.
