# Spiegel: Fortschritt in der App

## Kontext

Der User am 10. Oktober 2026: „mach mit Fortschritt weiter“. In `apps/spiegel` ist `/progress` ein Platzhalter. Die
Seite eines Zeitraums gibt es fertig in `shot-ui/period` (L3, U2, U5) und im Labor (`tools/labor/src/PeriodView.tsx`).
Seit SP-1.8 rechnet `periodModel` aus der Projektion (`plans/2026-10-10-spiegel-projektion-uebersichten.md`, liegt
noch auf dem Branch darunter). Dies ist der nächste Teil von N7 ([[spiegel-navigation]]): Fortschritt mit echten Daten.

Geprüft vor dem Plan:
- Der Zustand der Seite steht vollständig in der Adresse (`ProgressQuery`: Zeitraum, Vergleich, Familie, Art,
  „nur Probe“, Kennzahl, Darstellung, Wahl als `pick`). Dazu gibt es `progressRoute`, `periodStateFromRoute`,
  `listFromProgress`, `openCard` mit Herkunft Fortschritt und `contextCardIds` für das Blättern.
- Die Bausteine lesen aus den Scheiben des Modells nur Id, Beginn, Art, `printedShots` und „nur Probe“ (`CardList`,
  `CardReadout`, `PeriodChart`). Werte und Rekorde jeder Scheibe braucht nur die Rechnung.
- Die Seite einer Scheibe hält Wahl und Anker mit `window.history.replaceState` in der Adresse, ohne den Server zu
  fragen. Hilfe über `useHelp`, „Erklärungen“ als Zustand der Seite.

## Entscheidungen

- **Rechnen auf dem Server, wie Start und Liste:** Die Seite liest ihre Abfrage aus `searchParams`, die Scheiben aus
  `ownerCards` und rechnet `periodModel` ohne Wahl. Die Wertung ist die des Geräts (Cookie), wie auf Start und in der
  Liste; ein `scoring` in der Adresse gilt nicht. Ohne Familie in der Adresse gilt die der neuesten Scheibe.
- **Leicht an den Browser:** `lightPeriodModel` (neu in `shot-ui/period/model`) leert die Projektion der Scheiben im
  Modell auf Art, „nur Probe“ und Schusszahl. Werte und Rekorde jeder Scheibe gehen nicht mit; die Werte der Kennzahl
  stehen schon in `values`. Ein Test zeigt, dass die Bausteine mit dem leichten Modell dasselbe zeichnen.
- **Filter über die Adresse:** Zeitraum, Vergleich, Familie, Art, „nur Probe“, Kennzahl und Darstellung schreiben die
  Adresse (`router.push`), und die Seite rechnet neu.
- **Die Wahl bleibt im Browser:** Eine Wahl im Verlauf, in der Liste oder an einem Rekord ändert nur die Ablesung
  (`periodReading`) und schreibt `pick` mit `replaceState` in die Adresse. Kein Weg zum Server, wie auf der Seite einer
  Scheibe. Eine geladene Adresse mit `pick` rechnet der Server mit.
- **Kleine Scheibe der Ablesung:** Der Server liefert die Lagen der Scheibe, die die Ablesung beim Laden zeigt. Für
  eine andere Wahl holt die Hülle sie über die Server Action `cardMarksAction(cardId)` (nur eigene, nicht gelöschte
  Scheiben) und merkt sie sich. Bis sie da sind, zeigt `CardReadout` einen leeren Platz: `marks: null` heißt „lädt“,
  ein leeres Array weiter „ohne Lage“. So geht „Alles“ ohne die Lagen jeder Scheibe an den Browser.
- **Wie im Labor:** Seitenaufbau, Sprungleiste, Rücksprung, Verlauf mit Lineal, Umfang, Ergebnis, Ablesung, Liste,
  Zahlen und Analyse. Kein Labor-Werkzeug, keine eigene Wertung.

## Aufgaben

1. **`shot-ui`:**
   - `lightPeriodModel(model)` mit Test: die Projektion der Scheiben leer bis auf `probeOnly`, `printedShots`,
     `suspicious` und `version`. `CardList`, `CardReadout`, `PeriodChart` und `PeriodResult` zeichnen damit dasselbe
     Markup wie mit dem vollen Modell.
   - `CardReadout.marks: readonly MarkShot[] | null`: null zeigt einen leeren Platz gleicher Größe (`aria-hidden`), kein
     „ohne Lage“. Test.
