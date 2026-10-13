# Spiegel: Art und Wertung als Symbole in weichen Kreisen

## Kontext

Der User am 13. Oktober 2026 über die Segment-Schalter „Training | Wettkampf“ und „Zehntel | Ganze Ringe“: „ob man das
ggf. eleganter machen kann … ein icon oben rechts in der box (durchgestrichener pokal, farbiger pokal) … für ganze ringe
oder zehntel (1/1 und 1/10) … spart platz und könnte sich überall konsistent durchziehen“. Nach drei Skizzen gewählt:
**weiche Kreise** (32 px, gefüllt in der Flächenfarbe, ohne Rand), Bruch aus der Typografie (¹⁄₁, ¹⁄₁₀), Gold nur für
Wettkampf („viel viel besser … schaut richtig gut aus“). Dazu „ich sehe bei scheiben keine pokale“: Der Pokal in der
Liste ist 14 px und grau.

Die Logik bleibt: Speichern über `setCardScoring`, `setCardKind`, `setFamilyScoring` und `useSavedChoice`
(`plans/2026-10-12-spiegel-wertung.md`, `plans/2026-10-12-spiegel-art.md`). Es ändert sich die Darstellung, an fünf
Stellen und im Labor.

## Entscheidungen

- **Ein Baustein für alle Kreise:** `RoundToggle` in `@vereinsheim/ui/design2/round-toggle` (allgemein wie Segment und
  Schalter-Chip): `<button type="button">`, `size-8 rounded-full`, `bg-surface-2 text-muted-foreground`, beim
  Darüberfahren `bg-accent-wash text-foreground-2`, Fokus `outline-2 outline-ring`; Ton `gold`:
  `bg-warning-wash text-warning`. Der Name (`aria-label`) sagt Zustand und Wirkung, `title` den Zustand.
- **Wertung** (`ScoringToggle` in `shot-ui/controls`): der Bruch aus der Typografie, ¹⁄₁ für ganze Ringe, ¹⁄₁₀ für
  Zehntel (`sup`/`sub`, 13 px, `text-foreground-2`). Ein Tippen stellt auf die andere. Name „Wertung: Zehntel, auf ganze
  Ringe umstellen“; ist die gezeigte die amtliche, „…, amtlich, …“. **Kein blauer Punkt** (der User fragte, was er
  bedeute): „amtlich“ steht im Namen und im Tooltip. Eigener Name möglich (`label`, in der Liste „Wertung für Ø und
  Abstand“).
- **Art** (`KindToggle` in `shot-ui/controls`): Pokal (`Trophy`, 17 px). Training gedämpft (`text-muted-foreground`),
  Wettkampf gold (Ton `gold`). **Ohne Strich:** `lucide-react` hat keinen durchgestrichenen Pokal, ein selbst
  gezeichneter Strich wirkte grob; Farbe und Tönung trennen beide deutlich und ruhiger. Name „Art: Training, auf
  Wettkampf umstellen“.
- **Ort: oben rechts, auf der Höhe der großen Zahl** (Zeile mit `justify-between`, `items-center`, umbricht bei Platzmangel):
  - Seite einer Scheibe: `CardResult` bekommt `actions` (statt `scoring`) neben der Zahl: Art, dann Wertung; bei nur
    Probe nur die Wertung.
  - Fortschritt: `PeriodResult` `actions` (statt `scoring`): die Wertung der Familie.
  - Liste: `ListHeader` `actions` rechts neben „Scheiben“: die Wertung der Familie („Wertung für Ø und Abstand“).
  - Start: `EveningBlock` `actions` neben „8,45 Ø je Schuss“: die Wertung der Familie; mit `actions` entfällt „in ganzen
    Ringen“ hinter „Ø je Schuss“ (der Kreis zeigt sie), ohne (Labor) bleibt es.
- **Fehler beim Speichern:** ein Platz `notice` unter dem Inhalt von `CardResult`, `PeriodResult`, `EveningBlock`; in der
  Liste unter dem Kopf. Text mit `role="alert"` wie bisher.
