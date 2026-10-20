# Ringwerk — Saison: Teilnehmer ohne Mindestzahl an Serien

**Status:** Entwurf, wartet auf Freigabe. Branch: `feat/ringwerk-season-no-min-series`.

## Context

Eine Saison (`Competition.type = SEASON`) kann eine Mindestzahl an Serien verlangen (`minSeries`). Wer sie nicht
erreicht, steht grau und ohne Metrik-Rang unter den Gewerteten ([[season-mode]]). Im Verein gilt eine Sonderregel: Die
Jugend braucht keine Mindestzahl, sie ist ab der ersten Serie in der Wertung.

Ringwerk bildet das als **Ausnahme an der Einschreibung** ab: „Keine Mindestzahl an Serien“. Die Sportleitung setzt
sie für die Jugend, und für jeden anderen Fall, in dem der Verein so entscheidet. Ringwerk muss dafür nicht wissen,
wer zur Jugend gehört.

Heute hängt `meetsMinSeries` allein an `seriesCount >= minSeries`
(`apps/ringwerk/src/lib/scoring/calculateSeasonStandings.ts`). Die Regel wirkt an fünf Stellen, die alle über
`calculateSeasonStandings` → `sortSeasonStandings` → `seasonPositions` laufen:

| Stelle | Datei |
| --- | --- |
| Rangliste (Seite) | `src/app/(app)/competitions/[id]/standings/page.tsx`, `src/components/app/series/SeasonStandingsTable.tsx` |
| PDF intern | `src/app/api/competitions/[id]/pdf/standings/route.ts`, `src/lib/pdf/SeasonStandingsPdf.tsx` |
| PDF öffentlich | `src/app/api/public/c/[slug]/pdf/route.ts` |
| Vorschau (Start, Liste) | `src/lib/competitions/preview.ts`, `previewModel.ts`, `CompetitionPreview.tsx` |
| Serien erfassen | `src/app/(app)/competitions/[id]/series/page.tsx`, `SeasonParticipantItem.tsx`, `DeleteSeasonSeriesButton.tsx` |

Dazu die Teilnehmerverwaltung (`src/app/(app)/competitions/[id]/participants/page.tsx`), die die Ausnahme setzt.

Ringwerk trägt den laufenden Wettkampfbetrieb: Die Änderung muss für alle Saisons ohne Ausnahme Zahlen, Reihenfolge,
Plätze und PDF-Text unverändert lassen ([[ringwerk-pruefbestand]]).

## Entscheidungen

1. **Ausnahme statt Personengruppe.** Das Feld beschreibt die Wirkung, nicht die Person:
   `CompetitionParticipant.exemptFromMinSeries Boolean @default(false)`. In der Verwaltung heißt es „Keine
   Mindestzahl an Serien“. Ringwerk speichert keine Altersklasse ([[adr-029]], Datensparsamkeit). Die Jugend ist das
   Beispiel im Hilfetext, nicht ein Begriff im Modell.
2a. **Die Ausnahme ist eine Mindestzahl von 1.** Rangliste und PDF zeigen sie in der Spalte „Serien“ als `3/1`
   statt `3/20`, ohne Zeichen am Namen. Das Format der Spalte bleibt gleich, die Zeile sagt selbst, was für sie gilt.
2. **Eine gemeinsame Rangliste.** Mit mindestens einer Serie zählt die Ausnahme als gewertet (`meetsMinSeries =
   true`): oberer Block, Metrik-Ränge, Podium. Keine eigene Liste.
3. **An der Einschreibung**, nicht am Teilnehmer: Die Ausnahme gilt für eine Saison. Eine neue Saison fragt neu.
4. **Regel fest „ab 1 Serie“**, keine zweite Mindestzahl am Wettbewerb. Erweiterbar, falls der Verein sie später will.
5. **Nur sichtbar, wenn sie wirkt:** Saison mit `minSeries !== null`. Kästchen, Knopf und Zeichen fehlen in Liga,
   Event und Saisons ohne Mindestzahl. Bekommt eine Saison später eine Mindestzahl, gilt der gespeicherte Wert wieder.
