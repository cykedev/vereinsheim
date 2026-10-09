# Plan — U3 Sprache

Branch `feat/spiegel-sprache` (auf `feat/spiegel-fortschritt-besser`). Dritter Schritt der Durchsicht vom 9. Oktober
2026 (`vault/spiegel/spiegel-durchsicht.md`, Befund B4 und „Offen nach U1“). Der User hat entschieden: Fachbegriffe
wie σ und R50 nur im Blatt „?“, auf der Seite das Alltagswort. Er hat U3 ausdrücklich autonom freigegeben („mach
autonom weiter, auch mit den weiteren Phasen“, 9. Oktober 2026).

## Kontext

Auf Ebene 1 und 2 der Leitlinie (Kopf, Überblick, Beobachtungen, Start, Kopf und Zahlen des Fortschritts, Listen)
stehen statistische Kennwerte und Kürzel:

- σ, R50, „T² 17,6, Grenze 6,7“;
- „mit 95 % kein Zufall“, „95 %: …“;
- „Median · mittlere Hälfte“;
- „höher, besser · bedeutsam“;
- Kalenderwochen als Achse;
- die Kürzel W, T und P.

Die Lage steht dazu dreimal mit denselben Zahlen: im Kopf, in der Kachel „Lage“ und unter den Beobachtungen.

## Entscheidungen

- **D1 Alltagswort auf Ebene 1 und 2, Fachbegriff im Blatt.**
  - Die Karten der Reiter (Ebene 3) behalten ihre Fachbegriffe in den Zeilen (R50, IQR, Hotelling). Ihr Titel nennt
    das Alltagswort.
  - Die Formeln bleiben im Blatt.
- **D2 Sätze der Beobachtungen** (Kopf und Überblick); die Zahlen bleiben gleich:

  | heute | neu |
  |---|---|
  | „Die Lage ist echt: Der Schwerpunkt liegt 5,5 mm links und 1,0 mm hoch neben der Mitte, mit 95 % kein Zufall.“ | „Deine Gruppe liegt 5,5 mm links und 1,0 mm hoch neben der Mitte; das ist sicher kein Zufall.“ |
  | „Der Schwerpunkt liegt 2,1 mm neben der Mitte; vom Zufall ist das nicht zu unterscheiden. Ein Versatz ist nicht belegt.“ | „Deine Gruppe liegt 2,1 mm neben der Mitte; das kann Zufall sein, ein Versatz ist nicht belegt.“ |
  | „Präzision σ 11,62 mm, mit 95 % zwischen 10,01 und 13,73 mm. Die Hälfte der Treffer liegt innerhalb von 1,54 Ringbreiten um den Schwerpunkt.“ | „Streuung 11,62 mm, sicher zwischen 10,01 und 13,73 mm. Die Hälfte der Treffer liegt innerhalb von 1,54 Ringbreiten um die Mitte der Gruppe.“ |
  | „…, R50 +1,77 mm.“ (Ermüdung) | „…, die Gruppe 1,77 mm weiter.“ |
  | „Tempo: im Median 56 s je Schuss; die mittlere Hälfte der Abstände liegt in einem Fenster von 14 s.“ | „Tempo: meist 56 s je Schuss; die Hälfte der Abstände liegt in einem Fenster von 14 s.“ |
  | „Die letzten fünf Probeschüsse lagen echt neben der Mitte (…).“ | „Die letzten fünf Probeschüsse lagen sicher neben der Mitte (…).“ |

- **D3 Kacheln des Überblicks:**
  - „Präzision σ“ heißt „Streuung“.
  - Die Angaben unter dem Wert:
    - „95 %: …“ wird „sicher …“;
    - „· T² …, Grenze …“ entfällt;
    - „Median · mittlere Hälfte in 14 s“ wird „die Hälfte in 14 s“.
  - Die Kachel „Lage“ nennt nur die Richtung ohne Zahlen (`directionName`, „links oben“); die Zahlen stehen in der
    Beobachtung („Offen nach U1“: die Lage dreifach).
- **D4 Zahlen des Fortschritts und Umschalter des Verlaufs:**
  - Anzeigenamen statt der Namen aus dem Fachkern, als Liste in `shot-ui` (`metricLabel(key)`):
    - `group.sigma` „Streuung“;
    - `group.sdX` „Streuung waagrecht“;
    - `group.sdY` „Streuung senkrecht“;
    - `time.intervalMedian` „Tempo“.
  - Der Umschalter des Verlaufs heißt „Streuung“ statt „σ“.
  - Der Fachkern bleibt unverändert.