- **Ein Zustand je Seite:** `useSavedChoice` ruft die Hülle einmal je Wahl (`CardScreen`: Art und Wertung,
  `ProgressScreen`, `ListScreen`, auf Start je Block eine kleine Komponente). Ergebnis-Box und Kopf am Telefon zeigen
  denselben Zustand (Review `reports/2026-10-12-spiegel-art-review.md`, N2). `ScoringControl` und `KindControl` entfallen.
- **Liste:** der Pokal in der Spalte „Art“ 16 px in Gold (`text-warning`), Training weiter ohne Zeichen.
- **Entfällt:** `ScoringSwitch` und `KindSwitch` (nur noch im Labor bzw. nirgends genutzt) samt Exporten und Tests.
- **Labor:** die Seite einer Scheibe mit `ScoringToggle` in `CardResult.actions` (keine Art: ohne Datenbank fest); Liste,
  Start, Fortschritt ohne Kreise (seine Wertung steht in Profil). Die Skriptprüfung schaltet über einen Helfer
  `scoringTo(…)`.

## Aufgaben

1. **`RoundToggle`** `packages/ui/src/design2/round-toggle.tsx` mit Props `label`, `title`, `tone?: "default" | "gold"`,
   `onClick`, `children`, `className`, `data-*` durchgereicht; Export `"./design2/round-toggle"` in
   `packages/ui/package.json`; Markup-Test `round-toggle.test.tsx` (Knopf, Name, Titel, Klassen beider Töne).
2. **`ScoringToggle` und `KindToggle`** `packages/shot-ui/src/controls/{ScoringToggle,KindToggle}.tsx`, Exporte in
   `packages/shot-ui/package.json`; `ScoringSwitch.tsx`, `KindSwitch.tsx` und ihre Exporte entfernen;
   `controls.test.tsx`: Bruch (¹⁄₁, ¹⁄₁₀ als `sup`/`sub`), Name mit und ohne „amtlich“, eigener Name, Pokal gedämpft und
   gold, `data-scoring` bzw. `data-kind` am Knopf.
3. **Plätze in shot-ui:**
   - `readout/CardResult.tsx`: `scoring` → `actions` (Zeile mit der Zahl) und `notice` (unten); Test.
   - `period/PeriodResult.tsx`: `scoring` → `actions`, dazu `notice`; Test.
   - `list/ListHeader.tsx`: `actions` rechts neben dem Titel; Test.
   - `start/EveningBlock.tsx`: `actions` neben der großen Zahl, `notice` unten; „in …“ nur ohne `actions`; Test.
   - `list/KindMark.tsx`: Pokal `size-4 text-warning`; Test in `EveningList.test.tsx`.
4. **App** (`apps/spiegel/src/components`):
   - `card/CardScreen.tsx`: `useSavedChoice` für Wertung (mit `onShow` an den Reducer) und Art; `KindToggle` (ohne nur
     Probe) und `ScoringToggle` (mit `official`) in `CardResult.actions`, der Fehler in `notice`.
   - `progress/ProgressScreen.tsx`, `list/ListScreen.tsx`: `useSavedChoice` für die Familie, `ScoringToggle` in
     `actions`, Fehler in `notice` bzw. unter dem Kopf.
   - `start/StartScreen.tsx`: je Block eine Komponente mit `useSavedChoice` (`setFamilyScoring(block.family, …)`),
     `ScoringToggle` in `EveningBlock.actions`.
   - `shell/ScoringControl.tsx` und `shell/KindControl.tsx` entfernen.
5. **Labor:** `tools/labor/src/CardView.tsx` mit `ScoringToggle` in `CardResult.actions`; `tools/labor/pruefung.js`:
   Helfer `scoringTo(value)` (klickt `[data-scoring-toggle]`, bis `data-scoring` passt) statt `button("Ganze Ringe")` und
   `button("Zehntel")` (rund acht Stellen), die Prüfung „kein Schalter der Wertung im Fortschritt“ über
   `[data-scoring-toggle]`; `pruefen` 0 FAIL.
