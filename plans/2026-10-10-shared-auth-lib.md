# Gemeinsamer Anmeldecode in `@vereinsheim/lib`

## Kontext

Das Review von Spiegel (10. Oktober 2026) fand den Anmeldecode in drei Apps fast gleich kopiert: Auswertung der
IP-Header für die Ratenbegrenzung (`auth.ts`, rund 100 Zeilen), der Store der Ratenbegrenzung (`auth-rate-limit/store.ts`,
183 bis 204 Zeilen, Unterschied nur Formatierung und Kommentare), die Admin-Auswertung der Sperren (`admin/actions.ts`
bzw. Treffsichers `admin/actions/shared.ts` + `loginRateLimit.ts`) und der Ablauf von `authorize()`. Spiegel hat dabei
eine Verbesserung, die Ringwerk und Treffsicher fehlt: Eine unbekannte oder deaktivierte E-Mail kostet so viel Zeit wie
eine bekannte (bcrypt gegen einen festen Hash), sonst verrät die Antwortzeit, welche Konten es gibt. Der User hat die
Aufgabe am 10. Oktober 2026 angestoßen („Move shared auth code into @vereinsheim/lib“).

Geprüft vor dem Plan: Ringwerk und Treffsicher folgen nach der Anmeldung keiner `callbackUrl` (beide `router.push("/")`),
die Umleitungslücke aus Spiegel betrifft sie nicht. Ein Typversuch zeigt: `db.loginRateLimitBucket` aus dem generierten
Prisma-Client passt auf eine schlichte Schnittstelle mit den fünf benutzten Methoden; die Bibliothek braucht kein Prisma.

## Ansatz

- **Neu in `@vereinsheim/lib`** (nur Server, keine App-Abhängigkeit, kein Prisma, kein bcrypt):
  - `auth/client-ip`: `extractClientIp(headers, trustProxyHeaders)` (x-real-ip vor x-forwarded-for, Ports und
    IPv6-Klammern, Längengrenze), wie heute in `auth.ts`.
  - `auth/rate-limit/stores`: `LoginRateLimitBucketDelegate` (Schnittstelle der Tabelle), `createInMemoryStore()`,
    `createDbStore(delegate)`, `createStoreForEnv(delegate, nodeEnv)`; `LOGIN_BUCKET_SELECT`.
  - `auth/rate-limit/admin`: `parseLoginRateLimitKey`, `isLoginRateLimitKey`, `toAdminBucket`,
    `loadLoginRateLimitInsights(delegate, now)`, `loadBlockedLoginBuckets(delegate, now)`.
  - `auth/credentials`: `authorizeCredentials(input, deps)` mit Ratenbegrenzung, Konto-Suche und Passwortvergleich als
    Abhängigkeiten (bcrypt bleibt in den Apps), inklusive Zeitausgleich (`TIMING_HASH`).
- **In den Apps bleibt**, was app-spezifisch ist oder bleiben muss: NextAuth-Optionen und Callbacks, Server Actions
  (eine geteilte Datei darf keine Server Action re-exportieren, Konventionen §1), `AdminLoginRateLimitTable.tsx`
  (im Drift-Gate), Rollen und Sitzungsprüfung.
- **Verhalten:** gleich, außer dem Zeitausgleich in Ringwerk und Treffsicher. Meldungen bleiben wörtlich
  („Ungültiger Rate-Limit-Schlüssel.“).

## Aufgaben

1. `auth/client-ip` mit Tests (alle Fälle der heutigen Funktion).
2. `auth/rate-limit/stores` mit Tests: Speicher-Store wie heute, Datenbank-Store gegen eine Tabelle im Speicher, die die
   Schnittstelle erfüllt (Umrechnung Datum ↔ ms, `blockedUntil` 0 ↔ null, `deleteExpired` lässt aktive Sperren).
3. `auth/rate-limit/admin` mit Tests (Schlüssel, Abbildung, Auswertung).
4. `auth/credentials` mit Tests (gesperrt, unbekannt mit Vergleich gegen den festen Hash, deaktiviert, falsch, richtig).
5. Spiegel übernimmt: `auth.ts`, `auth-rate-limit/index.ts`, `admin/actions.ts`; `auth-rate-limit/store.ts` entfällt,
   der Test gegen die Dev-Datenbank bleibt und nutzt `createDbStore(db.loginRateLimitBucket)`.
6. Ringwerk übernimmt dasselbe (mit Zeitausgleich).
7. Treffsicher übernimmt: `auth.ts`, `auth-rate-limit.ts`, `admin/actions/shared.ts` und `loginRateLimit.ts`;
   `auth-rate-limit/store.ts` entfällt, `store.test.ts` prüft den Store aus der Bibliothek.
8. Doku: `vault/conventions.md` §1 (geteilt über `@vereinsheim/lib`), Architekturkarte.

## Dateien

- `packages/lib/package.json` (Exporte), `packages/lib/src/auth/{client-ip,credentials}.ts`,
  `packages/lib/src/auth/rate-limit/{stores,admin}.ts` und Tests
- `apps/{ringwerk,treffsicher,spiegel}/src/lib/auth.ts`, Ratenbegrenzung, Admin-Aktionen (siehe Aufgaben)
- `vault/conventions.md`, `vault/architecture/architecture.md`

## Required Docs

- `vault/conventions.md` §1 und §9, `vault/apps/ringwerk/ringwerk-auth-security.md`, `packages/lib` (vorhandene
  `auth/*`-Module und Tests)

## Tests

- Bibliothek: je Modul eine Testdatei, Fälle wie oben.
- Apps: alle bestehenden Tests bleiben grün (Ringwerk `users/actions.test.ts`, Treffsicher `auth-rate-limit.test.ts`,
  `admin/actions.test.ts`, Spiegel `auth-rate-limit/store.test.ts` gegen die Dev-Datenbank).

## Verifikation

- `pnpm check` grün (alle Apps bauen).
- `scripts/consistency-check.sh` grün (Drift-Gate).
- Anmeldung im Browser in Spiegel (Demo-Konto) und Ringwerk-Start ohne Fehler.
