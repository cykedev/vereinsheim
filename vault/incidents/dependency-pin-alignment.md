---
id: dependency-pin-alignment
type: incident
title: "dependency-pin-alignment"
keywords: [Abhängigkeiten, Dependency-Pins, Versionen angleichen, Drift, dependencies, dependency alignment, TypeScript-Version, Pakete, Major-Upgrade, zurückgestellt, Sicherheitsupdate, CVE, pnpm audit, Node 26, corepack, Lockfile neu auflösen, zod codepoints]
tags: [state]
relates_to: ["[[overview]]", "[[drift-protection]]"]
part_of: ["[[incidents]]"]
documented_in: ["[[conventions#8. Drift-Schutz (Prozess)]]"]
---

**TL;DR** Pins sind zwischen den Apps angeglichen (alles Geteilte kommt aus dem Catalog, Drift-Gate
meldet keine Dependency-Drift). Seit dem Sammel-Update vom 24. Oktober 2026 laufen alle Apps auf Node 26 mit den
neuesten Patch- und Minor-Versionen, dazu vitest 5, dotenv 18, @hookform/resolvers 6 und prettier 3.9; `pnpm audit`
meldet nichts. OFFEN bleiben fünf bewusst zurückgestellte Majors (TypeScript 7, ESLint 10, Prisma 8, pnpm 11/12, Postgres) und
dass Dependency-Drift im consistency-check nur warnend ist, nicht fatal.

## Sammel-Update Oktober 2026

Anlass waren die kritischen Next-Lücken vom 14. Oktober 2026 (RCE in der Bildoptimierung und in `use cache`, DoS mit
Server Actions; behoben ab 16.4.1) und dass Node 24 am 20. Oktober in die Wartung ging (Node 26 ist ab 28. Oktober
Active LTS). Umgesetzt:

- **Node 26** in `Dockerfile`, `.nvmrc` und `engines`; `@types/node` 26 folgt der Laufzeit. `node:26-alpine` bringt kein
  corepack mehr, das Image installiert es über npm.
- **Alle Patch- und Minor-Versionen** (Next 16.4.3, Prisma 7.10.1, React 19.3.1, Zod 4.6.7 …), das Lockfile frisch
  aufgelöst, damit die transitiven Fixes ankommen. Wer das wiederholt: `pnpm-lock.yaml` **und** alle `node_modules`
  löschen, sonst übernimmt pnpm die alten Auflösungen aus `node_modules/.pnpm/lock.yaml`.
- **Zod 4.6 zählt bei `min`/`max` Codepoints** statt UTF-16-Codeeinheiten. Für Formulare ist das richtig (Postgres zählt
  ebenso Zeichen); der Ingest-Vertrag zählt wie die Brücke Codeeinheiten und prüft das jetzt selbst (`utf16Text` in
  `packages/ingest-contract/src/text.ts`). Aufgefallen am Testvektor `zelle-zu-lang-utf16`.
- **prettier 3.9.10**: die im August offene Formatierungs-Churn ist erledigt (kurze Unions einzeilig).

## Zurückgestellte Bumps (Stand Oktober 2026)

- **typescript 6.0.3 → 7.0.2** — `typescript-eslint` 8.72 (über `eslint-config-next`) erlaubt nur `typescript <6.1.0`.
- **eslint 9.39.5 → 10.13.0** — `eslint-plugin-react` 7.37.5 (über `eslint-config-next`) erlaubt ESLint nur bis
  `^9.7`; 9.39 ist die Wartungslinie.
- **prisma 7.10.1 → 8** — nur Release Candidates (`8.0.0-rc.27` trägt das Tag `latest`).
- **pnpm 10.34.8 → 11/12** — neue Lockfile- und Konfigurationsform; `turbo prune` muss sie lesen können. Eigener
  Durchlauf mit dem Image-Build.
- **postgres 15 → neuere Major** — braucht Dump und Restore der Produktionsdaten; die Images `postgres:15-alpine` und
  `caddy:2-alpine` ziehen beim Deploy den neuesten Patch ihrer Linie.
- **recharts** — erledigt: Treffsicher zeichnet seit Teil G von [[adr-032]] mit `shot-ui`, `recharts` ist entfernt
  (Oktober 2026).