6. **Doku:** [[spiegel-navigation]] (Abschnitt „Art und Wertung als Symbole“), `vault/conventions.md` §10 (neuer
   allgemeiner Baustein `round-toggle`), `packages/shot-ui/CLAUDE.md` (Exporte, Regel zu den Kreisen),
   `apps/spiegel/CLAUDE.md`, `tools/labor/CLAUDE.md`.

## Dateien

- `packages/ui/src/design2/round-toggle.tsx` und Test, `packages/ui/package.json`
- `packages/shot-ui/src/controls/{ScoringToggle,KindToggle}.tsx` (neu), `{ScoringSwitch,KindSwitch}.tsx` (entfallen),
  `controls.test.tsx`, `packages/shot-ui/package.json`
- `packages/shot-ui/src/{readout/CardResult.tsx,period/PeriodResult.tsx,list/ListHeader.tsx,start/EveningBlock.tsx,
  list/KindMark.tsx}` und Tests
- `apps/spiegel/src/components/{card/CardScreen.tsx,progress/ProgressScreen.tsx,list/ListScreen.tsx,
  start/StartScreen.tsx}`, `shell/{ScoringControl,KindControl}.tsx` (entfallen)
- `tools/labor/src/CardView.tsx`, `tools/labor/pruefung.js`
- Doku wie in Aufgabe 6

## Required Docs

- `vault/conventions.md` §10 (Design 2: Tokens, keine Palette-Klassen, allgemeine Bausteine), `packages/shot-ui/CLAUDE.md`
  („Auf dem Telefon dieselbe Optik wie am Desktop“, „Nichts anschneiden, wo Platz ist“, Farben nur aus Tokens),
  `apps/spiegel/CLAUDE.md` („Wertung je Scheibe und je Familie“, „Art der Scheibe wie die Wertung“), `tools/labor/CLAUDE.md`
  (Eigenheiten der Skriptprüfung)
- [[spiegel-navigation]] („Wertung je Scheibe und je Familie“, „Art der Scheibe“)
- `reports/2026-10-12-spiegel-art-review.md` (N1, N2)

## Tests

- `RoundToggle`: Knopf mit Name und Titel, Klassen für Standard und Gold.
- `ScoringToggle`: ¹⁄₁ und ¹⁄₁₀, Name mit „amtlich“ nur bei der amtlichen, eigener Name, `data-scoring`.
- `KindToggle`: Training gedämpft, Wettkampf gold, Name, `data-kind`.
- `CardResult`, `PeriodResult`, `EveningBlock`, `ListHeader`: `actions` in der Zeile der Zahl bzw. des Titels, `notice`
  unten; `EveningBlock` mit `actions` ohne „in …“, ohne mit.
- `KindMark`: Pokal `text-warning size-4`.
- Labor: `pruefen` 0 FAIL.

## Verifikation

- `pnpm check`, Labor `pruefen`, `vault-lint`.
- Browser (frischer Tab, eigene Scheiben):
  - Seite einer Scheibe am Telefon (375 px) und am Desktop: Pokal und Bruch rechts neben der Zahl, 32 px, ohne Rand,
    kein Überlappen; Tippen auf den Pokal: gold, Metazeile „Wettkampf“, Wertung amtlich; Tippen auf den Bruch: ¹⁄₁₀ ↔ ¹⁄₁;
    bei nur Probe nur der Bruch.
  - Liste: Kreis rechts neben „Scheiben“, Pokale gold; Fortschritt: Kreis in der Ergebnis-Box; Start: Kreis neben der
    Zahl je Block, Speichern ändert Liste und Fortschritt mit.
  - Abgelehnter POST (im Tab `fetch` ersetzt): eine Meldung, gleich in Kopf und Box. Konsole ohne Fehler.