- **D5 Urteil in Worten (`verdictText`):**
  - zu wenige: „zu wenige Scheiben“;
  - unklar: „kein klarer Unterschied“;
  - mit Richtung der Kennzahl: „besser“ / „schwächer“, mit „bedeutsam“ davor „deutlich “;
  - ohne Richtung (Tempo): „höher“ / „tiefer“, ebenso mit „deutlich “.
  - Gilt für Start (Form), Ergebnis-Box und Zahlen des Fortschritts.
- **D6 Wochen als Datum:**
  - „Umfang je Woche“ beschriftet mit dem Montag („06.07.“) statt „KW 27“;
  - das Lineal sagt „Woche ab 06.07.: …“.
- **D7 Art in den Listen** (Scheiben-Liste und Liste des Fortschritts):
  - Wettkampf als Symbol `Trophy` (lucide) mit Namen „Wettkampf“;
  - Training ohne Zeichen (Name „Training“ nur für Screenreader);
  - Training nur aus Probe als Wort „Probe“.
- **D8 Legende am Formband:** Unter dem Streifen auf Start eine Zeile „Das Band zeigt deine übliche Schwankung.“,
  nur mit Band.
- **D9 Hilfe:**
  - Das Thema `praezision-sigma` heißt „Streuung (σ)“.
  - Texte in `shot-help`, die die alten Urteilsworte zitieren („bedeutsam“), sagen die neuen.
  - Danach `pnpm --filter @vereinsheim/shot-help docs`.

- **D10 Ein negativer Lage-Anteil heißt „kostet nichts“** (User-Frage während der Umsetzung, 9. Oktober 2026: „ich sehe
  einen negativen Ringverlust durch die Lage … wie ist das möglich“).
  - Woher er kommt: Die Mitte ohne den Schuss selbst (Gruppe um n/(n−1) größer) oder ein Ausreißer, der den
    Schwerpunkt zieht.
  - Auf der Kachel „Ringverlust“ und in der Legende der Karte steht bei einem Lage-Anteil ≤ 0 „Lage kostet nichts“
    statt „Lage −0,4“.
  - Die Karte „Ringverlust nach Ursache“ nennt die Zahl mit einem Satz zum Grund: „Deine Gruppe sitzt schon gut; in
    die Mitte geschoben brächte sie rechnerisch nichts (Lage −0,4 Ringe).“
- **D11 Urteil der Lage in Alltagsworten** (User während der Umsetzung, 9. Oktober 2026: „Lage unklar ist auch seltsam
  und schwer zu verstehen“):
  - Kachel „Lage“: „versetzt“ mit der Richtung darunter („links oben“) oder „passt“ mit „kein Versatz belegt“, statt
    „echt“ und „unklar“.
  - Etikett im Reiter Lage: „sicher versetzt“ / „kann Zufall sein“.
  - Hilfe: Thema `lage-echt` heißt „Ist die Lage versetzt?“ (Id bleibt); Einstieg „„Sicher“ und „kann Zufall sein““;
    Texte außerhalb der Probe-Themen, die die alten Etiketten zitieren, nennen die neuen.
  - Ohne Probe (Abgleich mit U4, siehe unten): Kachel „Eingeschossen?“, Etikett im Reiter Probe und die Probe-Themen
    bleiben, wie sie sind; U4 entfernt sie.
- **Nebenbei (Fehler, User, 9. Oktober 2026):** „zeigen“ an einem Rekord sprang in einem hohen Fenster nicht zur
  gewählten Scheibe (der Verlauf klebt und galt als im Bild). Behoben in `d4db2a5` (`jumpTo` mit `shown`).

## Abgleich mit U4 „Probe wie am Ausdruck“ (9. Oktober 2026, abends)

- Eine parallele Session hat U4 geplant (`plans/2026-10-09-spiegel-probe-wie-ausdruck.md`, nach U3 auf eigenem
  Branch, [[adr-027]]): Eine Scheibe ist wie am Ausdruck, es gibt keine Scheibe mit Probe und Wertung mehr. Der Reiter
  „Probe“, die Kachel „Eingeschossen?“, die Sätze zu Probe gegen Wertung und die Hilfe-Themen `probe-umfang`,
  `probe-gegen-wertung`, `eingeschossen` fallen weg.
- U3 steckt deshalb keine Arbeit mehr in diese Teile:
  - D11 ohne Probe (Kachel „Eingeschossen?“, `SightersTab.tsx`, Probe-Themen bleiben unverändert);
  - D9 und D11 ändern in `shot-help` nur Texte außerhalb der Probe-Themen; der Einstieg „Probe und Wertung“ bleibt
    für U4;
  - die Skriptprüfung bekommt keine neuen Prüfungen für Probe neben Wertung.
- Schon erledigt, von U4 später entfernt: der Probe-Satz der Beobachtungen (Task 1) und die Angabe der Kachel
  „Eingeschossen?“ (Task 2).
