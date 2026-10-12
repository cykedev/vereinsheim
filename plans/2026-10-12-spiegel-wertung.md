# Spiegel: Wertung je Scheibe und je Familie statt des Geräts

## Kontext

Der User am 12. Oktober 2026: „ich weiss auch nicht, ob es ein ‚device scoring‘ geben sollte, denn das hängt ja von der
disziplin und dem modus ab, in dem geschossen wird. ich denke man sollte es, neben den defaults, pro scheibe umstellen
können und es wird automatisch gespeichert“. Auf Rückfrage hat er gewählt:
- **Vorgabe „wie am Stand“:** Wettkampf in der amtlichen Wertung der Disziplin, Training in der Anzeigeart am Stand;
  ohne beides Zehntel.
- **Schnitte „je Familie“:** Jede Familie hat eine Wertung, vorgegeben aus ihren Scheiben, umstellbar im Fortschritt
  und in der Liste, automatisch gespeichert. Die Einstellung des Geräts entfällt.

Das löst zwei Entscheidungen vom 9. Oktober ab:
- [[spiegel-durchsicht]], Entscheidung 2: „Zehntel und ganze Ringe stehen nur noch auf der Scheibe und als Einstellung
  des Geräts in Profil“.
- [[spiegel-langzeit]]: „Kein Schalter der Wertung: Der Fortschritt zeigt die Wertung des Geräts“.

Geprüft vor dem Plan:
- **Anzeigeart je Schuss:** Meyton liefert sie als `Treffer.Wertung` ([[meyton-ssmdb2]]); sie liegt als `displayMode`
  an jedem Schuss. 1 und 7 heißen Zehntel, 2 und 8 ganze Ringe; die übrigen Codes (Teiler, verdeckt, …) sagen nichts
  über die Wertung.
- **Bestand des Users:** 29 Trainings LP in ganzen Ringen (2), eine LP 20 in Zehnteln (7), die zwei LG in ganzen Ringen
  (ohne amtliche Wertung).
- **Wo die Wertung des Geräts heute wirkt:**
  - Cookie `spiegel-scoring` (`src/lib/device*.ts`), `pageContext.scoring`, Profil;
  - Start, Liste und Fortschritt (vorn ohne amtliche Wertung, Ø, Abstand, Verlauf);
  - die Seite einer Scheibe merkt sich beim Umschalten die Wertung als Wertung des Geräts.

## Entscheidungen

- **Wertung einer Scheibe** = gewählt (`Card.scoringChoice`), sonst die Vorgabe:
  - Wettkampf: amtlich der Disziplin, sonst wie am Stand;
  - Training: wie am Stand, sonst amtlich;
  - ohne beides Zehntel.

  „Wie am Stand“ (`Card.standScoring`) schreibt `writeRevision` aus der Anzeigeart der Schüsse wie am Ausdruck: die
  häufigste von Zehntel und ganzen Ringen, bei Gleichstand die des letzten Schusses. Die Regel ist eine reine Funktion
  (`src/lib/scoring.ts`) mit Tests.
- **Umschalten auf der Seite einer Scheibe speichert** (Server Action `setCardScoring`, nur der Besitzer). Die Adresse
  trägt die Wertung weiter (`scoring=rings` oder `scoring=decimal`). **Ohne Angabe gilt die der Scheibe:**
  `CardRoute.scoring` wird `Scoring | null`. Wege zu einer Scheibe (Liste, Start, Fortschritt, Blättern) geben `null`;
  nur ein Rekord öffnet in seiner Wertung.
- **Wertung einer Familie** (`FamilyScoring`: Schütze, Familie, Wertung) = gespeichert, sonst die häufigste Wertung
  ihrer Scheiben; bei Gleichstand Zehntel. Mit ihr rechnen:
  - in der Liste Ø und Abstand;
  - auf Start der Block der Familie (Ø des Abends, Schnitt, Band, Verlauf, Rekorde), jeder Block in seiner;
  - Fortschritt.

  Umschalten über `ScoringSwitch` im Fortschritt (Ergebnis-Box, Platz `scoring`) und in der Liste (neben dem Kopf),
  automatisch gespeichert (`setFamilyScoring`), danach rechnet die Seite neu.
- **Vorn in Liste und Start steht die Wertung der Scheibe** (`ProjectedCard.scoring`), fett mit „Fett: Wertung der
  Scheibe“. Ohne sie (Labor) gilt wie bisher die amtliche.
- **Das Gerät hat keine Wertung mehr:** Cookie, `deviceScoring`, `rememberScoring` und der Schalter in Profil entfallen.
- **Labor:** kennt keine Datenbank. Es behält seine eine Wertung als Wertung jeder Familie (Profil des Labors) und die
  amtliche als Wertung der Scheibe. `startModel` nimmt die Wertung je Familie (`scoringOf`), das Labor gibt überall
  dieselbe.

## Aufgaben

1. **Regel** `apps/spiegel/src/lib/scoring.ts`: `standScoringOf(shots)`, `cardScoring({ kind, official, stand,
   choice })`, `familyScoringOf(cards, saved)`. Tests zuerst.
