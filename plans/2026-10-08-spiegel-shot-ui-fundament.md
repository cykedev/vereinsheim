# Plan: Fundament von `shot-ui` und das Labor (Schritt 1)

Branch `feat/spiegel-ui-reference` (Worktree `.claude/worktrees/spiegel-ui-reference`; parallel arbeitet eine
andere Session im Haupt-Checkout). Ersetzt den Plan `2026-10-08-spiegel-spielwiese.md` (nur festhalten). Bezug:
[[adr-030]] (am 8. Oktober 2026 angenommen), [[spiegel-ui-design]], Roadmap SP-1.8 (`packages/shot-ui`).

## Kontext

Die Spielwiese zeigt die beste Oberfläche, die Spiegel hat, aber als Prototyp: 2237 Zeilen JavaScript in einer
HTML-Datei (`tools/spielwiese`, gerettet in `94fc4ca`). Der User will das Gebaute nicht nur festhalten,
sondern „richtig bauen“ und „richtig verdrahten“ und damit weiter experimentieren: „dann sehen wir doch immer
ob was nicht passt“. Entscheidungen des Users: ADR-030 (Design 2) angenommen, Experimente in einem **Labor**
(eine Seite aus den echten Bausteinen mit Beispielscheiben, als einzelne HTML-Datei, als Artifact auch auf
dem Handy). `apps/spiegel` setzt dieselben Bausteine später mit echten Daten ein (SP-1.6, SP-1.8).

Der Weg ist in Schritte geteilt, je ein Plan: **1 Fundament** (dieser Plan), 2 Kacheln, Schusstabelle,
Wertung, Visier, Hilfe, 3 Analyse mit Reitern, Karten, Diagrammen, 4 eigener Zoom, Wiedergabe,
Serienvergleich, 5 über Tage (Beispielabende, Scheiben vergleichen, Verläufe). Bis ein Baustein portiert
ist, bleibt die Spielwiese (Artifact Version 13) die Referenz.

Schritt 1 baut das Fundament und die Scheibe und erkundet dabei zwei Wünsche des Users:

- **Nummern in Ebenen:** „zahlen überlagern sich stark, ohne dass ich das gefühl habe, dass eine zahl zu
  einem ‚tieferen‘ schuss gehört“. Ursache: Alle Nummern liegen heute in einer eigenen Ebene über allen
  Treffern.
- **Serien wählen:** „vielleicht will ich nur auf eine schauen, nicht alle“, Auswahl von Serien oder allen
  Schüssen.

## Entscheidungen

- **D1 Design-2-Tokens** in `packages/ui/design2.css` (Export `./design2.css`), eigenständig statt über
  `theme.css`: die Werte der Spielwiese unter denselben Namen, die `theme.css` und die ui-Primitives nutzen
  (`background` = Grund, `card` = Fläche, `muted-foreground`, `border`, `primary` = Akzent, `success` = pos,
  `destructive` = neg, `warning`), dazu Design-2-eigene Tokens: `surface-2`, `line-strong`, `foreground-2`,
  `accent-wash`, `success-wash`, `destructive-wash`, `warning-wash`, `paper`, `paper-line`, `spiegel`,
  `spiegel-line`, `shot-edge`, `overlay`, `overlay-halo`, `score-10`, `score-9`, `score-8`, `score-7`,
  Schriften `display` (Archivo), `sans` (Geist), `mono` (Geist Mono), Radius 16 px. Hell auf `:root`, dunkel
  unter `.dark` (Klassen-Strategie wie `next-themes`), keine `dark:`-Varianten. Ringwerk und Treffsicher
  bleiben auf `theme.css`, ihr Drift-Gate ist unberührt.
- **D2 Wo was liegt:** Allgemeine Design-2-Bausteine (Segment-Umschalter, Schalter-Chip) kommen nach
  `@vereinsheim/ui`, wie [[adr-030]] sagt; die Scheibe und alles, was den Fachkern braucht, nach
  `packages/shot-ui` (`@vereinsheim/shot-ui`), wie [[spiegel-ui-design]] und SP-1.8 es vorsehen. Das
  verfeinert ADR-030 („die Scheibe selbst“ im ui-Paket), weil `@vereinsheim/ui` nicht vom Fachkern abhängen
  soll.
