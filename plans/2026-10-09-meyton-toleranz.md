# Plan — Meyton-Toleranz in der Wertung (Nachtrag SP-1.1, SF-75, SF-76)

Branch `feat/spiegel-sprache` (auf Wunsch des Users kein eigener Branch, 9. Oktober 2026). Nachtrag zu SP-1.1
der Roadmap: Der Abend-Mitschnitt vom 9. Oktober 2026 zeigt, dass Meyton anders wertet als `shot-core`.

## Kontext

`shot-core` wertet nach der Regel: Ein Schuss erreicht den Wert k, wenn sein Abstand d höchstens die Grenze
b(k) = R − (k − 100) · W ÷ 10 ist (R = Zehnerradius + halbes Kaliber, W = Ringabstand). Am Abend vom
9. Oktober 2026 stimmten damit 625 von 640 echten Schüssen (LG 395, LP 245) mit Meyton überein; die übrigen 15
wertet Meyton jeweils ein Zehntel höher (`vault/sources/src-ssmdb2-abend-2026-10-09.md`, Befund 9).

Ein einziges Modell erklärt alle 640 Zehntel und alle Innenzehner, aus der Lage (1/100 mm) wie aus `Teiler001`
(0,1 µm): **Meyton legt jede Grenze T = 10 µm weiter nach außen, und der Abstand muss darunter liegen (strikt)**:
k ist erreicht, wenn d < b(k) + T; Innenzehner, wenn d < Innenzehner-Grenze + T. Die Daten grenzen T ein:

| Schuss (anonym, nur Abstand) | Meyton | verlangt |
|---|---|---|
| LG, d = 6509,3 µm | 8,4 | T > 9,3 |
| LG, d = 1510,0 µm | 10,3 | T ≤ 10,0 |
| LP, d = 11207,6 µm (Schuss 30 des Users) | 9,6 | T > 7,6 |
| LP, d = 1611,9 µm | 10,7 | T ≤ 11,9 |

Also LG 9,3 < T ≤ 10, LP 7,6 < T ≤ 11,9: T = 10 µm für beide. Dazu der Ausdruck (SF-76): Trefferkreis =
kleinster Hüllkreis der Schussmitten + Kaliber 4,5 mm, auf 1/100 mm gerundet; Trefferlage = Schwerpunkt, auf
1/100 mm abgeschnitten (`vault/meyton/meyton-printout.md`).

## Entscheidungen

- **E1 — Eine Konstante, keine Eigenschaft der Scheibe.** `export const MEYTON_TOLERANCE_UM = 10` in
  `scoring.ts`. `boundaryUm` addiert sie, alle Vergleiche werden strikt (`<`): Zehntel, Fehlschussgrenze und
  Innenzehner. `TargetImage` bleibt regelgerecht, damit das Zeichnen (`shot-ui/geometry.ts`, Ringe) sich nicht
  verschiebt. Ein Feld je Scheibenbild ist verworfen: Für LG und LP ist dasselbe T belegt, und Spiegel wertet nur
  Meyton-Daten (ADR-026).
- **E2 — Kein Schalter „reine Regel“.** Das Paket wertet wie Meyton (`packages/shot-core/CLAUDE.md`); auch die
  Neu-Wertung (`rescore`, SF-16) nutzt die Toleranz. Kein Aufrufer braucht die Regel ohne Toleranz.
- **E3 — Gegenprobe unverändert.** `verify.ts` bleibt; mit der neuen Wertung werden die 15 Schüsse „match“ statt
  „boundary“. Nur die Testwerte an den Grenzen wandern um 10 µm.
- **E4 — Testdaten.** Ins Repo kommen die 40 Wertungsschüsse des Users (Stand 9, LP 40 alt) ohne Name, ID und
  Zeit, und die vier Grenzabstände oben, nur als Abstand und Wert. Die übrigen 600 Schüsse anderer Mitglieder
  kommen **nicht** ins öffentliche Repo, solange der User es nicht ausdrücklich freigibt (ADR-029); ihre
  Gegenprobe wurde lokal gerechnet (640 von 640) und steht in der Quellen-Note.
- **E5 — Rundung des Ausdrucks ohne neuen Code.** Spiegel zeigt eigene Zahlen mit eigenen Namen: „Streukreis“
  ohne Kaliber (eine Nachkommastelle), Schwerpunkt-Richtung mit einer Stelle. Kein UI-Wert gibt sich als
  Meytons Trefferkreis oder Trefferlage aus, also muss nichts wie Meyton gerundet werden. Ein Test rechnet beide
  Werte des Ausdrucks mit `smallestEnclosingCircle` und `centroid` nach und hält so fest, wie sie entstehen; das
  Glossar sagt es in Worten.
