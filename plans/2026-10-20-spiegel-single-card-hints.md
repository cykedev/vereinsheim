# Spiegel: Eine Scheibe sagt, was sie zeigt

Branch `feat/spiegel-single-card-hints`, Worktree `.claude/worktrees/spiegel-single-card-hints` (parallele Sessions).

## Context

Auf der Seite einer Scheibe stehen Sätze wie „Ein Muster zeigt erst der Vergleich über mehrere Scheiben.“ (Beobachtung
zu Trend und Ermüdung, Karte „Ermüdung“, Beobachtung und Karte zu Pausen). Auf der Scheibe lässt sich nichts
vergleichen. Für Ermüdung, Pausen, Form und Richtungsuhr zeigt auch „Fortschritt“ keinen Vergleich: Diese Werte sind
keine Kennzahlen der Registry (`metrics: []` in `shot-help`), die Auswertung über Zeiträume ist SP-2.7 und offen. Der
Hinweis fordert also etwas, wofür es keinen Weg gibt. Nur bei σ gibt es den Weg schon (`group.sigma` steht in
`PROGRESS_METRICS`).

Regel: Ein Hinweis auf der Scheibe zeigt entweder auf etwas, das man öffnen kann, oder er sagt, was diese Scheibe zeigt.
Die Unsicherheit gehört ins Ergebnis („kann Zufall sein“), wie bei Lage (Hotelling), Form (Mauchly) und Trend
(Mann-Kendall). Dass eine Scheibe kein Muster ist, sagt die Hilfe als Tatsache; der Fehlschluss „Eine Scheibe ist kein
Muster“ im Leitfaden bleibt.

Die neuen Texte stehen zuerst im Textbuch (`vault/_attachments/textbuch-ringwerk-treffsicher.md`, Abschnitt „Spiegel:
Eine Scheibe sagt, was sie zeigt“, Nr. 1–7) und kommen erst nach der Freigabe durch den User in den Code
([[conventions]] §10).

## Approach

1. **Ermüdung bekommt ein Urteil** (Fachkern): `fatigue` testet die Werte der letzten zehn gegen die der ersten zehn mit
   `mannWhitney` aus `stats.ts` (zweiseitig, α 0,05, bei 10 gegen 10 genau ausgezählt, gleiche Werte mit mittleren
   Rängen, also auch in ganzen Ringen). Wie beim Trend gibt es nur dann ein Urteil, wenn Test und Richtung des Mittels
   übereinstimmen: `clear` nur, wenn `p < 0.05` und das Vorzeichen von `u − 50` (U der letzten zehn gegen die ersten
   zehn, Erwartung 10 · 10 / 2) dasselbe ist wie das von `deltaRings`. R50 geht nicht ins Urteil ein.
   Verworfen: eine feste Grenze aus B9 (±0,35 Ringe beim Luftgewehr). Sie gilt nur für σ 1,5 mm; wer weiter streut,
   bekäme zu oft ein Urteil.
2. **Pausen bekommen kein Urteil**, nur einen ehrlichen Satz: Drei Schuss gegen den Rest hätten kaum Trennschärfe, und
   mehrere Pausen hießen mehrere Tests auf einer Scheibe. Der Satz sagt, dass drei Schuss zu wenig sind, ohne auf
   „Abende“ zu verweisen.
3. **σ zeigt den Weg:** Die Karte „Streuung σ“ bekommt den Link „Streuung im Fortschritt ›“ (`RouteLink`, Route von
   der App). Damit der zuletzt gewählte Zeitraum gilt, zählt `metric` in der Adresse von Fortschritt nicht als eigene
   Abfrage (`withRememberedChoice`).
4. **Hilfe als Tatsache:** die sieben Stellen aus Textbuch Nr. 7.
5. **Später (SP-2.7):** Kommen Ermüdung, Pausen, Form und Richtungsuhr über Zeiträume, bekommen ihre Karten auf der
   Scheibe einen Link dorthin. Das steht als Satz im Umfang von SP-2.7, nicht in diesem Plan.

