# @vereinsheim/shot-help — Claude Scope-Notiz

Hilfe und Erklärungen für Spiegel (SP-1.11, Oktober 2026): jede Kennzahl und jede Auswertung in
einfacher Sprache, als Daten aus **einer** Quelle für App, Spielwiese und Doku. Wunsch des Users: „gute
dokumentation und hilfe, auch in der anwendung, das ist wichtig“. Plan:
`plans/2026-10-06-spiegel-help.md`. Fachliche Definitionen und Formeln: `vault/spiegel/spiegel-statistics.md`.

## Exporte

| Export                            | Datei             | Inhalt                                                             |
| --------------------------------- | ----------------- | ------------------------------------------------------------------ |
| `@vereinsheim/shot-help/types`    | `src/types.ts`    | `HelpTopic`, `HelpTheme`, `ViewHelp`, `GlossaryEntry`, `GuideItem` |
| `@vereinsheim/shot-help/topics`   | `src/topics.ts`   | `HELP_TOPICS`: eine Erklärung je Karte der Oberfläche              |
| `@vereinsheim/shot-help/guide`    | `src/guide.ts`    | `READING_GUIDE`, `VIEW_HELP`, `FALLACIES`                          |
| `@vereinsheim/shot-help/glossary` | `src/glossary.ts` | `GLOSSARY`                                                         |
| `@vereinsheim/shot-help/lookup`   | `src/lookup.ts`   | `helpTopic`, `helpForMetric`, `helpForCatalog`                     |
| `@vereinsheim/shot-help/markdown` | `src/markdown.ts` | `renderGuideMarkdown`, `wrapText`                                  |

## Regeln

- **Eine Quelle.** Erklärungen stehen nur hier. Der Hauptteil von `vault/spiegel/spiegel-statistics-help.md`
  wird erzeugt (`pnpm --filter @vereinsheim/shot-help docs`), nie von Hand geändert; ein Test vergleicht
  ihn mit dem Paket. Wer einen Text ändert, erzeugt die Doku neu und committet beides.
- **Nichts fehlt.** Jede Registry-Kennzahl (`METRICS`) gehört zu genau einem Thema, jede Katalog-ID aus
  `ANALYSIS_CATALOG` (`@vereinsheim/shot-core/analysis`) zu mindestens einem. Eine neue Auswertung oder
  Kennzahl ohne Erklärung macht das Gate rot.
- **Stil:** deutsch, „du“, einfache Sprache; erst Worte, die Formel nur in `formula`; deutsche
  Anführungszeichen „…“, Unicode-Ellipse, jeder Text endet mit einem Satzzeichen. Zahlen in Texten
  (Grenzen, Simulationen) nur, wenn sie in Katalog oder Code belegt sind.
- Rein und isomorph: kein `server-only`, keine Node-APIs in `src/` außer in Tests;
  `@vereinsheim/shot-core` nur als `devDependency` für die Prüfungen. Eine Next-App, die das Paket nutzt,
  braucht es in `transpilePackages` (`packages/config/next/index.mjs`).
- Der Test `test` liest den Vault-Leitfaden; `turbo.json` des Pakets nimmt ihn deshalb in die Eingaben
  (`$TURBO_ROOT$`), damit eine Änderung dort den Cache ungültig macht.
- Nach Änderungen: `pnpm check`; `format:check` prüft auch diese Datei.
