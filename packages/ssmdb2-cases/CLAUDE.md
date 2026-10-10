# @vereinsheim/ssmdb2-cases — Claude Scope-Notiz

Sonderfall-Testdaten für Brücke und Spiegel (SP-1.0 b, Oktober 2026, `plans/2026-10-10-spiegel-ssmdb2-cases.md`): je
Sonderfall mit SSMDB2-Bezug eine erfundene Ablage im echten Schema als Folge von Ständen, mit Snapshots v1, SQL je
Schritt und erwartetem Ergebnis. Fachwissen: `vault/meyton/meyton-ssmdb2.md`, `vault/spiegel/spiegel-edge-cases.md`.

## Regeln

- **Nur erfundene Daten** (ADR-029): Namen „Muster“, Sportpass 12345678, kein Verein, keine echte ScheibenID.
- **Das Schema ist das echte** (`schema/ssmdb2.sql`, Kopie vom 9. Oktober 2026); `src/schema.ts` folgt ihm, ein Test
  hält beide gleich.
- Nach Änderungen: `pnpm check`; `format:check` prüft auch diese Datei.
