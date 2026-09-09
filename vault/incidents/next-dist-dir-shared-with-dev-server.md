---
id: next-dist-dir-shared-with-dev-server
type: incident
title: "Gate und next dev teilen .next — check-types rot ohne Diff"
keywords: [distDir, .next, NEXT_DIST_DIR, next dev, pnpm check, TS2307, routes.js, validator.ts, Gate rot ohne Diff, Dev-Server, Fast Refresh]
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

**Sofort-Regel:** Dev-Server vor einem Gate-Lauf stoppen; nach einem abgebrochenen Build erst
`.next` räumen (Server gestoppt), dann Server neu starten. Steht auch in den Skills `/check` und
`/validate`.

**Offen (Empfehlung, nicht umgesetzt):** `next dev` in ein eigenes `distDir` schreiben lassen
(`NEXT_DIST_DIR=.next-dev` über `packages/config/next`, `tsconfig`-`include` und `.gitignore`
nachziehen), dann teilen Gate und Dev-Server kein Verzeichnis mehr und der Fehlermodus ist weg.
Berührt die geteilte Config beider Apps — deshalb eigener Change und User-Entscheid; der
Deploy-Vertrag (`.next/**` in `turbo.json`, `Dockerfile`) bleibt unberührt, weil nur der Dev-Task
die Variable setzt.
