# Spiegel bewohnbar: Anmeldung, eigene Scheiben, erste Seiten

## Kontext

Der User (10. Oktober 2026), nach SP-1.6 a Teil 1: „sag mir wie ich in die Anwendung komme“ und auf den Vorschlag
„Anmeldung, deine echten Scheiben in der Datenbank, erste echte Seiten“: „ja, leg los“. Heute zeigt `apps/spiegel` nur
einen Platzhalter; Datenbank, Zugriffe und Projektion stehen ([[spiegel-db-schema]], ADR-031). Die Oberfläche gibt es
fertig als Bausteine in `packages/shot-ui`, erprobt im Labor mit einem Router im Speicher.

Ziel: Der User startet `pnpm dev --filter spiegel`, meldet sich an und sieht seine eigenen Abende, die Liste seiner
Scheiben und jede Scheibe mit Analyse, aus der Datenbank. Umfang: SP-1.6 a Teil 2 (Anmeldung, Admin,
Ratenbegrenzung, Speicher) und aus SP-1.8 der Schritt N7 für Start, Liste und Scheibe.

## Entscheidungen

- **Anmeldung wie Ringwerk** (NextAuth v4, Credentials, JWT, `sessionVersion`, `proxy.ts`, Ratenbegrenzung aus
  `@vereinsheim/lib/auth/*`, Admin-Tabelle aus `@vereinsheim/ui/admin/*`), Rollen nur ADMIN und USER, keine
  Selbstregistrierung, Seed-Admin aus `SEED_ADMIN_*` beim Start. **Privat ist Standard** ([[spiegel-privacy]]): jeder
  Zugriff filtert nach dem angemeldeten Schützen, auch für Admins (Admin verwaltet Konten, sieht keine fremden Schüsse).
  Ohne Audit-Log (kommt mit der Zuordnung, SP-1.7).
- **Übergang bis SP-1.8 (ADR-031, Folgen):** Die Modelle in `shot-ui` (Start, Liste) rechnen aus Schüssen, und die
  kleinen Scheiben der Liste brauchen Lagen. Start und Liste laden deshalb vorerst die Schüsse der Familie
  (`familyCardsWithShots`); für die 32 Scheiben des Users sind das Millisekunden. Die Umstellung auf `ProjectedCard`
  samt kompakter Lagen für die kleinen Scheiben bleibt SP-1.8. `familyCards` (Projektion) bleibt der Weg für
  Fortschritt und alle späteren Übersichten.
- **Familie mit Kennung:** `Family.slug` (`FamilyId` aus shot-core, etwa `lp-freihand`, steht in der Adresse) und
  `Family.name` (Anzeige, „Luftpistole“). Bezeichnungen in `apps/spiegel/src/lib/families.ts`.
- **Eigene Scheiben nur in der Dev-Datenbank:** Werkzeug `pnpm --filter spiegel seed:own` schreibt die echten Scheiben
  des Users (`tools/labor/src/ownCards.ts`, über einen Export `@vereinsheim/labor/own-cards`) dem Seed-Admin zu, wie im
  Labor gefiltert (ohne Scheibenbild, verdeckte Wertung) und mit Vollständigkeit aus dem Fachkern. Nie in Produktion;
  dort kommen Daten über die Brücke.
- **Schema nach der Regel „eine Migration bis zum ersten Deploy“:** `init` neu erzeugt; die Dev-Datenbank ziehe ich mit
  `prisma db push` nach (nicht destruktiv, Weg aus `bootstrap-dev.sh`), den Verlauf gleicht der User mit dem Reset an.
- **Darstellung:** Design 2 mit System/Hell/Dunkel (Klasse `dark` an `<html>`, Skript vor dem ersten Zeichnen, Wahl in
  Profil wie im Labor), Schriften Archivo/Geist/Geist Mono über `next/font` (selbst gehostet, keine Anfrage an Google
  beim Laden).
- **Seiten als Server-Komponente plus Client-Hülle:** Der Server liest Sitzung und Daten und reicht serialisierbare
  Daten weiter; die Hülle baut Routen und Rückrufe (Funktionen dürfen nicht vom Server zum Client).

## Aufgaben

1. **Grundlage:** `package.json` (next-auth, bcryptjs, zod, `@vereinsheim/lib`, `@vereinsheim/shot-ui`,
   `@vereinsheim/shot-help`, lucide-react; dev: `@vereinsheim/labor`), `transpilePackages` um shot-ui und shot-help,
   `globals.css` mit `@source` für shot-ui und den Schriften, `.env.example` mit `NEXTAUTH_*`, `SEED_ADMIN_*`, `AUTH_*`.
2. **Schema:** `User` + `passwordHash`, `sessionVersion`, `isActive`; `LoginRateLimitBucket` wie Ringwerk;
   `Family.slug` eindeutig. `init` neu, Gegenprobe in einem Wegwerf-Postgres, Dev-Datenbank per `db push`, Fixtures
   angepasst.