Nur Spiegel: `AnalysisPanel` und `observations` nutzt nur `apps/spiegel` (Treffsicher nimmt aus der Analyse nur
`RingBars` und hat eigene Hilfetexte). Keine Änderung an Schema, Projektion, Brücke oder Deploy-Vertrag. Die Projektion
speichert die Ermüdung nicht, `PROJECTION_VERSION` bleibt.

## Required Docs

- `vault/conventions.md` §10 („So schreiben wir“, Textbuch zuerst)
- `packages/shot-core/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`, `packages/shot-help/CLAUDE.md` (Belege nachrechnen,
  Leitfaden erzeugen)
- `apps/spiegel/CLAUDE.md` (Fortschritt, Zeitraum gemerkt, Skriptprüfung)
- `vault/spiegel/spiegel-statistics.md` (Katalog I2, „Viele Vergleiche erzeugen Zufallstreffer“, Belege B1, B6, B9)
- `vault/_attachments/textbuch-ringwerk-treffsicher.md`, Abschnitt „Spiegel: Eine Scheibe sagt, was sie zeigt“

## Tasks

### T0 Freigabe der Texte (Circuit-Breaker)

Vor T1: Der Abschnitt im Textbuch trägt „freigegeben am …“. Steht dort noch „vom User noch nicht gelesen“, hält
`/implement` an. Ändert der User Wortlaut, gilt der Wortlaut im Textbuch, nicht der in diesem Plan.

### T1 Fachkern: Urteil der Ermüdung

Datei `packages/shot-core/src/analysis/course.ts`:

- Import `mannWhitney` aus `../stats` ergänzen.
- Rückgabetyp von `fatigue` um `clear: boolean` und `direction: "up" | "down" | null` erweitern (`null`, wenn nicht
  klar).
- Rechnung nach `deltaRings`:

  ```ts
  const first = values.slice(0, 10)
  const last = values.slice(-10)
  const test = mannWhitney(last, first)
  // wie beim Trend: ein Urteil nur, wenn Test und Mittel in dieselbe Richtung zeigen
  const side = test ? Math.sign(test.u - (last.length * first.length) / 2) : 0
  const clear = test !== null && test.p < 0.05 && side !== 0 && side === Math.sign(deltaRings)
  ```

  `direction`: `clear ? (deltaRings > 0 ? "up" : "down") : null`.
- JSDoc von `fatigue`: „klar nach Mann-Whitney (zweiseitig, 95 %, zehn gegen zehn genau), nur wenn das Mittel dieselbe
  Richtung zeigt; R50 ohne Urteil“. Kopfkommentar der Datei: Der Satz „Ermüdung und Trend sagen erst als Muster über
  mehrere Scheiben etwas“ wird zu „Ermüdung und Trend heißen nur ‚klar‘, wenn ein Test es zeigt; auch dann gilt es für
  diese Scheibe.“

Tests in `packages/shot-core/src/analysis/course.test.ts` (Fixtures über die vorhandenen Helfer der Datei):

- zehnmal 10,8 und zehnmal 9,2 (ganze Ringe: 10 und 9) → `clear: true`, `direction: "down"`; umgekehrt `"up"`.
- abwechselnd 10,1 / 9,9 über 20 Schuss → `clear: false`, `direction: null`.
- großer Unterschied im Mittel bei großer Streuung: erste zehn {10,9, 7,0, 10,8, 7,1, …}, letzte zehn um 0,5 Ringe
  tiefer, sonst gleich gestreut → `deltaRings` deutlich ungleich 0, aber `clear: false`. So ist belegt, dass der Test
  urteilt, nicht die Größe des Unterschieds.
- Richtung widerspricht: ein sehr schwacher Schuss (z. B. 3,0) unter den letzten zehn, sonst die letzten zehn höher
  → Mittel fällt, Ränge steigen → `clear: false`.
