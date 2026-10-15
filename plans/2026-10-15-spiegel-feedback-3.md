# Spiegel: Befunde aus dem Review der zweiten Rückmeldungen

## Kontext

Der User hat `feat/spiegel-feedback-2` gemerged, während das Review lief (`e4b5f9b4`). Die Befunde stehen in
`reports/2026-10-15-spiegel-feedback-2-review.md`, am Code bestätigt; dieser Plan setzt die übernommenen um (1–12). Freigabe
des Users: „ja, leg den Plan an und mach das autonom“. Keine Schemaänderung, keine geschützten Pfade.

## Entscheidungen

- **D1 Merkmale einer Scheibe an einer Stelle** (Befund 1, major): `CARD_FLAGS` und Typ `CardFlag` in
  `packages/shot-core/src/metrics.ts` (neben den `FLAG_*` der Schüsse), alle Kennungen, die an `Card.flags` stehen können:
  nur-pdf, unvollstaendig, ausgenommen, nur-probe, leer, ueber-soll, korrigiert, uhr-abweichung, neu-gewertet,
  als-wertung-gezaehlt, disziplin-unbekannt, scheibe-passt-nicht. `FLAG_NAMES` in `shot-ui` wird
  `Record<CardFlag, string>`: Fehlt ein Name, scheitert `tsc`. Der Adapter (`meyton-ssmdb2.ts`) schreibt `CardFlag[]`,
  seine Konstanten und die in `cards.ts` und `records.ts` sind `CardFlag`: Eine neue Kennung ohne Eintrag scheitert
  ebenso. Neue Namen: „Disziplin unbekannt“, „Scheibe passt nicht“.
- **D2 Umschalter, der umbricht** (Befunde 5, 6): `Segmented` in `@vereinsheim/ui/design2` bekommt `wrap`: Die Knöpfe
  brechen um (Kasten `rounded-2xl`, Knöpfe `max-w-full`, langer Name bricht), Radiogruppe, Tab nur auf der Wahl und
  Pfeiltasten bleiben. Liste und Merkmal im Blatt „Filter“ nutzen ihn; `ListChoice` fällt weg.
- **D3 Wortlaut** (Befunde 3, 4, 10), erst ins Textbuch:
  - Profil unter einer abgelehnten Nummer: „Ein Konto hat eine Sportpassnummer. Für eine andere Nummer entferne die
    abgelehnte. Dann trag die neue ein.“ Unter einer anderen bleibt der Satz mit „widerrufe“.
  - Fehler der Action, wenn nur abgelehnte da sind: „Du hast schon eine abgelehnte Sportpassnummer. Für eine andere
    entferne sie erst.“ Sonst wie bisher.
  - Dialog „Entfernen“, was passiert: „Es steht dann nicht mehr unter „Brücke im Schützenhaus“.“
  - Fehler beim Entfernen: unbekannt „Diese Brücke gibt es nicht mehr. Lade die Seite neu.“; nicht getrennt „Diese Brücke
    ist nicht getrennt. Lade die Seite neu.“
- **D4 Welche Action zum Knopf an der Brücke gehört** (Befund 7): reine Funktion `bridgeActionOf(bridge)` in
  `SiteForms.tsx` mit Text des Knopfs, Dialog und Action; der Test prüft die Zuordnung, nicht nur den Text.
- **D5 Prüfung im Browser** (Befund 8): `pruefen.ts` öffnet das Blatt „Filter“ unter Scheiben (Telefon und Desktop):
  Das Blatt scrollt nicht seitlich, jeder Knopf von Art, Liste und Merkmal liegt in ihm. Ohne Listen in den Daten steht
  das als „nicht belegt“ in der Zeile.

## Required Docs

- `apps/spiegel/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`, `packages/shot-core/CLAUDE.md`
- `vault/conventions.md` §10, Textbuch „Textbuch Spiegel“
- `reports/2026-10-15-spiegel-feedback-2-review.md`

## Dateien

| Datei | Änderung |
| --- | --- |
| `packages/shot-core/src/metrics.ts` (+ Test), `analysis/records.ts`, `packages/shot-ui/src/list/ListControls.tsx` (+ Test), `apps/spiegel/src/lib/ingest/meyton-ssmdb2.ts`, `src/lib/db/cards.ts` | T2 |
| `packages/ui/src/design2/segmented.tsx` (+ Test), `packages/shot-ui/src/list/ListControls.tsx` (+ Test) | T3 |
| `apps/spiegel/src/components/profile/SportpassConsents.tsx` (+ Test), `src/lib/consent/actions.ts` (+ Test) | T4 |
| `apps/spiegel/src/lib/admin/consequences.ts`, `site-actions.ts` (+ Tests), `src/components/admin/SiteForms.tsx` (+ Test) | T5 |
| `apps/spiegel/tools/pruefen.ts` | T6 |
| `vault/spiegel/spiegel-assignment.md`, `vault/spiegel/spiegel-db-schema.md`, `vault/conventions.md` §10, Scope-Notizen | T7 |

## Aufgaben

1. **T1 Textbuch:** Abschnitt „Nach dem Review der zweiten Rückmeldungen“ mit den Texten aus D1 und D3.
2. **T2 Merkmale:** `CARD_FLAGS`/`CardFlag`, `FLAG_NAMES` vollständig und getypt, Adapter, `cards.ts`, `records.ts`
   getypt. Tests: jede Kennung aus `CARD_FLAGS` hat einen Namen, der nicht die Kennung ist; der Adapter schreibt nur
   Kennungen aus `CARD_FLAGS` (an allen Fällen von `ssmdb2-cases`).
3. **T3 Umschalter mit Umbruch:** `wrap` in `Segmented`; Liste und Merkmal im Blatt nutzen ihn. Tests: Markup (`flex-wrap`,
   Radiogruppe, Tab nur auf der Wahl), Blatt (Liste und Merkmal umbrechend, Wahl ändert die Abfrage, unbekannte Liste
   zeigt „Alle“).
4. **T4 Abgelehnte Nummer:** Satz und Fehler nach D3; der tote Zweig „steht schon in deinem Profil“ fällt weg. Tests:
   Markup je Zustand; Action mit nur abgelehnter Nummer.
5. **T5 Brücke:** Dialogtext und Fehlertexte nach D3, `bridgeActionOf` mit Test der Zuordnung, JSDoc; der Test der Action
   räumt mit `try/finally` auf.
6. **T6 Prüfung:** das Blatt „Filter“ nach D5.
7. **T7 Doku:** Vault („eine je Konto“), `conventions.md` §10 (`Segmented` mit `wrap`), Scope-Notizen.

## Testschritte

- `pnpm check` nach jedem Task.
- Mutationsproben: ein Name in `FLAG_NAMES` entfernt (`tsc` rot); Zuordnung in `bridgeActionOf` vertauscht (Test rot).
- `pruefen --start --alle` mit dem Demo-Konto (`seed:own --demo`, Prüfung, `seed:own` in einem Befehl).
- Browser mit Wegwerf-Listen und mehreren Merkmalen an Demo-Scheiben, Telefon und Desktop; danach entfernen.

## Verifikation

Bericht `reports/2026-10-15-spiegel-feedback-3.md`, danach `/review`. Merge durch den User.