6. **Umstellen geht jederzeit** (Saison aktiv, Einschreibung aktiv), auch mit Serien. Es ändert die Rangliste, deshalb
   `DecisionDialog` mit Folgen und ein Protokolleintrag `MIN_SERIES_EXEMPTION_CHANGED`.
7. **Eine Regel an einer Stelle:** die reine Funktion `requiredSeries(minSeries, exempt)` in
   `calculateSeasonStandings.ts` (`null` ohne Mindestzahl, `1` mit Ausnahme, sonst `minSeries`). Jede Zeile trägt das
   Ergebnis als `entry.requiredSeries`; Bildschirm, PDF, Vorschau und Dialoge lesen nur dieses Feld und
   `entry.meetsMinSeries`.

## Approach

Schichtenfolge der App: Schema → Migration → Types → Queries → Actions → Calculate → Components → Page.

- `SeasonStandingsEntry` bekommt `requiredSeries: number | null`; `ParticipantInput` bekommt `exemptFromMinSeries?:
  boolean` (Default `false`, damit Tests und Aufrufer ohne Ausnahme unverändert bleiben).
- `requiredSeries = requiredSeries(minSeries, exempt)`, `meetsMinSeries = required === null || seriesCount >=
  required`. Ohne Serie bleibt die Zeile mit Ausnahme im unteren Block (`0/1`, rot), wie heute jede Zeile ohne Serie.
- Der Rang-Pool folgt automatisch (`rankedEntries` filtert schon auf `meetsMinSeries`). `sortSeasonStandings` und
  `seasonPositions` brauchen keine Änderung, sie arbeiten nur mit `meetsMinSeries`.
- Anzeige: Die Spalte „Serien“ und der Zusatz am Telefon (`(0/1)` bei grauen Zeilen) lesen `entry.requiredSeries`
  statt `minSeries`: `3/1`, grün ab 1. Kein Zeichen am Namen, keine neue Kopfzeile; der Kopf bleibt „Mindest: 20
  Serien“, die Hilfe erklärt die 1. In der Teilnehmerverwaltung steht „ohne Mindestzahl“ am Namen, damit die
  Sportleitung die Ausnahme auch vor der ersten Serie sieht. Ohne Ausnahme bleibt jede Seite und jedes PDF
  byte-gleich.

## Texte (erst ins Textbuch, Freigabe durch den User, dann Code)

Neuer Abschnitt in `vault/_attachments/textbuch-ringwerk-treffsicher.md`: „Ringwerk: Saison ohne Mindestzahl“,
**Status: Entwurf**. Werte in `{…}`.

1. **Einschreiben, Kästchen** (nur Saison mit Mindestzahl): „Keine Mindestzahl an Serien“, darunter leise: „Zählt in
   der Rangliste ab der ersten Serie. Etwa für die Jugend.“
2. **Zeichen am Namen, nur in der Teilnehmerverwaltung:** „ohne Mindestzahl“. Rangliste und PDF zeigen `{3}/1`.
3. **Dialog „Ohne Mindestzahl werten“** (Knopf in der Teilnehmerverwaltung, Symbol `CircleSlash`, `aria-label` =
   Knopftext):
   - Titel: {Anna Birke} ohne Mindestzahl werten?
   - Worum: {Anna Birke} ist in dieser Saison eingeschrieben. Für einen Platz braucht es {20} Serien.
   - Vorher prüfen: Gilt für {Anna Birke} eine Ausnahme? Etwa, weil {Anna Birke} zur Jugend gehört.
   - Was dann passiert: {Anna Birke} steht ab der ersten Serie mit Platz in der Rangliste. · In der Spalte „Serien“
     steht dann {3}/1 statt {3}/{20}, in der App und im PDF. · Im Protokoll des Wettbewerbs steht die Änderung.
   - Was nicht passiert: Die Serien von {Anna Birke} bleiben, wie sie sind. · Für alle anderen gilt die Mindestzahl
     weiter. · Andere Saisons ändern sich nicht.
   - Rückgängig: Jederzeit über denselben Knopf in der Teilnehmerverwaltung.
   - Knopf: Ohne Mindestzahl werten