- Gegenprobe per Mutation: `test.p < 0.05` testweise durch `true` ersetzen, der Test mit der abwechselnden Folge muss rot
  werden; danach zurück (aus einer `cp`-Sicherung, nicht `git checkout`).

### T2 Belege nachrechnen

Datei `packages/shot-help/scripts/simulate.ts`:

- B1: in die Bedingung `found` `|| fatigue(match, "decimal")?.clear === true` aufnehmen, Kommentar „Ermüdung klar“
  ergänzen.
- neu B21 nach B20, gebaut wie B6: Ermüdung ohne Effekt (Fehlalarm) und mit Nachlassen (σ der letzten zehn Schuss um
  60 % größer), Luftgewehr σ 1,5 mm und Luftpistole σ 15 mm, je 20 und 40 Schuss, Zehntel und ganze Ringe, 5 000
  Wiederholungen. Ausgabe wie B6: „B21  LG σ 1,5 mm, 20 Schuss: Fehlalarm Zehntel …, ganze Ringe …; Nachlassen erkannt
  Zehntel …, ganze Ringe …“.
- `pnpm --filter @vereinsheim/shot-help simulate` laufen lassen, die Ausgabe in den Block „Belege aus Simulationen“ von
  `vault/spiegel/spiegel-statistics.md` übernehmen (B1 ersetzen, B21 nach B20), Kopfzeile des Blocks um „B1 mit
  Ermüdung, B21 neu (20. Oktober 2026)“ ergänzen.
- Katalog dort: Zeile I2 „als Muster erst über mehrere Scheiben“ → „klar nach Mann-Whitney (zweiseitig, 95 %, zehn
  gegen zehn genau) und nur, wenn das Mittel dieselbe Richtung zeigt (B21); R50 ohne Urteil“. Abschnitt „Viele
  Vergleiche“: „vier Tests (Lage, Form, Ausreißer, Trend)“ → „fünf Tests (Lage, Form, Ausreißer, Trend, Ermüdung)“ und
  die neue Quote aus B1.
- Liegt B1 danach bei 40 Schuss über 18,2 % (100/5,5), heißt es in `packages/shot-help/src/guide.ts` (Zeilen 17 und
  53) und im Katalog „etwa jede fünfte“ statt „etwa jede sechste“; sonst bleibt „sechste“. Liegt der Fehlalarm von B21
  in einer Zeile über 6 %, hält `/implement` an (Circuit-Breaker): Dann taugt der Test bei ganzen Ringen nicht, und das
  ist eine Entscheidung für den User.

### T3 Beobachtungen

Datei `packages/shot-ui/src/analysis/observations.ts`:

- Zeile 137: den festen Satz „Ein Muster zeigt erst der Vergleich über mehrere Scheiben.“ ersetzen. Nach
  `… lagen ${where}${group}.` folgt (Textbuch Nr. 1):
  - `tired.direction === "down"`: „ Am Ende hast du klar nachgelassen.“
  - `tired.direction === "up"`: „ Am Ende bist du klar stärker geworden.“
  - nicht klar und `Math.abs(d) >= 0.005`: „ Der Unterschied kann Zufall sein.“
  - `Math.abs(d) < 0.005`: kein Zusatz.
- `notable: trend.clear` → `notable: trend.clear || tired?.clear === true`.
- Zeile 161: „Drei Schuss sind wenig. Ein Urteil braucht mehrere Abende.“ → „Drei Schuss sind zu wenig, um zu zeigen,
  ob die Pause etwas ausmacht.“ (Textbuch Nr. 3)

Tests in `packages/shot-ui/src/analysis/observations.test.ts`: je ein Fall für „klar nachgelassen“, „klar stärker
geworden“, „kann Zufall sein“ und „genau im Schnitt“ (ohne Zusatz); `notable` ist bei klarer Ermüdung ohne klaren Trend
`true`; der Pausensatz in neuer Form; kein Text der Beobachtungen enthält „mehrere Scheiben“ oder „mehrere Abende“.

