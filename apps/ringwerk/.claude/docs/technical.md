# Technische Anforderungen – Ringwerk

---

## Zielplattform & Hosting

- Self-hosted auf **TrueNAS SCALE via Docker Compose** – kein Cloud-Dienst
- Portabilität: kein TrueNAS-spezifischer Code; läuft auf jeder Docker-Compose-Umgebung
- Alle umgebungsabhängigen Werte (DB-URL, Secrets) in `.env` – nie hart im Code
- Zugriff über Browser (Chrome, Firefox, Safari), Desktop und Smartphone; keine native App
- **HTTPS in Produktion zwingend** – via Reverse Proxy (Nginx oder Traefik auf TrueNAS)

---

## Tech Stack (verbindlich)

| Bereich           | Technologie              | Version      |
| ----------------- | ------------------------ | ------------ |
| Framework         | Next.js App Router       | 16.x         |
| Runtime           | React                    | 19.x         |
| Sprache           | TypeScript (strict)      | 6.x          |
| Datenbank         | PostgreSQL               | 15.x         |
| ORM               | Prisma                   | 7.x          |
| Authentifizierung | NextAuth.js              | 4.x (stabil) |
| UI-Komponenten    | shadcn/ui + Tailwind CSS | Tailwind 4.x |
| Tests             | Vitest                   | aktuell      |
| Package Manager   | npm                      | –            |
| Container         | Docker + Docker Compose  | –            |
| Node.js           | 20 LTS                   | 20.x         |

---

## Datenhaltung & Persistenz

- PostgreSQL in eigenem Docker Container, persistiert via Named Volume `postgres_data`
- Meyton-PDF-Uploads: Docker Volume `uploads_data`, gemountet als `/app/uploads`
- Erlaubte Upload-Typen: **nur PDF**, max. 10 MB pro Datei
- Dateinamen im Filesystem: serverseitig durch **UUID ersetzt** (kein Originaldateiname)
- Kein Datenverlust durch Container-Neustart oder Image-Updates

---

## Datum & Zeitzone

- Die **Datenbank speichert alle Zeitstempel in UTC** (PostgreSQL-Standard, kein Exceptions)
- Die **Anzeige-Zeitzone** ist konfigurierbar via `DISPLAY_TIME_ZONE` (IANA-Bezeichner, z.B. `Europe/Berlin`)
- Default: `Europe/Berlin`; ungültige Werte fallen auf den Default zurück
- Zentrale Hilfsfunktionen in **`src/lib/dateTime.ts`** (Server-only):
  - `getDisplayTimeZone()` – liest `process.env.DISPLAY_TIME_ZONE`
  - `formatDateOnly(date, tz)` – formatiert als `TT.MM.JJJJ` mit expliziter Zeitzone via `Intl.DateTimeFormat`
- **`toLocaleDateString()` ohne explizite Zeitzone ist verboten** – der Server läuft in UTC (Docker), das würde im Deployment falsche Daten anzeigen
- Datum-Inputs (`<input type="date">`) liefern `YYYY-MM-DD` → werden als UTC-Mitternacht interpretiert (per HTML-Spec korrekt, kein Offset nötig)

---

## Prisma 7 – kritische Abweichungen

| Aspekt                             | Verhalten in Prisma 7                                            |
| ---------------------------------- | ---------------------------------------------------------------- |
| Client-Generierung                 | `src/generated/prisma/` – Import via `@/generated/prisma/client` |
| Kein `url`-Feld in `datasource db` | Stattdessen `prisma.config.ts` im Root für Migrations-CLI        |
| DB-Verbindung im App-Code          | `@prisma/adapter-pg` mit `pg.Pool`                               |

### Datenbankmigrationen

- Tool: **Prisma Migrate**
- `prisma migrate deploy` läuft automatisch beim App-Start (eigener Migrator-Container)
- Neue Migration lokal via `prisma migrate dev`
- Migrationsdateien in `prisma/migrations/` einchecken
- Keine destruktiven Migrationen ohne expliziten Kommentar und Backup-Hinweis

---

## Architektur & Code-Qualität

### Daten- und Aktionsarchitektur

