# Plan: Durchsicht nach drei Ebenen — Befunde in Treffsicher und Ringwerk

Stand: 20. Oktober 2026 · Branch: `feat/durchsicht-drei-ebenen` · **Entwurf, wartet auf Freigabe durch den User**

## Kontext

Die Messung am Telefon ist gemacht ([[treffsicher-durchsicht]], [[ringwerk-durchsicht]]; Werkzeug
`@vereinsheim/pruefen/measure`, `pnpm --filter <app> durchsicht`). Den einen echten Fehler, Dezimalpunkt statt Komma in
Treffsicher (T1), behebt schon dieser Branch. Die übrigen Befunde ändern, was eine Seite zuerst zeigt. Bei Ringwerk
trägt jede Änderung den Wettkampfbetrieb mit, bei Treffsicher setzt [[adr-033]] den Rahmen: Das Tagebuch zieht später
in Spiegels Einheit, Start und Statistik übernimmt Spiegel. Was nur Treffsichers Start oder Einheit umbaut, lohnt sich
deshalb nicht mehr.

## Ansatz

Drei Teile, je ein Merge, Ringwerk-Teile je ein eigener Release:

- **Teil 1 (klein, beide Apps):** Schreibregel im geteilten Satz, eine Zeile Bedienung in Treffsichers Statistik,
  Fehlerseiten im alten Stil.
- **Teil 2 (Ringwerk, Liga):** Tabelle vor dem Spielplan, Einstieg nach Phase, laufende Runde zuerst.
- **Teil 3 (Ringwerk, Start und Kürzel):** knappe Karten auf Start, Kürzel ausgeschrieben.

Nicht in diesem Plan:

- **T2, T3, T6** (Start, Einheit und Tagebuch in Treffsicher): kommen mit [[adr-033]] Stufe 2 aus Spiegel (Start mit
  dem letzten Abend und Bezug, Liste je Abend).
- **R5** („Wann schieße ich wieder?“): braucht eine Verknüpfung von Konto und Teilnehmer in Ringwerks Datenmodell.
  Eigene Entscheidung (ADR), mit der Sportleitung zu besprechen.
- **Disziplinen in drei Formen:** mit [[adr-033]] verschwinden Treffsichers Disziplinen in Spiegels; Ringwerk bleibt
  eigen. Kein Handlungsbedarf vor Stufe 2.

## Required Docs

`vault/conventions.md` (§2, §3, §6, §10), [[treffsicher-durchsicht]], [[ringwerk-durchsicht]], [[spiegel-durchsicht]],
[[ringwerk-pruefbestand]], [[ringwerk-design2]], `apps/ringwerk/CLAUDE.md` („Vor jedem Release“),
`vault/operations/operations.md` („Release von Ringwerk“).

## Haltepunkte

- Neue oder geänderte Texte kommen erst ins Textbuch (`vault/_attachments/textbuch-ringwerk-treffsicher.md`), der User
  gibt sie frei: 1.1, 3.1, 3.2.
- Ändert sich in Ringwerk die Reihenfolge der Daten auf einer Seite (2.1), meldet `pruefen:vergleichen` das als Fehler.
  Der User sieht die Abweichungen durch; erst danach nimmt `pruefen:aufnehmen` den Ausgangsstand neu auf, in einem
  eigenen Commit.
- Jeder Ringwerk-Release: Tag ohne Wettkampf, Backup und `restore-probe` vorher, `APPS=ringwerk`.

---

## Teil 1 — Klein, beide Apps

- **1.1 Satz ohne Semikolon (T5): umgesetzt (20. Oktober 2026),** samt Beobachtungen, Hinweisen und Start in
  `shot-ui`; die Tabelle alt → neu steht im Textbuch, vom User noch nicht gelesen. Ursprünglich: `packages/shot-ui/src/period/sentence.ts`: „…; das ist ein klarer Unterschied“ und
  „…; ein klarer Unterschied ist das aber nicht“ als zwei Sätze („… höher als im Zeitraum davor. Das ist ein klarer
  Unterschied.“). Erst ins Textbuch (Abschnitt Spiegel und Treffsicher). Neuer Test `packages/shot-ui/src/period/sentence.test.ts`: kein `;` in allen
  Sätzen (über `forbiddenIn` aus `@vereinsheim/lib/wording`). Betrifft Spiegel und Treffsicher gleich.
- **1.2 Eine Zeile Bedienung (T4): zurückgestellt (20. Oktober 2026).** Die zweite Zeile entsteht in
  `shot-ui/period/PeriodHeader` (`PeriodControls`), weil die Familie als Segment am Telefon mit langen Namen umbricht.
  Eine kompakte Familienwahl änderte Spiegels Fortschritt gleich mit; sie gehört zu [[adr-033]] Stufe 2, wenn Treffsichers
  Statistik in Spiegel aufgeht.