### T4 Reiter „Zeit und Verlauf“

Datei `packages/shot-ui/src/analysis/tabs/TimeTab.tsx`:

- Karte „Ermüdung“ (Zeile 279 ff.): unter `KeyValues` das Urteil als `Verdict` aus `../parts`: `tone="warn"` „klar
  schwächer“, `tone="ok"` „klar stärker“, `tone="none"` „kann Zufall sein“. Die `Note` (Zeile 301–304) wird zu
  „„Klar“ heißt: Reiner Zufall brächte einen so großen Unterschied nur in 5 von 100 Fällen. Das Urteil gilt für den
  Wert, nicht für die Gruppe.“ (Textbuch Nr. 2)
- Karte „Pausen“ (Zeile 263–266): „Drei Schuss sind wenig; ein Muster zeigt der Vergleich über Abende.“ → „Drei Schuss
  sind zu wenig für ein Urteil.“ (Textbuch Nr. 4)

Tests in `TimeTab.test.tsx` (`cardText(html, "ermuedung")`): `data-verdict="warn"` und „klar schwächer“ bei klarem
Nachlassen, `data-verdict="none"` und „kann Zufall sein“ bei der Folge aus `BASE`; keine Karte des Reiters enthält
„mehrere Scheiben“, „über Abende“ oder ein Semikolon in einer `Note`.

### T5 Reiter „Präzision“ mit Weg in den Fortschritt

- `packages/shot-ui/src/analysis/AnalysisPanel.tsx`: neue Prop
  `sigmaRoute?: Route` (Typ aus `../nav/routes`), JSDoc „Fortschritt mit der Streuung σ der Familie dieser Scheibe;
  ohne sie kein Link“. Weiter an `PrecisionTab`.
- `packages/shot-ui/src/analysis/tabs/PrecisionTab.tsx`:
  - Zeile 66: Text aus Textbuch Nr. 5 („σ aus ${sigma.n} Schuss, für wenige Schüsse korrigiert. Er hängt kaum von der
    Schusszahl ab. Deshalb zeigt Fortschritt die Streuung über alle deine Scheiben als σ.“), darunter mit `sigmaRoute`
    `<RouteLink route={sigmaRoute}>Streuung im Fortschritt ›</RouteLink>` in der Linkklasse, die `CardHeader` für
    „Alle Beobachtungen ›“ nutzt. Ohne `sigmaRoute` der Text ohne „Deshalb …“-Satz und ohne Link.
  - Zeile 103–104: Text aus Textbuch Nr. 6.
- Tests in `PrecisionTab.test.tsx`: mit `sigmaRoute` steht ein `<a>` mit `href` aus `urlFromRoute` (enthält
  `metric=sigma` und `family=`) und dem Text „Streuung im Fortschritt“; ohne `sigmaRoute` kein Link und kein
  „Fortschritt“ im Text der Karte.
- `apps/spiegel/src/components/card/CardScreen.tsx`: `sigmaRoute` bauen, wenn `card.family` da ist:
  `{ page: "progress", query: { ...DEFAULT_PROGRESS, family: card.family.slug, metric: "group.sigma" }, section: null }`
  (`DEFAULT_PROGRESS` aus `@vereinsheim/shot-ui/nav/routes`), an `AnalysisPanel` geben.
- `apps/spiegel/src/lib/period-memory-cookie.ts`, `withRememberedChoice`: `key !== "family"` →
  `key !== "family" && key !== "metric"`; Kommentar: „Familie und Kennzahl wählen keinen Zeitraum“. Test in
  `period-memory-cookie.test.ts`: `family=…&metric=sigma` übernimmt den gemerkten Zeitraum, `family=…&range=30d`
  nicht. Kommentar in `apps/spiegel/src/app/(app)/progress/page.tsx` (Zeile 20–21) und Satz in `apps/spiegel/CLAUDE.md`
  („keine eigene Abfrage hat außer `family`“) um „und `metric`“ ergänzen.