- **E6 — Simulation neu.** Die Belege B6, B10, B19 und B20 ändern sich in der ersten Nachkommastelle (Probelauf
  vom 9. Oktober 2026); kein Hilfetext zitiert sie, nur der Belegblock in `vault/spiegel/spiegel-statistics.md`.

## Required Docs

- `packages/shot-core/CLAUDE.md` (Exakte Wertung, Tests)
- `vault/sources/src-ssmdb2-abend-2026-10-09.md` (Befunde 9 und 10)
- `vault/spiegel/spiegel-target-library.md` (Wertungsformel)
- `vault/spiegel/spiegel-edge-cases.md` (SF-75, SF-76)
- `vault/conventions.md` §9 (Mutationsprobe, `toBeCloseTo`)

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-core/src/__fixtures__/meyton-2026-10-09.ts` (neu) | 40 Schüsse, Werte des Ausdrucks, Grenzabstände |
| `packages/shot-core/src/scoring.ts` | `MEYTON_TOLERANCE_UM`, Grenze + T, strikte Vergleiche, Kopfkommentar |
| `packages/shot-core/src/scoring.test.ts` | Grenztests auf die Toleranz, neuer Block „Abend vom 9. Oktober 2026“ |
| `packages/shot-core/src/verify.test.ts` | vier Grenztests mit neuen Abständen |
| `packages/shot-core/src/geometry.test.ts` | Block „Ausdruck vom 9. Oktober 2026“ (SF-76) |
| `packages/shot-core/src/geometry.ts` | Kopfkommentar: Trefferkreis geklärt |
| `packages/shot-core/CLAUDE.md` | Punkt „Exakte Wertung“ um die Toleranz ergänzen |
| `packages/shot-help/src/glossary.ts`, `vault/spiegel/spiegel-statistics-help.md` (erzeugt) | Streukreis und Trefferkreis |
| `vault/spiegel/spiegel-statistics.md` | Belegblock neu, Stand-Satz |
| `vault/spiegel/spiegel-target-library.md`, `spiegel-edge-cases.md`, `spiegel-roadmap.md`, `vault/meyton/meyton-ssmdb2.md` | Doku |

## Aufgaben

1. **Fixture anlegen.** Die Schüsse aus dem privaten Mitschnitt ziehen (nur lokal vorhanden, nie ins Repo):

   ```bash
   awk -F'\t' '/^# stand /{delete t; k=0; sec=""; next} /^#Treffer/{sec="T"; getline; next} /^#Scheiben|^#Serien/{sec=""} sec=="T" && $1==439041101 && $2==1 {t[++k]=sprintf("  [%s, %s, %s, %s, %s, %s, %s],", $3, $4, $5*10, $6*10, $13, $11, ($7!=0)?"true":"false")} END{for(i=1;i<=k;i++) print t[i]}' ~/ssmdb2-erkundung/2026-10-09_1857/bericht/protokoll.tsv
   ```

   Spalten: Nummer, Serie, x in µm, y in µm, `Teiler001` (0,1 µm), Zehntel, Innenzehner. Kontrolle: 40 Zeilen,
   Zeile 1 `[1, 1, -7600, -5710, 95060, 98, false]`, Zeile 30 `[30, 3, -10880, -2690, 112076, 96, false]`,
   Zeile 31 `[31, 4, -1150, -890, 14541, 108, true]`, Summe der Zehntel 3564.
   In `__fixtures__/meyton-2026-10-09.ts` exportieren:
   - `EVENING_SHOTS`: die 40 Zeilen als `{ nr, series, xUm, yUm, distanceUm: teiler001 / 10, decimalTenths, innerTen }`;
   - `EVENING_PRINTOUT`: `{ total: 3564, enclosingMm: [84.11, 82.48, 58.04, 39.6, 50.04], mpiMm: [[0.21, 3.25], [2.05, 2.41], [5.75, 4.4], [3.97, 8.46], [-10.92, -2.26]] }` (Index 0 die ganze Scheibe, dann Serie 1 bis 4; Vorzeichen: rechts und hoch positiv);
   - `BOUNDARY_DISTANCES`: `[{ target: "lg-10m", um: 6509.3, tenths: 84 }, { target: "lg-10m", um: 1510, tenths: 103 }, { target: "lp-10m", um: 11207.6, tenths: 96 }, { target: "lp-10m", um: 1611.9, tenths: 107 }]`.

   Kopfkommentar: Herkunft (Abend-Mitschnitt und Ausdruck vom 9. Oktober 2026), ohne Name, ID und Zeit, die
   Grenzabstände sind einzelne anonyme Abstände (ADR-029).

2. **Tests zuerst (rot).**
   - `scoring.test.ts`, neuer Block „Abend vom 9. Oktober 2026 (Meyton-Toleranz, SF-75)“:
     - jeder der 40 Schüsse: `scoreFromCoordinates(LP_10M, xUm, yUm)` und `scoreFromDistance(LP_10M, distanceUm)`
       ergeben `decimalTenths` und `innerTen` wie Meyton; die Summe ist 3564;
     - jeder Grenzabstand aus `BOUNDARY_DISTANCES` ergibt seine Zehntel (über `TARGETS[target]`).
   - Bestehende Grenztests auf die Toleranz umstellen (Name sagt „Meyton: bis 10 µm hinter der Grenze“):
     - „genau auf der Grenze …“: LP 63200 → 31, 63209,99 → 31, 63210 → 30; LG 19750 → 31, 19759 → 31, 19760 → 30
       (die Zeile mit der naiven Formel bleibt);
     - „höchstens 10,9“: `edge + 9` → 109, `edge + 10` → 108;
     - Innenzehner LP: 4759 → `{104, true}`, 4760 → `{104, false}`;
     - Innenzehner LG: 2009 → `{102, true}`, 2010 → `{101, false}`;
     - Fehlschuss: `limit + 9` → `{10, 1, false, false}`, `limit + 10` → Fehlschuss;
     - ganzer Ring: 8009 → 10, 8010 → 9, 16009 → 9, 16010 → 8;
     - Koordinaten: (960, 1280) → 108, (0, 1609) → 108, (0, 1610) → 107;
     - Eigenschaft: `miss` genau dann, wenn `d >= missLimit(t) + MEYTON_TOLERANCE_UM`.
   - `verify.test.ts`:
     - „Innenzehner kippt“: `shot(4750, 104)` → `shot(4759.8, 104)` (bleibt „boundary“), `shot(4000, 105)` bleibt
       „mismatch“;
     - „Innenzehner knapp jenseits“: 4750,4 → 4760,4 („boundary“);
     - „misst zuerst über den Abstand“: Abstand 3207 → 3212, Lage (0, 3200) bleibt; aus der Lage allein käme 10,6,
       aus dem Abstand 10,5 (Kommentar entsprechend);
     - „Ganzring“: 16000 → 16009,8 (Ring 9 „match“, Ring 8 „boundary“, Ring 7 „mismatch“).
   - Lauf: `pnpm --filter @vereinsheim/shot-core test` — rot sind genau der neue Block (Schuss 30 und die
     Grenzabstände) und die umgestellten Grenztests.

3. **Wertung umstellen.** In `scoring.ts`:
   - `export const MEYTON_TOLERANCE_UM = 10` mit Kommentar (Befund, Grenzen der Eingrenzung, SF-75);
   - `boundaryUm` = `scoringRadiusUm + MEYTON_TOLERANCE_UM − (k − 100) · W ÷ 10` (bleibt ein ganzes µm);
   - Startwert in `scoreWith` mit `scoringRadiusUm + MEYTON_TOLERANCE_UM`;
   - `innerTen: within(innerTenMaxDistanceUm + MEYTON_TOLERANCE_UM)`;
   - `scoreFromCoordinates`: `squared < limit * limit`; `scoreFromDistance`: `hundredths < limit * 100`;
   - Kopfkommentar: Regel, Meytons Verschiebung, strikt, exakt ganzzahlig wie bisher.
   Lauf: alle Tests von `shot-core` grün.

4. **Mutationsprobe** (nach `vault/conventions.md` §9, nur lokal, danach zurück):
   - T = 9: „Abend …“ rot (LG 6509,3 µm ergibt 8,3);
   - T = 11: rot (LG 1510 µm ergibt 10,4);
   - T = 0: rot (Schuss 30 ergibt 9,5);
   - `<` statt `<=` zurück auf `<=`: rot (LG 1510 µm ergibt 10,4).

5. **Ausdruck nachrechnen (SF-76).** `geometry.test.ts`, Block „Ausdruck vom 9. Oktober 2026“:
   - Trefferkreis je Index (ganze Scheibe, Serie 1–4): `Math.round((2 · smallestEnclosingCircle(p).radiusUm + 4500) / 10) / 100`
     ergibt `EVENING_PRINTOUT.enclosingMm`;
   - Trefferlage: `Math.trunc(centroid(p).xUm / 10) / 100` und dasselbe für y ergeben `EVENING_PRINTOUT.mpiMm`;
   - Gegenprobe im Test selbst: gerundet statt abgeschnitten ergibt für Serie 2 x = 5,76 ≠ 5,75; der größte
     Abstand zweier Treffer (`extremeSpread`) plus Kaliber ergibt für die ganze Scheibe 82,48 ≠ 84,11.
   - `geometry.ts` Kopfkommentar: „Meytons Trefferkreis ist der Streukreis plus Kaliber, auf 1/100 mm gerundet;
     die Trefferlage der Schwerpunkt, abgeschnitten (Ausdruck vom 9. Oktober 2026)“ statt „klärt SP-0.6“.

6. **Glossar und Leitfaden.** `shot-help/src/glossary.ts`, Eintrag „Streukreis“: „Kleinster Kreis um alle
   Trefferzentren, Mitte zu Mitte; die Zahl ist sein Durchmesser. Meytons „Trefferkreis“ ist derselbe Kreis
   plus ein Kaliber (4,5 mm), deshalb größer.“ Eintrag „Schwerpunkt“ bleibt. Dann
   `pnpm --filter @vereinsheim/shot-help docs` und `pnpm --filter @vereinsheim/shot-help test`.

7. **Simulation.** `pnpm --filter @vereinsheim/shot-help simulate`; den Belegblock in
   `vault/spiegel/spiegel-statistics.md` durch die neue Ausgabe ersetzen, im Satz davor ergänzen: „Wertung mit
   Meytons Toleranz von 10 µm (9. Oktober 2026); dadurch neu B6, B10, B19, B20, alle übrigen unverändert“.
   Prüfen, dass kein Hilfetext eine der alten Zahlen zitiert (Probelauf vom 9. Oktober 2026: keine Treffer):

   ```bash
   grep -rn "3,8 %\|27,3 %\|1,32 Ringe\|58,8 %\|61,5 %\|94,3 %\|69,8 %\|63,7 %" packages/shot-help/src vault/spiegel/spiegel-statistics-help.md
   ```

8. **Doku.**
   - `packages/shot-core/CLAUDE.md`: Punkt „Exakte Wertung“ um T = 10 µm und den strikten Vergleich ergänzen;
   - `vault/spiegel/spiegel-target-library.md`: unter der Formel die Meyton-Toleranz mit Belegen und Verweis auf
     SF-75;
   - `vault/spiegel/spiegel-edge-cases.md`: SF-75 und SF-76, Spalte „Prüfen“ auf die neuen Tests;
   - `vault/spiegel/spiegel-roadmap.md`: SP-1.1 „Nachtrag offen“ → „Nachtrag erledigt (9. Oktober 2026)“;
   - `vault/meyton/meyton-ssmdb2.md`: Stolperfalle „`shot-core` übernimmt die Toleranz“ → „übernommen“.
   Dann `node .claude/vault-lint.mjs`.

## Teststeps

1. Nach Aufgabe 2: `pnpm --filter @vereinsheim/shot-core test` rot nur an den erwarteten Stellen.
2. Nach Aufgabe 3: `pnpm --filter @vereinsheim/shot-core test` grün; dann `pnpm --filter @vereinsheim/shot-ui test`,
   `pnpm --filter @vereinsheim/shot-help test`, `pnpm --filter @vereinsheim/labor test` grün (Probelauf vom
   9. Oktober 2026: 566, 33 und 14 Tests ohne Änderung grün).
3. Aufgabe 4: jede Mutation rot, danach wieder grün.
4. `node .claude/vault-lint.mjs`, `pnpm check` vor jedem Commit.

## Verification

- Gates grün; die vier Mutationen je rot.
- Lokal, nicht im Repo: Gegenprobe über alle 640 Schüsse des Abends mit der neuen `scoring.ts`
  (`scoreFromCoordinates` und `scoreFromDistance`): 640 von 640 Zehntel und Innenzehner.
- Simulation: nur B6, B10, B19, B20 anders.
- Offen nach dem Plan: die 600 Schüsse anderer Mitglieder als Fixture, nur mit Freigabe des Users (E4).
