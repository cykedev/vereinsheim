# Mitmachen / Contributing

Issues und Pull Requests sind willkommen, auf Deutsch oder Englisch.

## Sprachen

- Oberfläche der Apps: Deutsch (die Nutzer sind deutschsprachige Schützenvereine).
- Code, Bezeichner, Commit-Messages: Englisch (Conventional Commits, z.B. `feat(spiegel): …`).
- Doku im `vault/`: Deutsch.

## Vorgehen

1. Fork und Branch `feat/<thema>` von `main`.
2. `./scripts/vereinsheim dev-setup`, dann `pnpm dev`. Spiegel ohne Anlage: `pnpm --filter spiegel seed:own --demo`.
3. Vor dem Commit `pnpm check` (Lint, Format, Tests, Typen, Build) grün.
4. Änderungen an der Oberfläche im Browser ansehen, hell und dunkel, Telefon und Desktop. Die Regeln von Design 2
   stehen in [`vault/conventions.md`](vault/conventions.md); das Release-Gate (`scripts/consistency-check.sh`) prüft sie.
5. Pull Request mit der Vorlage; keine Merge-Commits, der Branch wird per Fast-Forward übernommen.

## Was nicht ins Repo gehört

Keine echten Namen, Sportpassnummern oder Schussdaten anderer Personen, auch nicht in Tests, Fixtures oder Screenshots
([ADR-029](vault/decisions/adr-029.md)). Erfundene Daten liefern `seed:own --demo` (Spiegel) und `pruefdaten` (Ringwerk).

## Entscheidungen

Architektur-Entscheidungen stehen als ADRs unter [`vault/decisions/`](vault/decisions/decisions.md). Ein Vorschlag, der
einer ADR widerspricht, nennt sie im Issue, dann reden wir darüber, bevor Code entsteht.

---

**In English:** issues and PRs welcome. UI is German, code and commits English, docs German. Branch from `main`,
run `pnpm check` before committing, look at UI changes in both themes and on a phone, never commit real personal data
(ADR-029). Architecture decisions live in `vault/decisions/`.