- **D3 Aufbau von `shot-ui`:** reine Funktionen getrennt von React. `src/geometry.ts` (Ausschnitte für
  Scheibe, Gruppe und Auswahl, Bildschirmregeln: Nummern 8–12 px, Schwerpunkt 5–8 px, Ringzahlen höchstens
  12 px, Streukreis plus halbes Kaliber plus 2 px), `src/layers.ts` (Zeichenreihenfolge), `src/view-state.ts`
  (Zustand als Reducer: Auswahl, Ausschnitt, Schalter, Wertung, Visierverstellung, gewählter Schuss),
  `src/target/TargetView.tsx`, `src/target/useAnimatedViewBox.ts`, `src/series/SeriesStrip.tsx`. Bausteine
  sind Client-Komponenten („use client“) mit Props, ohne eigenes Laden von Daten; Zahlen nur aus
  `@vereinsheim/shot-core`, Texte aus `@vereinsheim/shot-help`, Format über `@vereinsheim/lib/format`.
- **D4 Nummern in Ebenen:** Jeder Treffer ist eine Gruppe aus Kreis und Nummer, gezeichnet in Abgabefolge
  (Probe unter Wertung wie bisher). Ein späterer Treffer verdeckt auch die Nummer eines früheren. Darüber
  nur Streukreis, Vertrauensellipse und Schwerpunkt. Der **gewählte Schuss** (Antippen) liegt mit Nummer und
  einem Haarlinien-Ring ganz oben unter den Überlagerungen; die Ablesung zeigt ihn statt des letzten Schusses.
  Als Variante zum Vergleich im Labor: Nummern nur für die gewählten Serien.
- **D5 Auswahl:** `selection` ist „alle“ oder eine Menge aus `"probe"` und Seriennummern. Die Hauptscheibe
  zeigt die gewählten Schüsse normal, die übrigen blass (Deckkraft 0,18, ohne Nummer, nicht antippbar);
  als Variante im Labor „ausblenden“. Streukreis, Ellipse, Schwerpunkt und der Ausschnitt „Gruppe“ rechnen
  über die Auswahl (Wertungsschüsse der Auswahl, ohne Wertung die gewählte Probe). Nummern bleiben die der
  ganzen Scheibe (`shotNumbers`). Die Serienscheiben sind Schalter (`aria-pressed`), Tippen nimmt eine Serie
  dazu oder heraus, dazu ein Chip „Alle“. Eine leere Auswahl ist „alle“.
- **D6 Antippen:** Auf der echten Scheibe heißt Tippen „Schuss ansehen“, nicht „Schuss setzen“. Das Labor hat
  dafür einen Modus „Setzen“ (Wertung oder Probe), wie die Spielwiese ihn hatte.
- **D7 Labor** als privates Workspace-Paket `tools/labor` (`@vereinsheim/labor`, in `pnpm-workspace.yaml`
  ausdrücklich, kein `tools/*`): React-Seite aus `shot-ui` mit den Beispielen der Spielwiese (40 Schuss mit
  Probe für LP und LG mit festen Seeds, LG-Zehnerserie, Ausdruck vom 2. Oktober), Bau mit esbuild und
  Tailwind über PostCSS (alles schon im Lockfile) zu `dist/labor.html`, eigenes Artifact „Spiegel-Labor“. Die
  Spielwiese bleibt daneben unverändert als Referenz.
- **D8 Prüfen:** Geometrie und Reducer mit Handwerten; Markup-Tests mit `renderToStaticMarkup` in der
  Node-Umgebung (Ebenenfolge, Probe hohl und gestrichelt, blasse Auswahl, ARIA); Bedienung und
  Bildschirmregeln mit einer Skriptprüfung im Headless-Chrome (`pnpm --filter @vereinsheim/labor pruefen`,
  außerhalb des Gates). Im Gate: `test`, `check-types`, `format:check` von `shot-ui` und Labor und `build` des
  Labors, mit `^build` für die Pakete, von denen sie abhängen.
- **D9 Hell und dunkel:** Tokens für beide; das Labor folgt dem System und hat einen Umschalter. Ob Phase 1
  nur dunkel startet, bleibt offen ([[spiegel-open-questions]]); Sichtprüfung dunkel, hell stichprobenhaft.