4. **Dialog „Mindestzahl wieder verlangen“:**
   - Titel: Für {Anna Birke} wieder {20} Serien verlangen?
   - Worum: {Anna Birke} wird in dieser Saison ohne Mindestzahl gewertet. Bisher zählt jede Serie ab der ersten.
   - Was dann passiert: Für einen Platz braucht {Anna Birke} dann {20} Serien wie alle anderen. · (nur wenn weniger
     Serien) {Anna Birke} hat {3} Serien und steht danach ohne Platz in der Rangliste. · Im Protokoll des Wettbewerbs
     steht die Änderung.
   - Was nicht passiert: Die Serien von {Anna Birke} bleiben, wie sie sind.
   - Rückgängig: Jederzeit über denselben Knopf in der Teilnehmerverwaltung.
   - Knopf: Mindestzahl verlangen
5. **Serien erfassen, Zeile:** „{3} Serien / 1 Mindest“ (statt „{3} Serien / {20} Mindest“), gleiches Muster wie heute.
6. **Serie löschen** (bei Ausnahme statt der Zeile zur Mindestzahl, nur wenn es die letzte Serie ist): „Danach hat
   {Anna Birke} keine Serie mehr und steht ohne Platz in der Rangliste.“
7. **Hilfe „Reihenfolge der Rangliste“, So liest du es** — nach „Darunter stehen grau alle, denen noch Serien
   fehlen.“ neu: „Steht in der Spalte „Serien“ eine 1 hinter dem Strich, gilt keine Mindestzahl. Dann zählt schon die
   erste Serie. Das gilt etwa für die Jugend.“
8. **Protokoll:** Art „Mindestzahl geändert“; Beschreibung „{Anna Birke} ohne Mindestzahl gewertet“ bzw. „Für {Anna
   Birke} wieder die Mindestzahl verlangt“.

## Required Docs

- `vault/apps/ringwerk/season-mode.md` — Blöcke, Rang-Pool, Sortierung
- `vault/apps/ringwerk/ringwerk-pruefbestand.md` — Abgleich vor Merge und Release
- `vault/apps/ringwerk/ringwerk-data-model.md`, `ringwerk-code-conventions.md`, `ringwerk-ui-patterns.md`
- `vault/conventions.md` §2 (DecisionDialog, Toasts), §9 (Mocks filtern nach der Bedingung, Formulare gesteuert),
  §10 (So schreiben wir)
- `vault/_attachments/textbuch-ringwerk-treffsicher.md` — Abschnitt „Ringwerk: Saison ohne Mindestzahl“

## Tasks

### T0 — Texte ins Textbuch (Hauptsession, User gibt frei)

Abschnitt aus „Texte“ oben in das Textbuch übernehmen, Status „Entwurf“. Nach Freigabe Status „freigegeben am …“.
Erst danach T4–T7. Commit: `docs(ringwerk): draft the texts for seasons without a series minimum`.

### T1 — Schema und Migration (Hauptsession, geschützter Pfad, ADR-023)

- `apps/ringwerk/prisma/schema.prisma`, `model CompetitionParticipant`, nach `isGuest`:
  ```prisma
  // Saison: in der Wertung ab der ersten Serie, auch wenn der Wettbewerb eine Mindestzahl verlangt (etwa Jugend)
  exemptFromMinSeries Boolean @default(false)
  ```
- `/migrate add_exempt_from_min_series`; erwartetes SQL, rein additiv:
  `ALTER TABLE "CompetitionParticipant" ADD COLUMN "exemptFromMinSeries" BOOLEAN NOT NULL DEFAULT false;`