- **Server Actions** statt API Routes für alle Formularaktionen und DB-Operationen
- Validierung via **Zod** (serverseitig in jeder Server Action)
- Formulare nutzen `useActionState` für Fehler-Feedback
- Fachregeln serverseitig erzwungen – nicht nur im UI
- Kein „silent fail": strukturierte `ActionResult`-Rückgaben mit klarem Erfolg-/Fehlersignal
- **Keine userId-Isolation:** alle Fachdaten sind vereinsweit sichtbar; Zugangskontrolle via Rolle (ADMIN/USER)

### Modularität & Dateistruktur

- Dateigrösse < 200 Zeilen; ab > 220 Zeilen **Pflicht-Split**
- `page.tsx` sind dünne Orchestratoren – Fachlogik in `lib/` oder Feature-Module
- Props-Budget: max. 6 Top-Level-Props pro Komponente
- Wiederholte Logik (≥ 2×) → in Helper oder Hook extrahieren
- **Kein direkter Prisma-Aufruf in Komponenten** – ausschliesslich in `lib/*` oder Server Actions

### Sprache & Benennung

| Kontext                                    | Sprache                         |
| ------------------------------------------ | ------------------------------- |
| UI-Texte, Fehlermeldungen, Code-Kommentare | Deutsch                         |
| Komponenten, Funktionen, Dateinamen        | Englisch                        |
| Routen / URL-Segmente                      | Englisch (lowercase-kebab-case) |
| Commit-Messages                            | Englisch                        |
| Dokumentation                              | Deutsch                         |

---

## Authentifizierung & Sicherheit

- Methode: **E-Mail + Passwort** via NextAuth.js v4
- Passwörter: gehasht mit **bcrypt**, niemals im Klartext
- Login-Rate-Limit: In-Memory-Buckets pro E-Mail und pro IP (ausgelegt auf 5–10 gleichzeitige Nutzer)
  - Max. 5 Versuche/E-Mail, 30 Versuche/IP, Fenster 15 Min.
- **Session-Invalidierung** bei Passwortänderung (ältere JWT-Sessions ungültig)
- Passwort-Self-Service: nur eingeloggt + aktuelles Passwort
- Passwort vergessen: nur Admin-Reset, kein E-Mail-Flow
- `NEXTAUTH_SECRET` und DB-Credentials ausschliesslich via Umgebungsvariablen
- **Erstinstallation:** Beim ersten App-Start wird automatisch ein Admin-Account geseeded; E-Mail und Passwort kommen aus `.env` (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`); Seed läuft nur wenn noch kein User existiert

---

## Design & UI

- **Responsiv:** Desktop und Smartphone gleichwertig
- UI-Sprache: **Deutsch**
- Interaktive Elemente durchgängig via shadcn/ui – kein `alert()` / `confirm()`
- Destruktive Aktionen: immer Bestätigungsdialog
- Icon-Buttons ohne Text: `ghost`-Stil (borderlos)
- Listen: gesamte Karte klickbar → öffnet Detailseite (kein separater „Details"-Button)
- Detailseiten: Action-Leiste oben rechts; Reihenfolge: fachliche Aktion → destruktive Aktion → Zurück

---

## Deployment (TrueNAS)

1. App- und Migrator-Image via `docker buildx build` bauen und in Registry pushen
2. `.env`-Datei auf TrueNAS mit allen Secrets ablegen
3. In TrueNAS „Apps → Custom App → Install via YAML": Docker-Compose-YAML mit drei Services:
   - `migrate` (einmalig, Migrations-Container)
   - `app` (Next.js)
   - `db` (PostgreSQL)
4. Update: neues Image-Tag bauen, im YAML ersetzen, speichern (Redeploy)
5. Rollback: auf letztes funktionierendes Tag zurücksetzen

**Backup:** TrueNAS-Volume-Snapshots (`postgres_data` + `uploads_data`) – kein app-seitiger Backup
**Restore-Drill:** regelmässig auf Testsystem prüfen (Snapshot einspielen, Login, Datenkonsistenz)

---

## Nicht-zulässige Abweichungen

- ❌ API-Routes statt Server Actions für Formularaktionen
- ❌ `any`-Typ in TypeScript
- ❌ Direkter Prisma-Import in React-Komponenten
- ❌ Deutsche URL-Segmente oder deutsche Bezeichner für interne Funktionen/Dateinamen
- ❌ Native Browser-Dialoge (`alert`, `confirm`) in App-Flows
