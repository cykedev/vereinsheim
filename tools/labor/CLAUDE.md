# Labor — Claude Scope-Notiz

Eine Seite aus den echten Bausteinen von Spiegel (`@vereinsheim/shot-ui`, Design-2-Bausteine aus
`@vereinsheim/ui`) mit erfundenen Beispielscheiben, gebaut zu einer einzigen HTML-Datei. Zum Ausprobieren
und Beurteilen, auch auf dem Handy als privates Artifact „Spiegel-Labor“
(https://claude.ai/artifact/RBdMhiyLsNvqbVDWvJH5Ni; aus einer anderen Session mit dieser Adresse als `url`
neu veröffentlichen). Plan: `plans/2026-10-08-spiegel-shot-ui-fundament.md`; Vorbild war die Spielwiese
(`tools/spielwiese`).

## Befehle

| Befehl                                     | Zweck                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `pnpm --filter @vereinsheim/labor build`   | `dist/labor.html` (für das Artifact) und `dist/preview.html` (Browser) |
| `pnpm --filter @vereinsheim/labor pruefen` | Skriptprüfung in Headless-Chrome (`pruefung.js`), `--alle` zeigt jede  |

## Regeln

- **Nur echte Bausteine:** Das Labor zeichnet und rechnet nichts selbst. Was es zeigen soll, kommt als
  Baustein nach `shot-ui` (mit Tests) und wird hier nur verdrahtet; Zahlen nur aus dem Fachkern.
- **Nach jeder Änderung** an Bausteinen oder Labor: `pruefen` muss „0 FAIL“ melden (nicht im Gate, braucht
  Chrome; `CHROME_PATH` für einen anderen Pfad). Neue Bedienung bekommt Prüfungen in `pruefung.js`.
- **Eigenheiten der Skriptprüfung** (Headless-Chrome mit `--dump-dom`): Ein synthetischer Klick fokussiert
  nicht und eine synthetische Taste löst keine Aktion aus (Tastatur nur über echte, fokussierbare Knöpfe
  prüfen); das `close`-Ereignis eines `<dialog>` kommt spät oder gar nicht (nie darauf warten; Escape-Weg
  über `requestClose()`, das synchrone `cancel`). Die Prüfung läuft nur mit `#pruefen`, ein Abbruch steht als FAIL im Bericht;
  `window.__labor` (Prüfhaken) liefert Schüsse, Zustand und die Funktionen des Fachkerns zum Nachrechnen.
- **Artifact neu veröffentlichen** aus `dist/labor.html` nach einem direkten `pnpm --filter @vereinsheim/labor
build` (ohne Turbo-Cache, sonst kann der Stand-Stempel von einem älteren Commit stammen), unter derselben
  Adresse, damit der User den
  Stand auf dem Handy sieht.
- **Beispiele** (`src/samples.ts`) mit festem Seed und festem Beginn, Lagen auf 1/100 mm; kein echter
  Ausdruck (ADR-029). Die Seeds sind die der Spielwiese, damit beide dasselbe zeigen.
- `build` läuft im Gate (esbuild und Tailwind über PostCSS, unter zwei Sekunden) und hängt an `^build`,
  damit eine Änderung an einem Baustein den Cache ungültig macht.
- Nach Änderungen: `pnpm check`; `format:check` prüft auch diese Datei.