2. **Schema:**
   - `Card.standScoring Scoring?` und `Card.scoringChoice Scoring?`.
   - Tabelle `FamilyScoring(userId, familyId, scoring)` mit Schlüssel aus beiden, Löschen mit Schütze und Familie.
   - `init` neu erzeugen und in einem Wegwerf-Postgres prüfen; die Dev-Datenbank nicht destruktiv nachziehen.
   - `writeRevision` setzt `standScoring`. Für die Dev-Datenbank füllt ein erneutes `seed:own` die Spalte (gleiche
     Schüsse ändern die Merkmale trotzdem). Test.
3. **Lesen:**
   - `OverviewCard.scoring` und `PageCard.scoring` (die Wertung der Scheibe), dazu `PageCard.official`.
   - `familyScorings(db, ownerId)` (gespeichert). Tests.
4. **Server Actions** `src/lib/scoring-actions.ts`: `setCardScoring(cardId, scoring)` und `setFamilyScoring(familySlug,
   scoring)`, nur eigene Scheiben bzw. Familien mit eigenen Scheiben; `ActionResult`. Tests.
5. **shot-ui:**
   - `ProjectedCard.scoring?` (shot-core) und `cardListModel` vorn mit der Wertung der Scheibe.
   - `startModel` mit `scoringOf(family)`.
   - `CardRoute.scoring: Scoring | null` mit Codec, `openCard` und `siblingRoute` mit null, `backRoute`.
   - `lightPeriodModel` behält `scoring`.
   - Legende der Liste „Fett: Wertung der Scheibe.“
   - Tests angepasst, dazu Fälle für die Wertung der Scheibe vorn und die je Familie auf Start.
6. **App:**
   - `overview.ts` rechnet je Familie in ihrer Wertung (Start je Block).
   - Liste und Fortschritt mit Schalter.
   - Die Seite einer Scheibe startet in `route.scoring ?? card.scoring` und speichert beim Umschalten.
   - `pageContext` ohne Wertung; Cookie, Profil-Schalter und `device*.ts` entfallen.
7. **Labor:** `startModel` mit `scoringOf`, `CardRoute.scoring` null (die Scheibe startet in der amtlichen, sonst der
   Wertung des Labors). Die Skriptprüfung bleibt grün.
8. **Doku:**
   - [[spiegel-durchsicht]] und [[spiegel-langzeit]] (abgelöst, mit Datum), [[spiegel-navigation]], [[spiegel-db-schema]].
   - `apps/spiegel/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`.

## Dateien

- `apps/spiegel/prisma/schema.prisma`, `prisma/migrations/*_init/migration.sql`
- `apps/spiegel/src/lib/{scoring,scoring-actions,overview,page-context}.ts`, `src/lib/db/{cards,reads}.ts`, Tests
- `apps/spiegel/src/lib/device*.ts` (entfallen), `src/app/(app)/**/page.tsx`, `src/components/{card,list,start,
  progress,profile}/*Screen.tsx`
- `packages/shot-core/src/analysis/projection.ts` (`ProjectedCard.scoring?`)
- `packages/shot-ui/src/{list/evenings.ts,list/EveningList.tsx,start/model.ts,nav/routes.ts,nav/navigate.ts,
  period/model.ts}` und Tests
- `tools/labor/src/*` (Anpassung)
- Doku wie in Aufgabe 8

## Required Docs

- [[spiegel-durchsicht]], [[spiegel-langzeit]], [[spiegel-navigation]], [[meyton-ssmdb2]] (Wertung), [[adr-031]]
  (amtliche Wertung an der Disziplin, SF-74)
- `apps/spiegel/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`, `vault/conventions.md` §9 und §10

## Tests

- **Regel:**
  - Anzeigeart 1, 7, 2, 8 und gemischt (häufigste, Gleichstand der letzte Schuss);
  - andere Codes zählen nicht, ohne Schüsse null;
  - Vorgabe je Art; Wahl vor Vorgabe;
  - Familie: gespeichert, sonst die häufigste, Gleichstand Zehntel.
- **Datenbank:** `writeRevision` schreibt `standScoring`; die Actions (eigene, fremde, gelöschte Scheibe, unbekannte
  Familie, ohne Sitzung); `ownerCards` und `cardWithShots` mit Wertung der Scheibe; `overview.ts` je Familie.
- **shot-ui:**
  - Liste vorn in der Wertung der Scheibe, Ø in der der Familie;
  - Start je Block in seiner Wertung;
  - Codec der Scheibe mit null.

## Verifikation

- `pnpm check`, Labor `pruefen`, `vault-lint`.
- Browser mit den eigenen Scheiben:
  - Liste: vorn ganze Ringe, die LP 20 in Zehnteln; Ø in der Wertung der Familie.
  - Schalter der Familie in Liste und Fortschritt: gespeichert, auch nach Neuladen.
  - Seite einer Scheibe: startet in ihrer Wertung, Umschalten bleibt nach Neuladen und in der Liste vorn.
  - Start je Block; Profil ohne Wertung; Konsole sauber.
