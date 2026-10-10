# Labor mit den echten Scheiben des Users

## Kontext

Der User will die eigenen Scheiben im Labor sehen und die erfundenen Luftpistolen-Scheiben los sein (10. Oktober
2026: „nimm meine echten scheiben ins labor. entferne die anderen LP scheiben“, dann „nimm die echten daten von mir
einfach“). Das Fixture in `shot-core` (`meyton-eigene-scheiben.ts`) hat weder Datum noch Uhrzeit; ohne sie gibt es keine
Abende, keinen Verlauf und kein Tempo. Deshalb kommen die Scheiben neu aus der privaten Kopie der SSMDB2 vom 9. Oktober
2026, mit Datum und Schusszeiten. ADR-029 schließt echte personenbezogene Daten im öffentlichen Repo aus; die eigenen
Daten des Users mit Zustimmung des Users sind die Ausnahme (seit 9. Oktober für das Fixture, jetzt mit Datum und Uhrzeit).
Ohne Name, Sportpass und ScheibenID.

## Ansatz

- **Daten:** `tools/labor/src/ownCards.ts`, einmalig erzeugt aus der Kopie (Container und Auszug danach gelöscht): 35
  Scheiben mit Schüssen (die leere fehlt), je Disziplin-ID und -Name, Beginn in UTC und je Schuss Stellung, Nummer,
  Serie, Lage in µm, Abstand zum ersten Schuss in ms, Meytons Zehntel, Innenzehner, Anzeigeart. Nummern wie im Fixture
  von `shot-core`.
- **Saison** (`tools/labor/src/season.ts`):
  - Die erfundene Luftpistole entfällt ganz (Wettkämpfe, Trainings, Zusatzscheiben).
  - Die echten Scheiben kommen über den Fachkern dazu: Scheibenbild über `resolveTarget` (Name der Disziplin),
    Familie über `suggestFamily`. Ohne Scheibenbild (Zimmerstutzen, „LP Schach 6x6“) oder verdeckt (Anzeigeart 5,
    „König LP“, SF-19) bleibt eine Scheibe weg.
  - Art Training (alle „Direktbelegung“ ohne Status). Amtliche Wertung: zuerst aus der Anzeigeart; nach dem Review
    nie aus ihr (SF-74), bis SP-1.6 nach der Waffe (Luftpistole ganze Ringe wie am Ausdruck, Luftgewehr unbekannt).
  - Vollständigkeit über `classifyCompleteness` mit der Schusszahl der Disziplin; unvollständig ergibt
    `complete: false` und das Merkmal `unvollstaendig` (SF-07).
  - Ids wie bisher über `cardId(Scheibe, Tag, Platz am Abend)`.
  - Die zwei echten LG-Scheiben gehen in die Familie Luftgewehr neben die erfundene Saison.
  - „Jetzt“ wird der 10. Oktober 2026, 12:00 Uhr MESZ (nach dem letzten echten Abend).
  - Der letzte Abend bleibt ein Mischabend (Review N5): Zwei erfundene LG-Trainings stehen am Abend der neuesten echten
    Scheibe, damit Start zwei Blöcke und Kacheln nebeneinander zeigt.
- **Beispielscheiben** (`samples.ts`) bleiben erfunden: Die Skriptprüfung testet an ihnen gezielte Fälle (Abreißer,
  Pause, Setzen).

## Dateien

- neu: `tools/labor/src/ownCards.ts`
- `tools/labor/src/season.ts`, `tools/labor/src/season.test.ts`
- `tools/labor/pruefung.js` (Prüfungen, die an der erfundenen Luftpistole oder an „jetzt“ hängen)
- Doku: `tools/labor/CLAUDE.md`, `vault/decisions/adr-029.md` (Folgen: Ausnahme eigene Daten), `vault/spiegel/spiegel-roadmap.md`

## Required Docs

- `tools/labor/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`, `vault/conventions.md`
- `vault/meyton/meyton-ssmdb2.md` (Skalen, Anzeigeart, Zeiten nach der Uhr des Stands)

## Tests

1. `season.test.ts`:
   - Für jede echte Scheibe im Labor ist der Wert aus der Lage gleich Meytons `Ring01`.
   - Weggelassen sind genau Zimmerstutzen, Schach und König.
   - Die Luftpistole ist nur echt: 30 Scheiben, alle Training.
   - Amtliche Wertung aus der Anzeigeart, Merkmal `unvollstaendig` an den unvollständigen.
   - Zeiten in Berlin: der 9. Oktober um 19:17, der 18. Oktober 2024 in der Sommerzeit, der 12. November 2024 in der
     Winterzeit.
   - Mischabend am 9. Oktober.
   - Das Luftgewehr der Saison bleibt gleich (Fingerabdruck), dazu die zwei echten.
2. Skriptprüfung: `pnpm --filter @vereinsheim/labor pruefen` 0 FAIL nach Anpassung der Prüfungen.

## Verifikation

- `pnpm check` grün.
- Labor direkt gebaut, Skriptprüfung 0 FAIL.
- Sichtprüfung im Bild: Start, Scheiben (Luftpistole) und Fortschritt (Luftpistole, „Alles“).
- Artifact neu veröffentlicht.
