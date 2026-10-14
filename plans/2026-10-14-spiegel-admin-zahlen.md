# Spiegel: Zahlen je Konto für den Admin, Hinweistext v2 (P2e)

## Kontext

User, 14. Oktober 2026: „kann ich als admin sehen, wie bei z.b. treffsicher, wie viele scheiben die konten haben? damit
kann ich einschätzen, ohne die daten sehen zu müssen, ob alles funktioniert und wie die softwar genutzt wird“. Danach:
„ja, P2e mit Hinweistext v2 nach dem Merge“.

Heute zeigt die Kontenliste je Konto nur den Stand des Sportpasses. Treffsicher zeigt dem Admin je Konto die Zahl der
Einheiten und Ziele (`getAdminUsers`).

Der Hinweistext v1, dem jeder Schütze zustimmt, sagt: „Deine Scheiben siehst nur du; ein Admin verwaltet Konten und
Anlage, aber nicht deine Schüsse.“ Zahl und Zeitpunkt der letzten Scheibe sind keine Schüsse. Sie sagen aber, wie oft
und wann jemand trainiert. Deshalb gibt es einen neuen Hinweistext v2. Bis zum ersten Deploy gibt es nur Zustimmungen
zum Testen (Dev), also wird niemandem nachträglich etwas zugemutet.

Keine Schemaänderung, keine geschützten Pfade: autonom möglich (ADR-023).

## Entscheidungen

- **D1 Was der Admin je Konto sieht:**
  - die Zahl der Scheiben (sichtbare, ohne Papierkorb und ohne Wartende)
  - Tag der letzten Scheibe (nur das Datum, ohne Uhrzeit)
  - die Zahl der Scheiben, die in „Offen“ warten
  - Keine Ergebnisse, keine Disziplinen, keine Abende, keine Schüsse.
  - Liste, Zeile rechts unter dem Sportpass: „32 Scheiben · zuletzt 13.10.2026“, ohne Scheiben „noch keine Scheibe“,
    mit Wartenden dazu „· 3 warten in Offen“.
- **D2 Übersicht (Station „Konten“):** eine Zeile zur Nutzung, etwa „124 Scheiben, 9 davon in den letzten 30 Tagen; 4
  Konten mit Scheiben in den letzten 30 Tagen“.
  - Gezählt über alle aktiven Konten, nur sichtbare Scheiben, nach dem Beginn der Scheibe.
  - Nur Zustand, keine Aufgabe (D0 aus P2c).
- **D3 Ein Hinweis, wenn etwas nicht stimmt** (Zustand, keine Aufgabe): Hat ein aktives Konto eine aktive Zustimmung,
  die seit mehr als 14 Tagen bestätigt ist, und noch keine einzige Scheibe (auch keine wartende), steht in der Liste
  „noch keine Scheibe seit der Bestätigung“ in `warning`. Damit ist der Fall „Nummer falsch oder Brücke aus“ sichtbar,
  ohne dass jemand Daten ansieht.
- **D4 Hinweistext v2** (`CONSENT_TEXTS.v2`, `CURRENT_CONSENT_VERSION = "v2"`; v1 bleibt unverändert und gilt für
  seine Zeilen):
  - Der zweite Absatz wird zu: „Spiegel betreibt der Verein. Deine Scheiben siehst nur du; ein Admin verwaltet Konten
    und Anlage, aber nicht deine Schüsse. Damit er Fehler erkennt, sieht ein Admin, wie viele Scheiben dein Konto hat
    und wann die letzte kam. Ein Admin bestätigt deine SportpassID einmal, danach legt dir Spiegel die jüngste Scheibe
    zur Bestätigung vor.“
  - Dabei wird „die erste Scheibe“ zu „die jüngste Scheibe“ (seit P2d).
  - Die übrigen Absätze wie v1.
  - Ein Test hält den Hash von v2 fest, wie bei v1.
  - Neue Zustimmungen bekommen v2.
  - Bestehende v1-Zustimmungen (nur Dev) bleiben, kein erneutes Zustimmen. Das Profil zeigt bei einer v1-Zustimmung
    keinen Hinweis; am Konto sieht der Admin „(Hinweis v1)“ wie bisher.
- **D5 Erklärungen und Doku nachziehen:**
  - `ADMIN_HELP.role` und `ADMIN_HELP.accounts` nennen, was der Admin je Konto sieht.
  - Die Rollen-Tabelle in `spiegel-privacy` bekommt beim Vereinsadmin „Zahl der Scheiben und letzte je Konto, keine
    Ergebnisse“.

## Nicht in diesem Plan

