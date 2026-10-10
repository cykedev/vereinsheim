# @vereinsheim/lib — Claude Scope-Notiz

Geteilte **reine Utils + Client-Hooks** für beide Apps (Phase 4 / Zyklus 1, ADR-015/016). Ersetzt die
früher byte-identischen Kopien in `apps/*/src/lib/*` — Drift ist damit **strukturell unmöglich** (die
Module sind nicht mehr im `consistency-check.sh`-Gate).

## Was hier liegt (Subpath-Exports, spiegeln die alten `@/lib/*`-Pfade)

| Export                                          | Datei                                 | Inhalt                             |
| ----------------------------------------------- | ------------------------------------- | ---------------------------------- |
| `@vereinsheim/lib/utils`                        | `src/utils.ts`                        | `cn()` (clsx + tailwind-merge)     |
| `@vereinsheim/lib/forms/fieldErrors`            | `src/forms/fieldErrors.ts`            | `getFieldError`, `getGeneralError` |
| `@vereinsheim/lib/hooks/useUnsavedChangesGuard` | `src/hooks/useUnsavedChangesGuard.ts` | `"use client"`                     |
| `@vereinsheim/lib/hooks/useNavigationConfirm`   | `src/hooks/useNavigationConfirm.ts`   | `"use client"`                     |

## Regeln

- **Just-in-time-Paket**: exportiert **TS-Source direkt** (kein Build-Step); Next transpiliert via
  `transpilePackages` (gesetzt in `@vereinsheim/config/next`). `"use client"` bleibt in den Hook-Dateien.
- **`react` ist peerDependency** — die App liefert die Instanz (keine doppelte React-Instanz → sonst
  Hook-Invariants-Crash). Im Paket nur devDependency für das eigene `tsc`/`vitest`.
- **Kein `"use server"`** (geteilte Dateien dürfen keine Server-Action-Re-Exports sein, monorepo-plan §9).
- **Verhalten/Logik ändert man HIER**, nicht in App-Kopien — sonst entsteht wieder Drift.
- `dateTime` (server-only) seit Juni 2026 ebenfalls geteilt via `@vereinsheim/lib/dateTime` — das Paket setzt dafür `types: ["node", "react"]` + devDeps `@types/node`/`server-only`.
- Nach Änderungen: `pnpm check` (alle 5 Gates über beide Apps) muss grün sein.
- **`format` hält seine Formatter vor** (je Format und Zeitzone ein `Intl.DateTimeFormat`, Zahlen einmal): Einen zu bauen
  kostet rund 70 µs, und Listen formatieren je Zeile (Spiegel, Oktober 2026: Start bei 1.564 Scheiben von 319 auf 70 ms).
  Neue Formate laufen über `dateTimeFormat(…)`, kein `new Intl.…` in einer Funktion.

## Nachtrag (September 2026)

Zusätzlich hier: `format` (isomorphe Anzeige-Formatierung, **ohne** `server-only` — auch für
Client-Komponenten; `dateTime` re-exportiert `formatDateOnly` daraus) sowie der **reine Auth-Kern**:
`auth/validation` (Login-/Passwortregeln) und `auth/rate-limit/{config,limiter,normalization,types}`.
Am Prisma-Client hängende Teile bleiben app-lokal (`auth.ts` mit den NextAuth-Optionen, `auth-helpers.ts`,
`startup.ts`, die Server Actions).

## Nachtrag (Oktober 2026): gemeinsamer Anmeldecode

Was die drei Apps kopiert hatten, liegt hier (nur Server, ohne Prisma und ohne bcrypt):

| Export                                    | Inhalt                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `@vereinsheim/lib/auth/client-ip`         | `extractClientIp(headers, trustProxyHeaders)`: x-real-ip vor x-forwarded-for, Ports, IPv6   |
| `@vereinsheim/lib/auth/credentials`       | `authorizeCredentials(credentials, headers, deps)` mit Zeitausgleich (`TIMING_HASH`)        |
| `@vereinsheim/lib/auth/rate-limit/stores` | `createInMemoryStore`, `createDbStore(table)`, `createStoreForEnv(table, nodeEnv)`          |
| `@vereinsheim/lib/auth/rate-limit/admin`  | Schlüssel prüfen, `loadBlockedLoginBuckets`, `loadLoginRateLimitInsights`, `EMPTY_INSIGHTS` |

- **Die Tabelle kommt als Schnittstelle** (`LoginRateLimitBucketDelegate`): `db.loginRateLimitBucket` aus dem Prisma-Client
  jeder App passt darauf. Braucht der Store eine neue Abfrage, zuerst die Schnittstelle erweitern. Die Tests prüfen gegen
  eine Tabelle im Speicher (`auth/rate-limit/__fixtures__/table.ts`), die Bedingungen, Sortierung und `take` wie Prisma
  auf Postgres auswertet und bei einem unbekannten Feld oder Operator wirft. Dass die Zeile der Bibliothek genau zum
  Schema passt, prüft je App `src/lib/auth-rate-limit/schema.test.ts` in `tsc` (eine Spalte, die das Schema nicht hat,
  sähe die Schnittstelle allein nicht).
- **Abhängigkeiten werden übergeben:** Konto-Suche, Passwortvergleich (bcrypt bleibt in den Apps), Ratenbegrenzung und
  das Vertrauen in Proxy-Header (`AUTH_TRUST_PROXY_HEADERS`). Die NextAuth-Optionen und Callbacks bleiben je App.
- **Zeitausgleich:** Für eine unbekannte oder deaktivierte E-Mail vergleicht `authorizeCredentials` gegen `TIMING_HASH`
  (bcrypt, Kosten 12 wie die echten Hashes), sonst verrät die Antwortzeit, welche Konten es gibt. Einen neuen Hash nur
  mit denselben Kosten erzeugen.