- **1.3 Fehlerseiten: umgesetzt (20. Oktober 2026).** Ringwerk `src/app/(public)/error.tsx` und Treffsicher `src/app/(app)/sessions/[id]/error.tsx` im
  Stil der übrigen Fehlerseiten (Design 2). Ringwerk: Abgleich nach dem Prüfbestand ohne Fehler.

**Prüfung Teil 1:** `pnpm check`, `./scripts/consistency-check.sh`, `pruefen` für Spiegel und Treffsicher,
`pruefen:vergleichen` für Ringwerk, `durchsicht` für Treffsicher.

## Teil 2 — Ringwerk, Liga (eigener Release)

- **2.1 Tabelle vor dem Spielplan (R1).** `src/app/(app)/competitions/[id]/schedule/page.tsx`: die Tabelle
  (`StandingsTable` bzw. `BestOfStandingsTable`) vor `ScheduleView`. `ScheduleView` gliedert nach Spieltagen; der
  laufende Spieltag (der erste mit offener Paarung) ist offen, die übrigen zugeklappt (`<details>`, ohne Feld, das
  bedingt gerendert wird; Ergebnisse eintragen bleibt in jedem Spieltag erreichbar). Markup-Test: die Tabelle steht vor
  dem ersten Spieltag; der laufende Spieltag ist offen. Erwartet im Vergleich: andere Reihenfolge der Daten auf dieser
  Seite, sonst nichts (Haltepunkt).
- **2.2 Einstieg nach Phase (R2).** `src/app/(app)/competitions/[id]/page.tsx`: Eine Liga mit gestarteten Playoffs
  (`hasPlayoffsStarted`) leitet auf `/playoffs`, sonst wie heute auf `/schedule`. Test der reinen Entscheidung
  (`entryPath(competition, playoffsStarted)`). Der Prüfbestand belegt beide Fälle (L4 und L5).
- **2.3 Laufende Runde zuerst (R6).** `components/app/playoffs/playoff-bracket/BracketDiagram.tsx`: am Telefon scrollt
  der Baum beim Öffnen zur laufenden Runde (die erste mit offener Paarung); die Seite selbst scrollt weiter nie seitlich.
  Skriptprüfung: bei L5 „Viertelfinale mitten in der Runde“ steht das Viertelfinale im ersten Bildschirm.

**Prüfung Teil 2:** `pnpm check`; `pruefdaten`, `pruefen:vergleichen` (nur die erwartete Abweichung aus 2.1, vom User
gesehen, dann neu aufgenommen); `pruefen:ablaeufe` grün (Ergebnisse eintragen in zugeklappten Spieltagen); `--echt` an
der frischen Kopie der echten Daten; `durchsicht`: „Wo stehe ich?“ im ersten Bildschirm in jeder Liga-Phase.

## Teil 3 — Ringwerk, Start und Kürzel (eigener Release)

- **3.1 Knappe Karten auf Start (R3).** `components/app/dashboard/DashboardCompetitionCard.tsx`: je Wettbewerb ein Satz
  statt Tabelle oder Baum („Spieltag 3 von 7, vorn …“, „Halbfinale läuft“, „Rangliste: 12 Teilnehmer“) und der Weg
  zum Wettbewerb. Die Sätze stehen in einer reinen Funktion (`lib/dashboard/summary.ts`) mit Test; der Wortlaut erst ins
  Textbuch.
- **3.2 Kürzel ausschreiben (R4).** Spaltenköpfe „RT“, „Best. RT“, „Pkt.“, „Sp.“, „korr.“ auf dem Bildschirm
  ausschreiben, wo Platz ist (ab 768 px); am Telefon bleibt das Kürzel mit „?“ und ausgeschriebenem `aria-label`. PDFs
  bleiben, wie sie sind. Wortlaut erst ins Textbuch; Markup-Tests der Tabellen.

**Prüfung Teil 3:** wie Teil 2; Abweichungen nur in Beschriftungen (Hinweise, keine Fehler).

## Verifikation

1. Je Teil `pnpm check`, Drift-Gate, `pruefen` der betroffenen Apps.
2. Ringwerk je Teil: Prüfbestand-Abgleich, Abläufe, echte Daten, Bilder für den User, Release nach „Vor jedem
   Release“ in `apps/ringwerk/CLAUDE.md`.
3. `durchsicht` erneut laufen lassen; die Notes [[treffsicher-durchsicht]] und [[ringwerk-durchsicht]] mit den neuen
   Zahlen nachziehen. Danach diesen Plan löschen.