- Reine Probe-Trainings bleiben: D7 („Probe“ in den Listen) gilt weiter.
- Nummerierung: Die Durchsicht nannte „Start und Liste“ U4; das heißt jetzt U5.
- Stand: `main` steht auf `140c7a0e`, gleich `feat/spiegel-sprache`, mit U2, Task 1–2 und dem Fix zu den Rekorden.
  U3 läuft auf `feat/spiegel-sprache` weiter.

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-ui/src/analysis/observations.ts` (+ Tests in `observations.test.ts`, `overview.test.ts`, `tabs/OverviewTab.test.tsx`) | Sätze D2 |
| `packages/shot-ui/src/analysis/overview.ts` (+ Test) | Kacheln D3 |
| `packages/shot-ui/src/format.ts` oder `src/labels.ts` (neu, + Test) | `metricLabel` D4 |
| `packages/shot-ui/src/period/model.ts`, `PeriodChart.tsx`, `PeriodTiles.tsx` (+ Tests) | Anzeigenamen D4 |
| `packages/shot-ui/src/period/sentence.ts` (+ `model.test.ts`) | `verdictText` D5 |
| `packages/shot-ui/src/period/calendar.ts`, `model.ts`, `VolumeChart.tsx` (+ Tests) | Wochen als Datum D6 |
| `packages/shot-ui/src/list/EveningList.tsx`, `period/CardList.tsx` (+ Tests) | Art D7 |
| `packages/shot-ui/src/start/EveningBlock.tsx` (+ Test) | Legende D8 |
| `packages/shot-help/src/topics.ts` (+ Test), `vault/spiegel/spiegel-statistics-help.md` (erzeugt) | D9 |
| `tools/labor/pruefung.js` | Texte nachziehen |
| `packages/shot-ui/CLAUDE.md`, `vault/spiegel/spiegel-durchsicht.md`, `spiegel-ui-design.md` | Doku |

## Aufgaben

1. **Sätze der Beobachtungen (D2):** Tests auf die neuen Sätze (zuerst rot), dann `observations.ts`.
2. **Kacheln des Überblicks (D3):** Tests, dann `overview.ts`.
3. **Anzeigenamen (D4):**
   - `metricLabel` mit Test;
   - verwendet in `PeriodTiles` (Bezeichnung), `PERIOD_CHART_METRICS` („Streuung“) und den Achsen des Verlaufs;
   - Tests der Seite nachziehen.
4. **Urteil in Worten (D5):** Tests in `model.test.ts` zuerst; `verdictText`; Start und Fortschritt folgen.
5. **Wochen als Datum (D6):**
   - `weekStartIso(key)` in `calendar.ts` mit Test;
   - `weeks[].label` als „06.07.“ (`formatShortDay`);
   - `VolumeChart` ohne `replace("KW ")`, Lineal „Woche ab …“.
6. **Art in den Listen (D7):** Markup-Tests, dann `EveningList` und `CardList`.
7. **Legende am Formband (D8):** Test, dann `EveningBlock`.
8. **Hilfe (D9):** `topics.ts`, Test, Leitfaden erzeugen.
9. **Lage kostet nichts (D10):**
   - Tests: Kachel und Karte mit einem Lage-Anteil ≤ 0 (konstruierte Gruppe fast mittig mit Ausreißer);
   - dann `overview.ts` und `PositionTab.tsx` (`RingLoss`).
10. **Lage passt (D11):**
    - Tests auf Kacheln, Etiketten und Hilfe (zuerst rot);
    - dann `overview.ts`, `PositionTab.tsx`, `shot-help` (`topics.ts` nur `lage-echt`, `guide.ts`), Leitfaden neu
      erzeugen.
11. **Skriptprüfung:**
   - Texte und Bezeichnungen nachziehen;
   - neu: Kopf und Überblick ohne σ, R50, T², „95 %“;
   - Gegenprobe: alter Lage-Satz rot.
12. **Doku:**
    - `packages/shot-ui/CLAUDE.md`;
    - Vault: Durchsicht U3 erledigt; `spiegel-ui-design` Wortwahl.

## Teststeps

1. `pnpm --filter @vereinsheim/shot-ui test`, `pnpm --filter @vereinsheim/shot-help test`.
2. Labor direkt bauen, `pruefen` 0 FAIL.
3. `vault-lint`, `pnpm check` vor jedem Commit.

## Verification

- Gates grün, `pruefen` 0 FAIL, Gegenproben je rot.
- Bildschirmfotos der Scheibe (Kopf, Überblick), von Start und Fortschritt (Telefon dunkel, Desktop hell), unbeschnitten.
- Suche über das gerenderte Labor: keine σ, R50, T², „95 %“ auf Ebene 1 und 2.
- Artifact neu veröffentlichen.
