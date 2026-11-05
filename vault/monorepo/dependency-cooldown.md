---
id: dependency-cooldown
type: subsystem
title: "Wartezeit für neue Pakete"
aliases: ["Wartezeit für neue Pakete", "Cooldown für Abhängigkeiten"]
keywords: [minimumReleaseAge, minimumReleaseAgeExclude, trustPolicy, no-downgrade, blockExoticSubdeps, cooldown, supply chain, Lieferkette, Supply-Chain-Angriff, kompromittiertes Paket, gestohlenes Token, npm before, Sicherheitsfix, CVE, Migrator, Abhängigkeiten aktualisieren]
tags: [subsystem, security]
part_of: ["[[monorepo]]"]
governed_by: ["[[adr-015]]"]
relates_to: ["[[dependency-pin-alignment]]", "[[drift-protection]]", "[[build-deploy-pipeline]]"]
---

**TL;DR** pnpm nimmt beim Auflösen nur Versionen, die mindestens sieben Tage alt sind, auch transitive
(`minimumReleaseAge: 10080` in `pnpm-workspace.yaml`). Dazu bricht es ab, wenn eine Version mit schwächerem
Herkunftsnachweis erscheint (`trustPolicy: no-downgrade`), und lässt transitive Pakete nur aus der Registry zu
(`blockExoticSubdeps`). Der Migrator im Dockerfile installiert über npm ohne Lockfile, deshalb dort feste Versionen wie im
Catalog (Drift-Gate) und `--before` mit einem Stichtag sieben Tage zurück. Seit 5. November 2026.

# Wartezeit für neue Pakete

## Warum

Kompromittierte Versionen auf npm werden meist binnen Stunden entdeckt und zurückgezogen. Wer erst nach sieben Tagen
übernimmt, fängt sie fast nie ein. Der Preis ist, dass auch ein Fix sieben Tage wartet.

## Wo es greift

- **Beim Auflösen:** `pnpm add`, `pnpm update`, ein Sammel-Update und jedes `pnpm install`, das den Lockfile ändert. Eine
  zu junge Version bricht ab, mit dem Hinweis auf `minimumReleaseAgeExclude`.
- **Nicht im Build:** Das Image installiert mit `--frozen-lockfile` und löst nichts neu auf. Dort schützt der Lockfile.
- **Im Migrator:** Er installiert `prisma`, `pg` und `dotenv` über npm, ohne Lockfile und bei jedem Release neu. Die
  Versionen stehen exakt da, und das Drift-Gate (`scripts/consistency-check.sh`, „Versionen im Migrator wie im Catalog“)
  bricht ab, wenn sie vom Catalog abweichen. `--before` begrenzt auch die transitiven Pakete auf Versionen, die sieben
  Tage alt sind. Eine Version im Catalog ist nach der Regel von pnpm schon so alt, sie passt also immer.
- **Nicht die Brücke:** Go legt jede Version in `go.sum` fest und löst nichts frei auf.

## Ein dringender Sicherheitsfix

1. Die eine Version in `pnpm-workspace.yaml` ausnehmen, mit genauer Version:
   `minimumReleaseAgeExclude: ["next@16.4.4"]`.
2. Im Catalog heben, `pnpm install`, Gate, Commit.
3. Steht das Paket auch im Migrator, dort ebenfalls heben und für diesen Build `--before` herausnehmen, sonst findet npm
   die Version nicht.
4. Beim nächsten Update den Eintrag aus der Ausnahmeliste und das `--before` wieder zurück.

## Geprüft

Am 5. November 2026 in einem leeren Ordner mit denselben Einstellungen: `typescript@7.1.0-dev.20261105.1` (einen Tag
alt) lehnte pnpm 10.34.8 ab, `typescript@6.0.3` nahm es an. Im Repo liefen `pnpm install --frozen-lockfile` und
`pnpm install` ohne Änderung am Lockfile durch. Das Migrator-Image für Spiegel baute mit prisma 7.10.1, pg 8.23.1 und
dotenv 18.0.9, die Schema-Engine lag im Image.

## Beim Wechsel auf pnpm 11 oder 12

Dort ist die Wartezeit ab Werk ein Tag und nicht streng (zu junge Versionen fallen auf ältere zurück). Weil sie hier
ausdrücklich gesetzt ist, gilt sie dort als streng (`minimumReleaseAgeStrict`). Die Einstellung bleibt also stehen.