- Commit: `feat(ringwerk): add a series-minimum exemption to enrolments`.

Der Autopilot verweigert `prisma/` und Migrationen. T1 läuft deshalb vor `/implement` in der Hauptsession.

### T2 — Regel und Rangliste (Calculate)

- `calculateSeasonStandings.ts`: `export function requiredSeries(minSeries: number | null, exempt: boolean): number |
  null`; `ParticipantInput.exemptFromMinSeries?: boolean`; `SeasonStandingsEntry.requiredSeries: number | null`;
  `meetsMinSeries` daraus; JSDoc der Funktion um die Ausnahme ergänzen.
- `calculateSeasonStandings.test.ts`, neue Fälle:
  - Ausnahme mit 1 Serie bei `minSeries = 20` → `requiredSeries = 1`, `meetsMinSeries = true`, trägt Metrik-Ränge.
  - Ausnahme mit 0 Serien → `requiredSeries = 1`, `meetsMinSeries = false`, keine Ränge.
  - Ohne Ausnahme mit 1 Serie daneben → `false`, keine Ränge. Die Ausnahme hält Rang 1 vor einem Gewerteten mit
    schlechterem Wert; die Fixture ist so gebaut, dass „Ausnahme ignoriert“ einen anderen Rang ergibt (§9).
  - `minSeries = null` → `requiredSeries = null` mit und ohne Ausnahme.
  - Feld fehlt im Input → wie `false`, `requiredSeries = minSeries`.
- `sortSeasonStandings.test.ts`: klassisch und alternierend je ein Fall, Ausnahme mit 2 Serien landet im oberen Block,
  `seasonPositions` vergibt ihr einen Platz unter den Gewerteten.
- Gegenprobe: in `requiredSeries` den Zweig `exempt ? 1` testweise entfernen (Kopie vorher sichern, nicht
  `git checkout`), mindestens ein Test rot.
- Commit: `feat(ringwerk): rank exempt participants from their first season series`.

### T3 — Abfragen und Aufrufer durchreichen (Queries)

- `src/lib/competitions/seriesQueries.ts` `getSeasonWithSeries`: `exemptFromMinSeries: true` im `select`, im Typ
  `SeasonParticipantEntry` als `exemptFromMinSeries: boolean`.
- Alle vier Aufrufer von `calculateSeasonStandings` reichen `exemptFromMinSeries: p.exemptFromMinSeries` durch:
  Rangliste-Seite, PDF intern, PDF öffentlich (`route.ts`), `preview.ts` (eigene Abfrage dort ergänzen).
- `src/lib/competitionParticipants/queries.ts` + `types.ts`: Feld in `CompetitionParticipantListItem`.
- Mocks anpassen: `src/app/api/public/c/[slug]/pdf/route.test.ts`, `previewModel.test.ts`, alle Fixtures mit
  `SeasonStandingsEntry` (`requiredSeries` = `minSeries` der Fixture).
- Commit: `feat(ringwerk): load the series-minimum exemption for season standings`.

### T4 — Setzen und Umstellen (Actions)

- `src/lib/competitionParticipants/enroll.ts`: Schema-Feld `exemptFromMinSeries` (`"true" | "on"` → `true`), nur
  gespeichert bei `SEASON` mit `minSeries !== null`, sonst `false`.
- `src/lib/competitionParticipants/updateMeta.ts`: neue Action `updateMinSeriesExemption(competitionParticipantId,
  exempt)`: Session + `canManage`; Einschreibung laden mit `competition.type`, `competition.status`,
  `competition.minSeries`, `status`, Serienzahl, Name; Fehler wenn nicht `SEASON`, `minSeries === null`, Saison nicht
  `ACTIVE` oder Einschreibung nicht `ACTIVE`; unverändert → `{ success: true }` ohne Schreiben. Update und
  `auditLog.create` in **einer** Transaktion: `eventType: "MIN_SERIES_EXEMPTION_CHANGED"`, `entityType:
  "COMPETITION_PARTICIPANT"`, `details: { before: { exemptFromMinSeries }, after: { exemptFromMinSeries },
  participantName }`. Danach `revalidateCompetitionParticipantPaths` und Rangliste und Serien der Saison (prüfen, ob
  `_shared.ts` sie schon trifft).