2. **Server Action** `apps/spiegel/src/lib/marks-actions.ts` (`"use server"`): `cardMarksAction(cardId)` gibt die
   Lagen der eigenen, nicht gelöschten Scheibe zurück, sonst `null`, ohne Sitzung ebenfalls `null`. Test mit
   gemockter Sitzung gegen die Dev-Datenbank.
3. **Seite** `apps/spiegel/src/app/(app)/progress/page.tsx`:
   - Abfrage über `searchOf` und `routeFromUrl`, dann `ownerCards`, `listable`, `familiesOf`.
   - Familie: die aus der Adresse, sonst die der neuesten Scheibe. Zustand über `periodStateFromRoute` mit der Wertung
     des Geräts.
   - `periodModel` über die Scheiben der Familie mit `chosen: null`, dann `lightPeriodModel`. Die erste Ablesung mit
     `query.chosen`, dazu ihre Lagen.
   - Ohne Scheiben `NoCards`.
4. **Hülle** `apps/spiegel/src/components/progress/ProgressScreen.tsx` nach `PeriodView` des Labors:
   - `dispatch`: Filter → `router.push`; Wahl → eigener Zustand, `periodReading` und `replaceState`.
   - Lagen-Cache mit `cardMarksAction`.
   - Hilfe über `useHelp`, „Erklärungen“ als Zustand, Rücksprung und Sprungleiste wie im Labor.
5. **Messung** (`tools/measure.ts`): Fortschritt „Alles“ auf dem Server (lesen, rechnen, leicht machen). Gemessen
   werden die Zeit und die Größe dessen, was an den Browser geht.
6. **Doku:**
   - [[spiegel-navigation]] (Fortschritt in der App), Roadmap (N7, Fortschritt).
   - `apps/spiegel/CLAUDE.md` (Aufbau, Wahl im Browser).
   - [[spiegel-db-schema]] (Messung), `packages/shot-ui/CLAUDE.md` (`lightPeriodModel`, `CardReadout.marks`).

## Dateien

- `packages/shot-ui/src/period/model.ts`, `period/CardReadout.tsx` und ihre Tests
- `apps/spiegel/src/lib/marks-actions.ts` und Test, `src/app/(app)/progress/page.tsx`,
  `src/components/progress/ProgressScreen.tsx`
- `apps/spiegel/tools/measure.ts`
- Doku wie in Aufgabe 6

## Required Docs

- `packages/shot-ui/CLAUDE.md` (Seite eines Zeitraums, Rahmen und Links, Zustand in der Adresse)
- `apps/spiegel/CLAUDE.md`, [[spiegel-navigation]], [[spiegel-langzeit]]
- `vault/conventions.md` §9 und §10
- `tools/labor/src/PeriodView.tsx` (Vorbild der Verdrahtung)

## Tests

- `shot-ui`: das leichte Modell zeichnet dasselbe; `CardReadout` mit `marks: null`.
- App: `cardMarksAction` (eigene Scheibe, fremde, gelöschte, ohne Sitzung).
- Labor: Skriptprüfung unverändert grün.

## Verifikation

- `pnpm check` grün, `vault-lint` gültig, Labor `pruefen` mit 0 FAIL.
- Browser mit den eigenen Scheiben, Ablauf:
  - Fortschritt öffnen (Vorgabe Luftpistole, letzte 90 Tage), dann „Alles“, Vergleich mit dem Zeitraum davor,
    Kennzahl, Art, „nur Probe“, Darstellung je Monat.
  - Eine Wahl im Verlauf, in der Liste und an einem Rekord: Die Ablesung folgt, die kleine Scheibe lädt nach, `pick`
    steht in der Adresse, kein Weg zum Server.
  - Neu laden mit `pick`. „Scheibe öffnen“ mit Rückweg und Blättern. „Alle in Scheiben zeigen“.
  - Telefonbreite. Konsole im frischen Tab, Server-Log.
- Zahlen gegen das Labor: Die Luftpistole sind dort dieselben echten Scheiben. Ergebnis, Kacheln und Rekorde im
  Zeitraum „Alles“ gleich, bei gleichem „jetzt“ oder einem Zeitraum ohne Bezug zu „jetzt“.
- Messung aus Aufgabe 5 im Bericht.
