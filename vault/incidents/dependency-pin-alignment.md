---
id: dependency-pin-alignment
type: incident
title: "dependency-pin-alignment"
keywords: [Abhängigkeiten, Dependency-Pins, Versionen angleichen, Drift, dependencies, dependency alignment, TypeScript-Version, Pakete, Major-Upgrade, zurückgestellt]
tags: [state]
relates_to: ["[[overview]]", "[[drift-protection]]"]
part_of: ["[[incidents]]"]
documented_in: ["[[conventions#8. Drift-Schutz (Prozess)]]"]
---

**TL;DR** Pins sind zwischen den Apps angeglichen (alles Geteilte kommt aus dem Catalog, Drift-Gate
meldet keine Dependency-Drift); OFFEN bleiben fünf bewusst zurückgestellte Major-/Churn-Bumps und
dass Dependency-Drift im consistency-check nur warnend ist, nicht fatal.

## Zurückgestellte Bumps (Stand August 2026)

Beim Sammel-Update im August 2026 wurden alle Patch-/Minor-Versionen angehoben (inkl. Next 16.3.2,
Prisma 7.9.1, React 19.2.8) und `@types/bcryptjs` entfernt (bcryptjs 3.x liefert eigene Typen).
Nicht angefasst, jedes mit eigenem Grund:

- **typescript 6.0.3 → 7.0.2** — Major; braucht eigenen Durchlauf über beide Apps + `packages/*`.
- **eslint 9.39.4 → 10.9.0** — Major; hängt an `eslint-config-next`-Kompatibilität und der geteilten
  Flat-Config in `packages/config`.
- **recharts 2.15.4 → 3.10.1** — Major mit API-Brüchen; wird in ~10 Treffsicher-Chart-Komponenten
  plus dem shadcn-`chart.tsx`-Wrapper benutzt. Eigenes Vorhaben mit visueller Abnahme.
- **@types/node 24.13.2 → 26.2.0** — **darf nicht** hoch: die Runtime ist `node:24-alpine`
  (Dockerfile) und `engines.node: >=24`. Die Typen müssen der Runtime folgen, nicht umgekehrt.
- **prettier 3.8.4 → 3.9.6** — kein Major, aber 3.9 formatiert kurze Union-Typen einzeilig statt
  mehrzeilig mit führendem `|`. Betrifft 6 Dateien, darunter den in `conventions` dokumentierten
  `ActionResult`-Kanon. Reine Formatierungs-Churn ohne Nutzen → bewusst offen als eigene Entscheidung.
