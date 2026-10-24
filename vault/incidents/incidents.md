---
id: incidents
type: guide
title: "Incidents & offener Zustand"
keywords: [incidents, zustand, state, remember, offene punkte, lernlog, backlog, gaps, lücken]
part_of: ["[[overview]]"]
---

**TL;DR** Projekt-spezifischer Zustand zum ERINNERN (ADR-017): offene Punkte, Lernlog-Fakten und Zustände, die in keiner Doku stehen.

MOC-Hub der REMEMBER-Tier-Notes ([[adr-017]]). Normale Notes, live editiert (kein Rebuild, ADR-025).

## Notes

- [[best-of-playoff-seeding-round-robin-table]] — best-of-playoff-seeding-round-robin-table
- [[caddy-x-real-ip-passthrough]] — Caddy reicht ein gefälschtes X-Real-IP durch (Ratenbegrenzung umgangen, behoben mit `header_up`)
- [[node-heap-above-container-limit]] — Node setzt den Heap über eine kleine Container-Grenze (`--max-old-space-size` dazu)
- [[postgres-image-loopback-trust]] — im Postgres-Image prüft 127.0.0.1 kein Passwort (Prüfung über `-h db`)
- [[bash-errexit-in-or-list]] — `set -e` gilt nicht in einer Funktion links von `||` (jeder Schritt prüft selbst)
- [[compose-up-restarts-one-shot-containers]] — `compose up` ohne Dienstliste startet beendete Migratoren neu (`--no-deps`)
- [[spiegel-dialog-texts-not-understood]] — Spiegel-Dialoge in der Sprache des Codes, für den Admin unverständlich (Schreibregeln, Textbuch)
- [[data-url-preview-blocks-anchors]] — Vorschau als data:-Seite blockt Anker und Speicher
- [[best-of-standings-direct-comparison-tiebreak]] — best-of-standings-direct-comparison-tiebreak
- [[deadline-wipe-on-hidden-form-fields]] — deadline-wipe-on-hidden-form-fields
- [[dependency-pin-alignment]] — dependency-pin-alignment
- [[env-var-alignment-gap]] — env-var-alignment-gap
- [[meyton-pdf-format-change]] — meyton-pdf-format-change
- [[public-pdf-cache-tag-orphaning]] — Cache-Tag des öffentlichen PDFs hing am Slug statt an der ID (verwaiste Einträge)
- [[next-dist-dir-shared-with-dev-server]] — `pnpm check` und `next dev` teilen sich `.next` (TS2307, alte Chunks)
- [[dev-shadow-db-createdb]] — Dev-Rollen ohne `CREATEDB`, `prisma migrate dev` scheitert mit P3014
- [[autopilot-guard-blocks-contract-only-plans]] — Pläne nur in geschützten Pfaden laufen interaktiv, nicht autonom
- [[ruleset-lock-granularity]] — ruleset-lock-granularity
- [[stechschuss-modell-flip]] — stechschuss-modell-flip
- [[loading-boundary-hidden-copy]] — mit `loading.tsx` bleibt im Hintergrund-Tab eine versteckte Kopie der Seite (doppelte Ids)
