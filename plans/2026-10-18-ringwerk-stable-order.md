# Plan: Ringwerk ordnet bei Gleichstand eindeutig

Stand: 18. Oktober 2026 · Branch: `feat/ringwerk-stable-order` (von `feat/design2-ringwerk-abgleich`) · Teil von
`plans/2026-10-16-design2-all-apps.md` (vor Teil W)

## Kontext

Ringwerk liest an einigen Stellen Zeilen mit gleichem Sortierschlüssel. Postgres liefert sie dann in einer Folge, die
von den zufälligen IDs und der physischen Zeilenfolge abhängt. Am Prüfbestand sichtbar: nach einem Neuaufbau
(gleiche Daten, andere IDs) meldet `pruefen:vergleichen` rund 90 bis 120 Vertauschungen
([[ringwerk-pruefbestand]], „Gleichstand und Neuaufbau“). In Produktion heißt das: Eine Paarung kann im Bracket nach
einem Ergebnis den Platz wechseln, die Seite A/B im Finale ist zufällig, gleiche Nachnamen stehen mal so, mal so.

Gemessen an zwei Aufnahmen verschiedener Aufbauten wackeln:

1. Teilnehmer eines Wettbewerbs (Teilnehmerseite, Serien eines Events): `getCompetitionParticipants` sortiert nach
   Status, Team, **Nachname**.
2. Spielplan (Seite und PDF): `getMatchupsForCompetition` nach Runde, Index, **Nachname des Heimschützen**.
3. Bracket (Playoffs, Dashboard, Wettbewerbsliste, PDFs): `getPlayoffBracket` nach **`createdAt`**; alle Paarungen
   einer Runde entstehen in einem `createMany` mit derselben Zeit.
4. Finale: `handleMatchCompletion` liest die Halbfinals **ohne `orderBy`**; `winners[0]` wird A.

## Ansatz

Ein eindeutiger zweiter Schlüssel, ohne Schema-Änderung: die `id`. Ringwerks IDs sind cuid v1 (Zeitstempel, dann ein
fortlaufender Zähler), `createdAt` und danach `id` ergibt die Reihenfolge der Anlage. Gemessen: über zwei Aufbauten
dieselbe Folge der Playoff-Paarungen. Damit stehen die Paarungen im Bracket in der Reihenfolge, in der Ringwerk sie
setzt (`startPlayoffs` und die nächste Runde legen sie in Setzreihenfolge an), und A im Finale ist der Sieger des
oberen Halbfinales. Wo nach Namen sortiert wird, kommt erst der Vorname, dann die `id`.

Keine Änderung an Schema, Migrationen, Wertung, Setzung oder Server-Actions außer der Lesereihenfolge.

## Tasks

- **S1 Charakterisierung.** Tests, die das `orderBy` der vier Abfragen und der Lesestellen unten festhalten (Mock von
  `db`, Argumente prüfen), dazu ein Test für `handleMatchCompletion`: Das Mock liefert die Halbfinals nur dann in
  Setzreihenfolge, wenn sie nach `createdAt, id` gefragt werden (conventions §9: Mock filtert nach der Bedingung); A im
  Finale ist der Sieger des ersten Halbfinales. Vorher rot, danach grün.
- **S2 Abfragen.**
  - `src/lib/competitionParticipants/queries.ts`: `…, { participant: { lastName } }, { participant: { firstName } },
    { id }`.
  - `src/lib/matchups/queries.ts`: `…, { homeParticipant: { lastName } }, { homeParticipant: { firstName } }, { id }`.
  - `src/lib/playoffs/queries.ts` (`getPlayoffBracket`): `[{ createdAt }, { id }]`.
  - `src/lib/playoffs/actions/match.ts`: beide `playoffMatch.findMany` mit `[{ createdAt }, { id }]`.
  - Gleiche Art, ohne sichtbare Abweichung im Prüfbestand, aber derselbe Gleichstand möglich: `createdAt` allein in
    `src/lib/standings/queries.ts` (Einschreibungen, beide Stellen), `src/lib/competitions/seriesQueries.ts:50` (Serien)
    und `src/lib/matchups/actions.ts:47` (Einschreibungen für den Spielplan; nur bei gleicher Zeit anders, sonst
    dieselbe Eingabe) bekommen `{ id }` dahinter.
- **S3 Prüfung.** `pnpm check`. `pnpm --filter ringwerk build`, dann zweimal `pruefdaten` neu aufbauen und je
  `pruefen:aufnehmen --referenz reports/ringwerk-a` bzw. `…-b` und `pruefen:vergleichen --referenz` gegen die andere
  Aufnahme: 0 Fehler über zwei Aufbauten. `pruefen:ablaeufe` grün.
- **S4 Ausgangsstand (Haltepunkt).** `pruefen:vergleichen` gegen den bestätigten Ausgangsstand zeigt nur die
  erwarteten Verschiebungen (Reihenfolge bei Gleichstand, Bracket-Plätze, Finale A/B); der User sieht eine Auswahl und
  gibt frei, dann `pruefen:aufnehmen` und Commit.
- **S5 Doku.** `vault/apps/ringwerk/ringwerk.md` (offener Punkt erledigt), `ringwerk-pruefbestand.md` (Vergleich
  über Aufbauten eindeutig, `--referenz` nur noch für alt gegen neu), `apps/ringwerk/CLAUDE.md` Schritt 2.

## Risiko und Release

Nur die Reihenfolge ändert sich. Sichtbar für Nutzer: Plätze im Bracket stehen fest in Setzreihenfolge, im Finale steht
der Sieger des oberen Halbfinales oben. Ein laufendes Finale behält seine gespeicherte Seite (nur neue Finals folgen der
Regel). Release nach „Release von Ringwerk“ (`vault/operations/operations.md`), allein, an einem Tag ohne Wettkampf.