- `src/lib/auditLog/types.ts`, `description.ts`, `formatDetails.ts`: neuer Typ, Label und Beschreibung aus Text 8.
- Tests in `src/lib/competitionParticipants/actions.test.ts`: Erfolg mit Protokoll; abgelehnt für Liga, Saison ohne
  Mindestzahl, archivierte Saison, zurückgezogene Einschreibung, fehlende Rechte; kein Protokoll bei unverändertem
  Wert; Einschreiben in eine Saison mit Mindestzahl und `exemptFromMinSeries=on` speichert `true`, bei einem Event
  `false`.
- Commit: `feat(ringwerk): set and change the series-minimum exemption of an enrolment`.

### T5 — Teilnehmerverwaltung (Components)

- `EnrollParticipantForm` / `enroll-form/EnrollMainRow.tsx`: Kästchen mit Text 1, nur bei Saison mit Mindestzahl
  (neue Prop `offersMinSeriesExemption`), gesteuert (`checked`/`onCheckedChange`, §9), Ringwerks
  `components/ui/checkbox.tsx`.
- `participants/page.tsx`: Zeichen „ohne Mindestzahl“ (`Badge variant="outline"`, `text-xs`) wie „Gast“, unter
  derselben Bedingung.
- `participant-actions/MinSeriesExemptionAction.tsx` (neu, wie `ConfirmActions.tsx`): Symbolknopf `CircleSlash`,
  `size="icon-sm"`, öffnet `DecisionDialog` mit `seasonExemptionSet` / `seasonExemptionUnset` aus
  `src/lib/consequences.ts` (Texte 3 und 4, Parameter `name`, `minSeries`, `seriesCount`); Toast nach Erfolg/Fehler.
  In `CompetitionParticipantActions` nur bei Saison mit Mindestzahl und aktiver Einschreibung.
- `consequences.test.ts`: Wortlaut beider Dialoge, Zeile „hat {3} Serien“ nur wenn `seriesCount < minSeries`;
  `confirmations.test.tsx` um den neuen Knopf ergänzen.
- Commit: `feat(ringwerk): offer the series-minimum exemption in the participant list`.

### T6 — Rangliste, PDF, Vorschau (Components + Page)

- `sortSeasonStandings.ts`, neben `hasSeasonResult`: `seasonSeriesLabel(entry): string | null`
  (`` `${seriesCount}/${requiredSeries}` ``, ohne Mindestzahl `null`). Tabelle (Spalte und Zusatz am Telefon) und PDF
  ziehen den Text aus derselben Stelle (§9).
- `SeasonStandingsTable.tsx`: Spalte „Serien“ und `(…)`-Zusatz über `seasonSeriesLabel`, Farbe aus
  `meetsMinSeries`. Ob die Spalte erscheint, hängt weiter an `minSeries !== null`.
- `SeasonStandingsPdf.tsx`: `seriesText` über `seasonSeriesLabel`.
- `CompetitionPreview.tsx` / `previewModel.ts`: zeigt die Vorschau einen Serienstand, liest er `requiredSeries`;
  graue Zeilen folgen schon `meetsMinSeries` (beim Umsetzen am Markup prüfen).
- `SeasonStandingsTable.test.tsx` (`renderToStaticMarkup`): Zeile mit Ausnahme und 1 Serie bei Mindestzahl 20 zeigt
  `1/1`, grün, nicht grau, im oberen Block; Ausnahme ohne Serie zeigt `0/1` und `(0/1)` am Telefon; die bestehenden
  Fälle ohne Ausnahme bleiben unverändert grün.
- Commit: `feat(ringwerk): show the series-minimum exemption in standings, PDF and preview`.

