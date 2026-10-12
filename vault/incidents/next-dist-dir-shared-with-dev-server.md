---
id: next-dist-dir-shared-with-dev-server
type: incident
title: "Gate und next dev teilen .next — check-types rot ohne Diff"
keywords: [distDir, .next, NEXT_DIST_DIR, next dev, pnpm check, TS2307, routes.js, validator.ts, Gate rot ohne Diff, Dev-Server, Fast Refresh, --force, ungecacht, Wettrennen, concurrency, .next/dev, turbo cache, outputs, altes Bundle, Hydrierung, hydration mismatch, veraltet]
tags: [incident, gates]
relates_to: ["[[monorepo]]", "[[ringwerk]]", "[[treffsicher]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 2026-09-09 (ringwerk): `pnpm check` und ein laufender `next dev` teilen sich
`apps/<app>/.next`. Der Produktions-Build zerlegt dabei die vom Dev-Server erzeugte
`.next/types/validator.ts` (die `tsconfig` zieht sie über `include` mit) → `check-types` bricht mit
`TS2307: Cannot find module './routes.js'` ab, **obwohl der Diff sauber ist**. Wer daraufhin den
eigenen Diff verdächtigt, sucht am falschen Ort.

Zweiter Effekt derselben Kollision: ein `rm -rf .next` bei **laufendem** Dev-Server killt dessen
`.next/dev`; die App antwortet dann bis zum Neustart auf jeder Seite mit
`Cannot read properties of undefined (reading 'call')`. In dieser Session hat genau das eine
laufende Sitzung des Users abgeschossen.

Dritter Effekt, ohne Dev-Server (2026-10-06): Im **ungecachten** Lauf (`pnpm check --force`) laufen
`next build` und `check-types` derselben App gleichzeitig; der Build schreibt `.next/types` neu,
während `tsc` sie liest. Zweimal derselbe `TS2307` in `ringwerk#check-types`, ohne Änderung unter
`apps/`; allein und mit `--filter=ringwerk` grün, nacheinander (`--concurrency=1`) grün. Im normalen
Lauf sind die App-Tasks gecacht, dann tritt es nicht auf; rot wird es erst, wenn eine App sich ändert
und beide Tasks unter Last zusammenfallen.

**Behoben (2026-10-06, `turbo.json`):** `check-types` hängt am `build` derselben App
(`"dependsOn": ["db:generate", "build"]`), `tsc` liest also nur fertige Typen. Belegt: Ein Beobachter auf
`.next/types` sah `routes.d.ts` und `validator.ts` beim Build 0,57 s nach dem Start für 60–70 ms fehlen,
genau das Fenster für `TS2307`. `next-env.d.ts` importiert diese Dateien, deshalb kann `tsc` sie nicht
einfach auslassen. Der Docker-Build (`turbo run build`) enthält `check-types` nicht und bleibt gleich;
Pakete ohne `build` warten auf nichts. Danach fünf ungecachte Läufe grün, zwei davon unter CPU-Last,
ohne messbaren Zeitverlust (10,6–11,1 s gegen vorher 10,8–12,3 s). Der Dev-Server-Fall oben bleibt.

**Vierter Effekt, Turbo-Cache (2026-10-12, Spiegel):** Die Build-Ausgaben `".next/**", "!.next/cache/**"` schlossen
`.next/dev` ein, die Client-Bundles eines laufenden `next dev` (seit Next 16 dort). Ein `pnpm check` mit Cache-Treffer
legte ein altes Abbild davon zurück, auch das Stop-Gate am Ende jedes Turns. Der Dev-Server lieferte danach Start mit
Code von vor einer Änderung in `shot-ui` aus; jeder frische Tab meldete eine Hydrierungswarnung (Server
`?from=start`, Browser `?from=start&scoring=rings`), Neustart half nicht. Belegt: Der Cache-Eintrag (209 MB) enthielt
`apps/spiegel/.next/dev/static/chunks/app/(app)/page.js` mit dem alten Code. **Behoben (`turbo.json`):**
`"!.next/dev/**"` in den Ausgaben von `build`; der Eintrag hat jetzt 18 MB, kein `.next/dev`, `.next/standalone` ist
vollständig. Erkennen: Zeigt der Browser Werte, die nur alter Code liefern kann, zuerst den Text der geladenen Chunks
prüfen; dann Dev-Server stoppen, `.next` räumen, neu starten.

**Sofort-Regel:** Dev-Server vor einem Gate-Lauf stoppen; nach einem abgebrochenen Build erst
`.next` räumen (Server gestoppt), dann Server neu starten. Steht auch in den Skills `/check` und
`/validate`.

**Offen (Empfehlung, nicht umgesetzt):** `next dev` in ein eigenes `distDir` schreiben lassen
(`NEXT_DIST_DIR=.next-dev` über `packages/config/next`, `tsconfig`-`include` und `.gitignore`
nachziehen), dann teilen Gate und Dev-Server kein Verzeichnis mehr und der Fehlermodus ist weg.
Berührt die geteilte Config beider Apps — deshalb eigener Change und User-Entscheid; der
Deploy-Vertrag (`.next/**` in `turbo.json`, `Dockerfile`) bleibt unberührt, weil nur der Dev-Task
die Variable setzt.