## Dateien

| Datei | Änderung |
|---|---|
| `packages/ui/design2.css`, `packages/ui/package.json`, `packages/ui/CLAUDE.md` | Tokens nach D1, Export |
| `packages/ui/src/design2/segmented.tsx`, `toggle-chip.tsx` (+ Tests) | Segment-Umschalter, Schalter-Chip (Design 2) |
| `packages/shot-ui/**` (neu) | `package.json`, `tsconfig.json`, `turbo.json`, `vitest.config.ts`, `CLAUDE.md`, `src/` nach D3 mit Tests |
| `tools/labor/**` (neu) | `package.json`, `tsconfig.json`, `turbo.json`, `src/main.tsx`, `src/samples.ts`, `src/labor.css`, `scripts/build.ts`, `scripts/pruefen.ts`, `pruefung.js`, `CLAUDE.md`, `.gitignore` |
| `pnpm-workspace.yaml`, `pnpm-lock.yaml` | `tools/labor`; neue Importer `shot-ui`, `labor` |
| `vault/conventions.md` | Abschnitt Design 2 (Folge aus [[adr-030]]) |
| `vault/spiegel/spiegel-ui-design.md` | Nummern in Ebenen, Auswahl, Antippen, Labor |
| `vault/spiegel/spiegel-roadmap.md`, `vault/architecture/architecture.md` | SP-1.8 in Arbeit (Bausteine), Repo-Karte |

## Required Docs

`vault/conventions.md`, [[adr-030]], [[spiegel-ui-design]] (vor allem „Zeichnen der Scheibe“),
`packages/ui/CLAUDE.md`, `packages/shot-core/CLAUDE.md`, `packages/shot-help/CLAUDE.md`,
`tools/spielwiese/template.html` (Zeilen 772–1042: Ausschnitt, Zoom, Maßstab, Ringe, Treffer, Serien;
Tokens Zeilen 9–95), `tools/spielwiese/harness.js` (Prüfungen zu Scheibe und Serien).

## Tasks

1. **Tokens.** `design2.css` nach D1 mit den Werten aus der Spielwiese (Zeilen 9–95), `@theme inline` für die
   Namen, `@source "./src"`. Prüfung: Ein Test liest die Datei und erwartet jeden Token in `:root` und in
   `.dark` (keiner nur in einem Block) und die vier Ringwert-Farben unverändert (farbenblind geprüft).
2. **ui-Bausteine.** `segmented.tsx` (Gruppe von Knöpfen mit `aria-pressed`, Tastatur mit Pfeilen) und
   `toggle-chip.tsx`; Markup-Tests.
3. **Paket `shot-ui` anlegen** nach dem Muster von `shot-help` (JIT, `exports` je Datei, `^build` für `test`),
   Abhängigkeiten `@vereinsheim/shot-core`, `@vereinsheim/shot-help`, `@vereinsheim/lib`, `react` als Peer.
4. **Geometrie (test-first).** `targetView(target)`, `groupView(target, points)` (Werte wie Spielwiese Zeilen
   772–785), `screenSizes(calR, unitsPerPx)` (Nummern, Schwerpunkt, Ringzahlen, Abstand des Streukreises),
   `scoreColor(ring)` (Token-Name), `seriesTileView(target, shots)` (gemeinsamer Ausschnitt der kleinen
   Scheiben, Zeilen 1021–1022), `tileColumns(count, width)` (gleich volle Zeilen, 60–104 px, Zeilen 1018–1020).
   Erwartungswerte von Hand aus den Formeln, nicht aus der Implementierung.
5. **Ebenen (test-first).** `layerOrder(shots, chosen)`: Probe vor Wertung, sonst Abgabefolge, gewählter
   Schuss zuletzt; Nummern hängen am Treffer (D4).
6. **Zustand (test-first).** `viewReducer` mit Aktionen `select` (Serie umschalten), `selectAll`, `choose`
   (Schuss), `setView` (Scheibe/Gruppe), `toggle` (Schwerpunkt, Streukreis, Nummern, Ellipse), `setScoring`,
   `toggleAdjust`; Auswahl leer wird „alle“; gewählter Schuss außerhalb der Auswahl wird verworfen.