### T7 — Serien erfassen, Hilfe

- `SeasonParticipantItem.tsx`: Prop `requiredSeries` statt `minSeries` für die Zeile (Text 5); die Serienseite
  rechnet sie mit `requiredSeries(competition.minSeries, cp.exemptFromMinSeries)`.
- `DeleteSeasonSeriesButton.tsx` + `seasonSeriesDelete` in `consequences.ts`: Props `exemptFromMinSeries`,
  `seriesCount`; Text 6 statt der Mindestzahl-Zeile.
- `src/lib/help/topics.ts` `season-order.read`: Satz aus Text 7; `topics.test.ts` hält den Wortlaut gegen das
  Textbuch.
- Commit: `feat(ringwerk): explain the series-minimum exemption in series entry and help`.

### T8 — Prüfbestand

- Zuerst **ohne** neues Szenario: `pnpm --filter ringwerk build`, `pruefdaten`, `pruefen:vergleichen` → 0 Fehler,
  0 Hinweise. Das belegt: ohne Ausnahme bleibt alles gleich.
- Dann Szenario `S-OHNE-MINDEST` in `tools/pruefdaten` (Saison, `minSeries = 5`, Ringteiler klassisch; eine Ausnahme
  mit 1 Serie und dem besten Wert, eine Ausnahme ohne Serie, zwei andere mit 5 und 2 Serien; erfundene Namen,
  ADR-029), geschrieben über die Server-Actions. `pruefen:vergleichen` meldet genau den neuen Wettbewerb. Ausgangsstand
  neu aufnehmen nur nach Freigabe durch den User, eigener Commit.
- `pruefen:ablaeufe` grün; im Ablauf „Saison“ den Schritt „ohne Mindestzahl werten“ ergänzen, wenn `ablaeufe.ts`
  Saisons über die Oberfläche bedient (beim Umsetzen prüfen).
- Commit: `test(ringwerk): add a season with a series-minimum exemption to the test dataset`.

### T9 — Vault

- `vault/apps/ringwerk/season-mode.md`: Abschnitt „Ohne Mindestzahl“ (Ausnahme an der Einschreibung, Regel
  `requiredSeries`, Anzeige `3/1`, Umstellen mit Protokoll, Jugend als Anlass); `keywords` um „Jugend Ausnahme
  Mindestzahl exemptFromMinSeries“.
- `ringwerk-data-model.md` (Feld), `ringwerk-features.md` (Funktion), `ringwerk-pruefbestand.md` (Stand, neues
  Szenario). `/sync-graph`.
- Commit: `docs(ringwerk): document the series-minimum exemption`.

## Verification

1. `pnpm check` grün (Stop-Gate).
2. T8: Vergleich ohne Szenario 0 Fehler; mit Szenario nur der neue Wettbewerb.
3. Echte Daten: `pruefen:aufnehmen --echt` auf `main`, `pruefen:vergleichen --echt` auf dem Branch → 0 Fehler (noch
   niemand hat die Ausnahme). Der User holt die Dev-Datenbank vorher mit `vereinsheim dev-restore ringwerk`.
4. Im Browser (Dev, Prüfbestand `S-OHNE-MINDEST`): Kästchen beim Einschreiben, Knopf und beide Dialoge, Zeichen in der
   Teilnehmerliste, Rangliste mit `1/1` und `0/1` am Telefon (390 px) und Desktop, PDF intern und öffentlich, Serienliste, Löschdialog,
   Protokolleintrag. Was die Daten nicht hergeben, steht im Bericht als „nicht belegt“.
5. Release allein, an einem Tag ohne Wettkampf, Backup vorher. Die Migration ist additiv mit Default. Spiegel ist
   nicht berührt, eine neue Brücke ist nicht nötig.

## Nicht im Umfang

- Eigene Rangliste oder eigene Mindestzahl für die Ausnahme.
- Altersklassen oder Geburtsdatum am Teilnehmer.
- Liga und Event.
