# @vereinsheim/lib — Claude Scope-Notiz

Geteilte **reine Utils, Client-Hooks, Formatierung und der Anmelde-Kern** für alle drei Apps (ADR-015/016).
Jedes Modul gibt es nur einmal; Drift ist damit **strukturell unmöglich**, `consistency-check.sh` prüft sie
deshalb nicht.

## Was hier liegt (Subpath-Exports)

| Export                                          | Datei                                 | Inhalt                                                                                           |
| ----------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `@vereinsheim/lib/utils`                        | `src/utils.ts`                        | `cn()` (clsx + tailwind-merge)                                                                   |
| `@vereinsheim/lib/forms/fieldErrors`            | `src/forms/fieldErrors.ts`            | `getFieldError`, `getGeneralError`                                                               |
| `@vereinsheim/lib/hooks/useUnsavedChangesGuard` | `src/hooks/useUnsavedChangesGuard.ts` | `"use client"`                                                                                   |
| `@vereinsheim/lib/hooks/useNavigationConfirm`   | `src/hooks/useNavigationConfirm.ts`   | `"use client"`                                                                                   |
| `@vereinsheim/lib/format`                       | `src/format.ts`                       | isomorphe Anzeige-Formatierung, **ohne** `server-only` (auch für Client-Komponenten)             |
| `@vereinsheim/lib/dateTime`                     | `src/dateTime.ts`                     | server-only: Anzeige-Zeitzone (`DISPLAY_TIME_ZONE`), re-exportiert `formatDateOnly` aus `format` |
| `@vereinsheim/lib/auth/validation`              | `src/auth/validation.ts`              | Login- und Passwortregeln                                                                        |
| `@vereinsheim/lib/auth/rate-limit/*`            | `src/auth/rate-limit/`                | `config`, `limiter`, `normalization`, `types`, `adminTypes`, dazu `stores` und `admin` (unten)   |

Am Prisma-Client hängende Teile bleiben app-lokal (`auth.ts` mit den NextAuth-Optionen, `auth-helpers.ts`,
`startup.ts`, die Server Actions).

## Regeln

- **Just-in-time-Paket**: exportiert **TS-Source direkt** (kein Build-Step); Next transpiliert via
  `transpilePackages` (gesetzt in `@vereinsheim/config/next`). `"use client"` bleibt in den Hook-Dateien.
- **`react` ist peerDependency** — die App liefert die Instanz (keine doppelte React-Instanz → sonst
  Hook-Invariants-Crash). Im Paket nur devDependency für das eigene `tsc`/`vitest`.
- **Kein `"use server"`** (geteilte Dateien dürfen keine Server-Action-Re-Exports sein, `vault/monorepo/monorepo.md`).
- **Verhalten/Logik ändert man HIER**, nicht in App-Kopien — sonst entsteht wieder Drift.
- `dateTime` ist server-only — das Paket setzt dafür `types: ["node", "react"]` + devDeps `@types/node`/`server-only`.
- Nach Änderungen: `pnpm check` (alle 5 Gates über alle Apps und Pakete) muss grün sein.
- **`format` hält seine Formatter vor** (je Format und Zeitzone ein `Intl.DateTimeFormat`, Zahlen einmal): Einen zu bauen
  kostet rund 70 µs, und Listen formatieren je Zeile (gemessen in Spiegel: Start bei 1.564 Scheiben 70 statt 319 ms).
  Neue Formate laufen über `dateTimeFormat(…)`, kein `new Intl.…` in einer Funktion.

## Gemeinsamer Anmeldecode

Der Anmeldecode der drei Apps (nur Server, ohne Prisma und ohne bcrypt):

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