3. **Anmeldung:** `lib/auth.ts`, `lib/auth-helpers.ts` (`getAuthSession`, `requireUser` mit Umleitung), Ratenbegrenzung
   (`lib/auth-rate-limit`), `proxy.ts` (alles außer `/login`, `/api/auth`, statische Dateien), Route
   `api/auth/[...nextauth]`, `types/next-auth.d.ts`, `lib/startup.ts` (Seed-Admin), Seite `/login` in Design 2.
   Tests: Seed-Admin einmalig, Sitzung ungültig nach `sessionVersion`/deaktiviert, Ratenbegrenzung über den Store.
4. **Admin:** `/admin/users` (Liste, Ratenbegrenzung), `/admin/users/new`, `/admin/users/[id]` (Name, Rolle,
   vorläufiges Passwort, aktiv); Aktionen mit `ActionResult`, Schutz vor Selbst-Deaktivierung und letztem Admin; Tests.
5. **Eigene Scheiben:** `tools/own-cards.ts` (reine Umwandlung `OwnCard` → `RevisionInput` samt Disziplin und Familie)
   mit Test (32 Scheiben, die drei weggelassenen, Werte gleich Meyton, keine Kennungen), `tools/seed-own.ts`
   (idempotent: Anlage „Dev-Anlage“, Quelle, Familien, Disziplinen, Schreiben per `writeRevision`).
6. **Lesen für die Seiten:** `familyCardsWithShots` (Übergang), `ownerFamilies` (Familien mit Scheiben, neueste zuerst),
   `cardWithShots` um Scheibenbild und Familie erweitert; Tests.
7. **App-Rahmen:** Gruppe `(app)` mit Anmeldepflicht, Client-Hülle `AppShell` (`RouteLinkProvider` mit `next/link`
   und `router.push`, `AppFrame`, Blatt der Hilfe); `<main>` raus aus dem Root-Layout; Darstellung vor dem Zeichnen.
8. **Start** (`/`): `startModel` über die Scheiben des Users, `EveningBlock`, `FormLine`; „Offen“ leer.
9. **Scheiben** (`/cards`): `cardListModel`, `ListHeader`, `ListControls` (Abfrage in die Adresse), `EveningList`.
10. **Scheibe** (`/cards/[id]`): die Seite einer Scheibe aus dem Labor (`CardView`) ohne Labor-Werkzeuge, mit Rückweg
    und Blättern im Kontext der Herkunft.
11. **Profil** (`/profile`): Konto, Darstellung, Abmelden; Platzhalter für Fortschritt, Scannen, Offen.
12. **Abschluss:** Speicher des Servers (`next build`, Standalone, RSS nach Aufrufen) unter 256 MB; Doku: Roadmap
    (SP-1.6 a Teil 2, N7 teilweise), [[spiegel-db-schema]], `apps/spiegel/CLAUDE.md`, Architekturkarte.

## Dateien

- `apps/spiegel/**` (package.json, next.config.ts, `.env.example`, prisma, `src/app/**`, `src/lib/**`,
  `src/components/**`, `src/types/next-auth.d.ts`, `src/proxy.ts`, `tools/own-cards.ts`, `tools/seed-own.ts`, Tests)
- `tools/labor/package.json` (Export `./own-cards`)
- `pnpm-lock.yaml`
- Vault: `spiegel-roadmap.md`, `spiegel-db-schema.md`, `architecture.md`; `apps/spiegel/CLAUDE.md`

## Required Docs

- `vault/conventions.md` (§2 Komponenten, §3 Layout, §6 Formatierung, §10 Design 2), `packages/shot-ui/CLAUDE.md`
  (Rahmen und Links), `vault/apps/ringwerk/ringwerk-auth-security.md`, `vault/spiegel/spiegel-privacy.md`,
  `vault/spiegel/spiegel-navigation.md`, `apps/spiegel/CLAUDE.md`

## Tests

- Anmeldung: Seed-Admin wird einmal angelegt; `getAuthSession` liefert null bei deaktiviertem Konto und bei anderer
  `sessionVersion`; Ratenbegrenzung sperrt nach fünf Fehlversuchen je E-Mail.
- Admin: Anlegen (Validierung, doppelte E-Mail), letzter Admin nicht herabstufbar, eigenes Konto nicht deaktivierbar,
  vorläufiges Passwort erhöht `sessionVersion`; Nicht-Admin bekommt „Keine Berechtigung“.
- Eigene Scheiben: 32 Scheiben (30 LP, 2 LG), drei weggelassen mit Grund; jeder Wert gleich Meytons; Seed zweimal
  ergibt keine neue Revision.
- Lesen: `familyCardsWithShots` nur eigene, nicht gelöschte Scheiben der Familie mit Schüssen; `ownerFamilies` in der
  Folge der neuesten Scheibe.
- Seiten: im Browser (Preview) mit den eigenen Scheiben: Anmelden, Start, Liste mit Filter, Scheibe mit Analyse,
  Blättern, Abmelden; Telefonbreite.

## Verifikation

- `pnpm check` grün.
- Preview: Ablauf wie oben, keine Konsolenfehler; Screenshots.
- Speicher unter 256 MB, im Bericht.
- `vault-lint` gültig.