- Zahlen je Disziplin oder Zeitraum je Konto: würde Trainingsverhalten zu genau zeigen; nicht verlangt.
- Erneutes Zustimmen bei neuer Version (kommt, wenn eine Version nach dem Deploy wechselt).
- Export.

## Required Docs

- `apps/spiegel/CLAUDE.md` (Privat ist Standard, Admin-Daten prüfen selbst, Zustimmung per Sportpass: Hinweistext
  unveränderlich, neue Version; Kein Knopf ohne Folge)
- `vault/spiegel/spiegel-privacy.md` (Rollen, Hinweistext), `vault/conventions.md` §10

## Dateien

| Datei | Änderung |
| --- | --- |
| `apps/spiegel/src/lib/users/queries.ts` (+ neuer `queries.test.ts`) | T1: `cards`, `lastCardAt`, `waiting`, `quiet` je Konto |
| `apps/spiegel/src/app/(app)/admin/users/page.tsx`, neu `src/components/admin/UserRowFacts.tsx` (+ Markup-Test) | T2: Zeile in der Liste |
| `apps/spiegel/src/lib/admin/overview.ts`, `overview.test.ts`, `AdminOverview.test.tsx` | T3: Zeile zur Nutzung |
| `apps/spiegel/src/lib/consent/texts.ts`, `texts.test.ts`, betroffene Tests mit `version: "v1"` | T4: Hinweistext v2 |
| `apps/spiegel/src/lib/admin/help.ts` (+ Test) | T5 |
| `apps/spiegel/CLAUDE.md`, `vault/spiegel/spiegel-privacy.md` | T6 |

## Aufgaben

1. **T1 Zahlen je Konto** (Test zuerst):
   - `getUsers` liefert je Konto `cards` (sichtbar), `lastCardAt` (Beginn der jüngsten sichtbaren, ISO-Datum) und
     `waiting` (`PENDING_CARD`).
   - Dazu `quiet: boolean` nach D3, mit `nowMs` als Parameter für den Test.
   - Gezählt mit `groupBy` über `Card` (`ownerId`, `_count`, `_max.startedAt`), zwei Abfragen, keine Schleife je Konto.
   - Tests: gelöschte und wartende zählen nicht als Scheibe, wartende als `waiting`; ein fremdes Konto bekommt keine;
     `quiet` nur bei aktiver Zustimmung älter als 14 Tage ohne jede Scheibe.
2. **T2 Liste:** Baustein `UserRowFacts` (Zahlen in Worten, Datum über `@vereinsheim/lib/format` in der Anzeigezone),
   in `UserRow` unter dem Sportpass. Markup-Test: Einzahl und Mehrzahl, „noch keine Scheibe“, Wartende, Hinweis in
   `warning`.
3. **T3 Übersicht:** `overviewModel` bekommt `usage: { cards, recentCards, recentAccounts }`. `adminOverview` zählt
   über aktive Konten. Die Zeile kommt an die Station „Konten“, ohne Scheiben „noch keine Scheibe in Spiegel“. Tests.
4. **T4 Hinweistext v2** nach D4:
   - `CURRENT_CONSENT_VERSION = "v2"`, Hash-Test für v2, v1 unverändert (sein Hash-Test bleibt).
   - Tests, die eine Zustimmung mit `version: "v1"` anlegen, nehmen `CURRENT_CONSENT_VERSION`.
   - Test: v1 lässt sich nicht mehr neu eintragen („Der Hinweis hat sich geändert …“).
5. **T5 Erklärungen:** `ADMIN_HELP.role`: „… aber nie fremde Schüsse; je Konto nur die Zahl der Scheiben und den Tag
   der letzten.“ `ADMIN_HELP.accounts` entsprechend. Test auf den Wortlaut.
6. **T6 Doku:** Scope-Notiz (was der Admin sieht, Hinweistext v2), `spiegel-privacy` (Rollen-Tabelle, Hinweistext v2).

## Testschritte

- `pnpm check` grün nach jedem Task.
- Mutationsprobe: in T1 den Filter `deletedAt: null` beim Zählen streichen → Test rot.
- Browser (Dev-Server :3002, Hintergrund-Tab, eigene Testdaten, Daten des Users nur ansehen):
  - Kontenliste mit Zahlen.
  - Ein Testkonto mit alter Zustimmung ohne Scheiben zeigt den Hinweis.
  - Übersicht mit der Zeile zur Nutzung.
  - Profil eines Testkontos zeigt beim Zustimmen den Text v2.
  - Telefon 375 px, keine Konsolenfehler.

## Verifikation

Validierungsbericht `reports/2026-10-14-spiegel-admin-zahlen.md`, danach `/review` gegen `main`.
