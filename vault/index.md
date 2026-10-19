# vault — Wissens-Index (vereinsheim)

> Master-Katalog des Wissens-Vaults (ADR-025). Kein Graph-Node (der Loader überspringt
> `index.md`/`SCHEMA.md`). Bei jedem Add/Remove/Rename einer Note aktualisieren.
> **Einstieg für Agenten:** `mcp__memory__search_nodes` (BM25, DE/EN) → `document_map` →
> `section_read`. Der Vault **ist** der Graph — Notes werden live editiert, kein Build.

## Lese-Reihenfolge (Onboarding)

1. [[overview]] — Was ist vereinsheim (Gesamtsystem, Monorepo, drei Apps plus Brücke).
2. [[conventions]] — app-übergreifende Konventionen (@-importiert in die Root-CLAUDE.md).
3. [[architecture]] — High-Level-Karte (Topologie, Netze, Build/Deploy).
4. [[decisions]] — ADR-Kanon (Begründungen); vor jedem architektur-berührenden Vorschlag prüfen.
5. [[operations]] — Daily Ops mit dem CLI, Recovery-Pfade.
6. [[spiegel]] — Spiegel (dritte App, Schussrohdaten aus Meyton): Wegweiser, Roadmap, offene Fragen.
7. [[meyton]] — Wissen über die Meyton-Anlage (SSMDB2, Schnittstellen, Ausdruck mit QR).

## Katalog nach Typ

- **guide** (MOCs + Narrative): …
- **decision** (ADRs): adr-001 … adr-033
- **source** (Provenienz): src-meyton-ssmdb2-handbuch, src-meyton-live-display, src-meyton-recherche-2026-10, src-meyton-disziplin-erstellen, src-ssmdb2-zugang-recherche, src-ssmdb2-abend-2026-10-09, src-ssmdb2-kopie-2026-10-09
- **subsystem** / **operation** / **concept** (atomar): …
- **incident** (REMEMBER-Tier): …