### T6 Hilfe

`packages/shot-help/src/topics.ts`, Wortlaut aus Textbuch Nr. 7:

- `serien-und-konstanz` (`caution`, Zeile 77), `form-der-gruppe` (`caution`, Zeile 140), `ausreisser` (`act`, Zeile
  155), `richtungsuhr` (`caution`, Zeile 202), `pausen` (`caution`, Zeile 272), `ermuedung` (`read` und `caution`,
  Zeile 286–288).
- `ermuedung.formula`: „Ø der letzten 10 − Ø der ersten 10; ebenso R50; klar nach Mann-Whitney (zweiseitig, 95 %,
  genau), wenn das Mittel dieselbe Richtung zeigt“.
- `ermuedung.minimum` bleibt.
- `pnpm --filter @vereinsheim/shot-help docs`, dann `vault/spiegel/spiegel-statistics-help.md` mit committen.
- Test in `packages/shot-help/src/topics.test.ts`: kein `caution`, `act` oder `read` enthält „Vergleich über mehrere“
  oder „über mehrere Scheiben“ (der Leitfaden mit `FALLACIES` ist ausgenommen).

### T7 Roadmap und Textbuch

- `vault/spiegel/spiegel-roadmap.md`, SP-2.7, Umfang, am Ende: „Die Karten Ermüdung, Pausen, Form und Richtungsuhr auf
  der Seite einer Scheibe bekommen dann einen Link auf diese Auswertung.“
- Textbuch, Abschnitt „Spiegel: Eine Scheibe sagt, was sie zeigt“: Status auf „umgesetzt auf
  `feat/spiegel-single-card-hints`, nicht released“; den Satz „Kann sich ändern …“ durch das Ergebnis von B1 ersetzen.
- Nach dem Merge wird dieser Plan gelöscht (`plans/` enthält nur offene Pläne).

## Test steps

- `pnpm --filter @vereinsheim/shot-core test` nach T1 (inkl. Mutation, dann zurück).
- `pnpm --filter @vereinsheim/shot-help simulate` in T2, Ausgabe gegen den Block im Katalog.
- `pnpm --filter @vereinsheim/shot-ui test` nach T3–T5.
- `pnpm --filter @vereinsheim/shot-help test` nach T6 (der Vergleich des Leitfadens wird sonst rot).
- `pnpm --filter spiegel test -- period-memory-cookie` nach T5.
- `pnpm check` vor jedem Commit (im Worktree: vorher `.env` der Apps und `apps/spiegel/tools/private` aus dem
  Haupt-Checkout verlinken, Node 24 vorn im `PATH`).

## Verification

- `pnpm check` grün im Worktree.
- `grep -rn "mehrere Scheiben\|mehrere Abende\|über Abende" packages/shot-ui/src/analysis packages/shot-help/src`
  zeigt nur noch den Leitfaden (`guide.ts`, Fehlschluss) und Kommentare.
- Im Browser (`pnpm --filter spiegel seed:own --demo`, `pruefen --start`, danach `seed:own` im selben Befehl): eine
  Scheibe mit klarem Nachlassen zeigt den Satz im Kopf und das gelbe Etikett in „Zeit und Verlauf“; eine gewöhnliche
  Scheibe zeigt „kann Zufall sein“; „Streuung im Fortschritt ›“ öffnet Fortschritt mit „Streuung“, der Familie der
  Scheibe und dem gemerkten Zeitraum. Was die Demo-Daten nicht hergeben (etwa „klar stärker“), steht im Bericht als
  „nicht belegt“ mit dem Markup-Test, der den Pfad abdeckt.
- Keine neue Brücke nötig (nur App und Pakete).
