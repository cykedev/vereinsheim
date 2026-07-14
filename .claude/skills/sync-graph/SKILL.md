---
name: sync-graph
description: Den Memory-Graph-Vault nach Note-/ADR-Änderungen validieren und aufräumen — vault-lint laufen lassen, jedes Schema-Problem in der Note fixen, Cross-Reference-Lücken schließen, vault/index.md pflegen. Nach Änderungen an vault/ oder wenn der Graph veraltet wirkt.
invocation: [user, Claude]
---

# /sync-graph

Der Memory-Graph **ist** der Vault ([ADR-025](../../../vault/decisions/adr-025.md)) — es gibt
**keinen Build-Schritt und kein Manifest** mehr abzugleichen (das löste die gebaute-Index-Mechanik
aus ADR-022 ab). Dieser Skill hält den Vault nach Edits kohärent; er *baut* nichts.

1. `git diff --stat -- vault/` — welche Notes sich geändert haben.
2. `node .claude/vault-lint.mjs` — jedes gemeldete Problem **in der Note** fixen (nicht in einem
   Store — es gibt keinen): `type`, eindeutige `id` (== Dateiname), dangling `[[edge]]`, fehlender
   `title`, ein `documented_in`-Anker ohne passende Überschrift im Ziel-Guide, eine atomare Note
   (`subsystem`/`operation`/`concept`/`incident`) ohne kuratierte `keywords:`-Zeile. Der Graph ist
   live, sobald die Note gespeichert ist.
3. **Cross-Reference-Lücken schließen** — ein neues Konzept muss erreichbar sein (sonst nur per
   Suche findbar, nicht per Graph-Walk):
   - **Membership**: `subsystem_of`/`operation_of`/`feature_of` bzw. `part_of` zum Topic-MOC
     (`architecture`/`operations`/`monorepo`/`domain`/`incidents` bzw. `ringwerk`/`treffsicher`).
   - **`governed_by`** zur ADR, falls eine die Entscheidung trägt (`informed_by`, wenn nur beeinflusst).
   - **`documented_in`** zum Guide-Abschnitt, der es ausführt (`"[[guide#Überschrift TEXT]]"` — Anker =
     Überschriften-Text, kein Slug) → die dünne Note erbt die Such-Keywords dieses Abschnitts.
   - Bei konzeptionell symmetrischen Relationen die Gegen-Kante ergänzen (`relates_to`/`contrasts_with`/
     `see_also`). Volles Vokabular: `vault/SCHEMA.md` §4.
4. `vault/index.md` aktuell halten (Katalog nach Typ + Lese-Reihenfolge) und die geänderten Notes
   zusammen committen. Am Turn-Ende erzwingt der graph-sync-Stop-Hook ohnehin `vault-lint` (blockt bei
   invalidem Vault) — dieser Skill ist die kuratierende Ergänzung (Cross-Refs + Index), die ein Hook
   nicht leisten kann.