7. **`TargetView`.** SVG wie Spielwiese Zeilen 841–945 mit den Regeln aus „Zeichnen der Scheibe“
   (`vector-effect: non-scaling-stroke`, Füllung 0,8, Ringzahlen, Innenzehn, LG-Zehn weiß), Ebenen nach Task
   5, Auswahl nach D5, Überlagerungen über die Auswahl, `useAnimatedViewBox` (340 ms, ease-out, ohne bei
   „Bewegung reduzieren“, landet auch ohne Bilder). Markup-Tests: Reihenfolge Treffer/Nummer, Überlagerungen
   zuletzt, blasse Schüsse ohne Nummer, Probe hohl, vor der Verstellung gestrichelt, `role="img"` mit Satz.
8. **`SeriesStrip`.** Kleine Scheiben wie Zeilen 999–1042, als Schalter nach D5, mit Chip „Alle“;
   Serienergebnis über `seriesCurve` in der gewählten Wertung, laufende Serie „7 von 10 Schuss“, Probe mit
   Zahl und „n nach der Verstellung“. Markup-Tests.
9. **Labor.** Paket nach D7, `samples.ts` (Generatoren der Spielwiese Zeilen 651–744 mit denselben Seeds),
   Seite: Kopf mit Stand, Scheibe mit Werkzeugleiste (Scheibe LP/LG, Beispiel, Wertung, Schwerpunkt,
   Streukreis, Nummern, Ellipse, Gruppe/Scheibe, Modus Ansehen/Setzen, Varianten „blass/aus“ und „Nummern
   nur Auswahl“), Ablesung des gewählten Schusses, Serienscheiben. `scripts/build.ts`: Bundle (React, Bausteine,
   Beispiele), Tailwind über PostCSS mit `design2.css`, Schriften per Google Fonts, alles in `dist/labor.html`.
10. **Skriptprüfung des Labors** (`pruefung.js`, `scripts/pruefen.ts` nach dem Muster der Spielwiese): die
    Prüfungen der Spielwiese zu Scheibe und Serien (Ausschnitt, Gruppen-Zoom, Ringzahlen und Nummern in
    Bildschirmgröße, Schwerpunkt oben, Streukreis um die Treffer, Probe hohl, Serien gleich volle Zeilen,
    Handy ohne seitliches Scrollen) plus neu: Ebenen der Nummern, Antippen hebt den Schuss, Auswahl einer
    Serie (Streukreis und Gruppe folgen, Nummern bleiben), „Alle“, Varianten, keine Skriptfehler.
11. **Doku.** `conventions.md` Abschnitt Design 2, [[spiegel-ui-design]] (Ebenen, Auswahl, Antippen, Labor),
    Roadmap SP-1.8 („in Arbeit: Bausteine in `shot-ui`, Labor“), Repo-Karte, Scope-Notizen von `shot-ui` und
    Labor (Labor neu veröffentlichen nach jeder Änderung an Bausteinen, `pruefen` grün).

## Test steps

- `pnpm check` grün, inklusive der neuen Pakete.
- Gegenproben: In `layerOrder` Nummern wieder als eigene Ebene → Markup-Test rot; Auswahl ignoriert →
  Reducer- und Markup-Test rot; Token nur in `.dark` → Token-Test rot.
- `pnpm --filter @vereinsheim/labor pruefen` → 0 FAIL.
- Sichtprüfung im Browser-Pane: Desktop und 390 px, dunkel, hell als Stichprobe; dasselbe Beispiel (LP, 40
  Schuss) neben der Spielwiese Version 13: gleich bis auf die gewollten Änderungen (Ebenen, Auswahl).

## Verification

Bericht `reports/2026-10-08-spiegel-shot-ui-fundament.md` mit Gate, Gegenproben, Skriptprüfung und Bildern.
Labor als neues Artifact „Spiegel-Labor“ veröffentlichen; der User urteilt über Nummern in Ebenen und die
Auswahl (Varianten). Merge nach `main` erst mit OK und wenn die parallele Session fertig ist; davor `main` in
den Branch holen.
