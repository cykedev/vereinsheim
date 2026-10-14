# Spiegel: Texte verständlich, nach dem Textbuch (P2f)

## Kontext

User, 14. Oktober 2026, beim Dialog „Meldungen ‚nicht meine‘ … aufheben?“: „diesen dialog hier verstehe ich überhaupt
nicht“, „wir müssen dringend an der verständlichkeit arbeiten“, „usability ist super wichtig“. Daraus entstand das
Textbuch (Claude Docs, „Textbuch Spiegel“): jeder Text rund um Konten, Sportpassnummern, Brücke, „Offen“, Löschen und
Papierkorb als „Bisher“ und „Neu“, nach sieben Schreibregeln. Die offenen Fragen hat der User an Claude gegeben
(„entscheide du und mach wie es gut ist“). Die Entscheidungen stehen im Textbuch unter „Entscheidungen“, alle Vorschläge
gelten als abgenommen. Lektion: [[spiegel-dialog-texts-not-understood]].

Dieser Plan baut das Textbuch ein. Er übernimmt die offenen Aufgaben von P2e (`plans/2026-10-14-spiegel-admin-zahlen.md`,
T3 bis T6), weil sie dieselben Texte berühren: die Zeile zur Nutzung in der Übersicht, die Erklärung „Rolle“, den
Hinweistext v2 und die Doku. Gleicher Zweig `feat/spiegel-admin-zahlen` (P2e T1 und T2 sind dort schon committet).

Keine Schemaänderung, keine geschützten Pfade: autonom möglich (ADR-023).

## Entscheidungen

- **D1 Quelle des Wortlauts ist das Textbuch.** Jeder „Neu“-Text wird wörtlich übernommen; „(bleibt)“ heißt unverändert.
  Wo das Textbuch ein Beispiel nennt (Max Muster, 12345678, 13.10.2026), wird es zum Platzhalter wie im Code heute.
- **D2 Wörter** (Textbuch „Regeln und Wörter“, „Entscheidungen“): Sportpassnummer statt SportpassID in jedem sichtbaren
  Text. Der Schütze stimmt zu, der Admin bestätigt die Sportpassnummer. Brücke bleibt im Admin. Verbinden und trennen
  statt koppeln und widerrufen. Ranglisten: „Nicht festgelegt · Training · Wettkampf“. Kennungen im Code (`sportpassId`,
  `revokeBridge`, `RankingChoice` „open“) bleiben.
- **D3 Daten in Zuständen nur als Datum**, wo das Textbuch es so zeigt: „aktiv seit 13.10.2026“, „eingetragen am …“,
  „ältere Scheiben geholt am …“ (`formatDateOnly`). Uhrzeiten bleiben dort, wo es um einen Abend geht („Di 13.10.2026 um
  19:12“).
- **D4 Ranglisten-Dialog „Nicht festlegen“** (im Textbuch nicht ausgeschrieben, nach den Regeln): Titel „„X“ nicht
  festlegen?“, Was dann passiert „Ihre Scheiben und neue dieser Rangliste zählen dann so, wie Meyton sie vermerkt. Meist
  ist das Training.“ und „Das angezeigte Ergebnis kann wechseln, wenn sich dadurch die Art ändert.“, Knopf „Nicht
  festlegen“.
- **D5 Leitplanke als Test** (Lektion → ENFORCE): Ein Test erzeugt jeden Dialog aus `consequences.ts` mit Beispielwerten,
  jede Erklärung aus `help.ts`, jeden Zustandstext aus `status.ts`, das Modell der Übersicht und den Hinweistext v2, und
  prüft: kein Semikolon, keines der alten Wörter (SportpassID, Meldung, Ablage, koppeln, Kopplungscode, Rückstau,
  nachladen, nachgeladen, widerrufen außer bei der eigenen Zustimmung, Grabstein, Sperre). Ob ein Text verständlich ist,
  prüft weiter ein Mensch; der Test hält nur fest, dass die alten Fehler nicht zurückkommen.
- **D6 Hinweistext v2** wörtlich aus dem Textbuch, `CURRENT_CONSENT_VERSION = "v2"`, v1 unverändert (eigener Hash-Test
  bleibt). Bestehende v1-Zustimmungen (nur Dev) bleiben, kein erneutes Zustimmen.
- **D7 Zeile zur Nutzung (aus P2e D2)**, nach den Regeln: „124 Scheiben, 9 davon in den letzten 30 Tagen. 4 Konten
  haben in den letzten 30 Tagen geschossen.“, ohne Scheiben „Noch keine Scheibe in Spiegel.“ Gezählt über aktive Konten,
  nur sichtbare Scheiben, nach dem Beginn der Scheibe.

## Nicht in diesem Plan

- Teil 2 des Textbuchs: Texte der Analyse einer Scheibe (Kennzahlen, Hilfe aus `shot-help`).
- Die Prüfung mit einem Vereinsmitglied ohne Vorwissen (Empfehlung an den User).

## Required Docs

- Textbuch „Textbuch Spiegel“ (Claude Docs, Artifact `3fa87b8a-2c69-4b84-82bc-37916220a4b0`): der Wortlaut
- `apps/spiegel/CLAUDE.md` (Kein Knopf ohne Folge, Zustimmung per Sportpass, Hinweistext unveränderlich)
- `vault/conventions.md` §10, `vault/incidents/spiegel-dialog-texts-not-understood.md`
- `plans/2026-10-14-spiegel-admin-zahlen.md` (P2e, T3 bis T6)

## Dateien

| Datei | Änderung |
| --- | --- |
| `apps/spiegel/src/lib/admin/consequences.ts` (+ Test) | T1, T2: Leitplanke, alle Dialoge |
| `apps/spiegel/src/lib/admin/help.ts` (+ Test) | T3 |
| `apps/spiegel/src/lib/admin/overview.ts`, `site.ts`, `overview.test.ts`, `AdminOverview.test.tsx` | T4: Übersicht, zurückgehaltene, Nutzung |
| `apps/spiegel/src/lib/consent/status.ts`, `queries.ts`, `src/lib/users/queries.ts`, `src/components/admin/SportpassSection.tsx`, `UserForm.tsx`, `SiteForms.tsx`, `src/app/(app)/admin/users/page.tsx`, `src/app/(app)/admin/site/page.tsx` (+ Tests) | T5: Admin-Seiten und Zustände |
| `apps/spiegel/src/lib/consent/texts.ts`, `src/components/profile/*`, `src/components/open/OpenScreen.tsx`, `src/lib/open.ts`, `src/lib/trash-view.ts` (+ Tests; Tests mit `version: "v1"`) | T6: Schütze, Hinweistext v2 |
| `apps/spiegel/src/lib/action-guards.ts`, `consent/actions.ts`, `trash-actions.ts`, `first-card-actions.ts`, `admin/site-actions.ts`, `admin/actions.ts`, `users/actions.ts`, `users/rules.ts` (+ Tests) | T7: Fehlermeldungen |
| `apps/spiegel/tools/pruefen.ts`, `apps/spiegel/CLAUDE.md`, `vault/conventions.md`, `vault/spiegel/spiegel-privacy.md`, `reports/…-admin-zahlen-autopilot.md` | T8: Skriptprüfung, Doku |

## Aufgaben

1. **T1 Leitplanke (Test zuerst, rot):** neuer Block „Schreibregeln“ in `consequences.test.ts` nach D5, über alle
   Dialoge mit Beispielwerten (jede Variante: zurückgegeben, deaktiviert, mit Meldungen, jede Art der Rangliste, jede
   Kontoänderung) und über `ADMIN_HELP`. Er schlägt heute fehl (SportpassID, Semikolons, „Meldungen“).
2. **T2 Dialoge:** `consequences.ts` nach dem Textbuch und D4; Wortlaut-Tests nachziehen; T1 wird grün für die Dialoge.
3. **T3 Erklärungen:** `help.ts` nach dem Textbuch („Code für die Brücke“, Rolle mit Zahlen je Konto); Test.
4. **T4 Übersicht:** Aufgaben, Stationen, Meldungen der Brücke, zurückgehaltene (`heldBackText`), Zeilen zu älteren
   Scheiben und Zurückgewiesenen; dazu `usage` nach D7 (aus P2e T3). Tests; die Übersicht kommt in die Leitplanke.
5. **T5 Admin-Seiten:** Zustände (`consentStatusText`, `sportpassSummary`, „ruht, Konto deaktiviert“), Daten nach D3,
   Kontenliste, Konto (Überschrift, Erklärung, Zeile, Knöpfe), Formular-Hinweise, Anlage und Brücke (Einleitung, Zeitzone,
   Verbinden, Zeile der Brücke, Trennen, Ranglisten mit „Nicht festgelegt“). Markup- und Wortlaut-Tests nachziehen.
6. **T6 Schütze:** Hinweistext v2 (D6) mit Hash-Test, Profil (Einleitung, Feld, Zustände, ältere Scheiben), „Offen“
   (Kasten auf Start, Einleitung, „und n weitere unter dieser Nummer“, „Nichts zu prüfen.“), Papierkorb (Abschnitt
   unten). Tests mit `version: "v1"` nehmen `CURRENT_CONSENT_VERSION`; ein Test: v1 lässt sich nicht mehr neu eintragen.
7. **T7 Fehlermeldungen** nach dem Textbuch in allen Actions; die Tests prüfen den neuen Wortlaut.
8. **T8 Skriptprüfung und Doku:** `pruefen.ts` an geänderte Texte anpassen (Dialog „Scheibe löschen“, „Offen“).
   Scope-Notiz (Schreibregeln und Leitplanke, Hinweistext v2, Zahlen je Konto), `conventions.md` §10 (die sieben Regeln
   als Konvention), `spiegel-privacy` (Hinweistext v2, Rollen-Tabelle: Zahl der Scheiben je Konto), P2e-Ledger
   (T3 bis T6 erledigt durch P2f).

## Testschritte

- `pnpm check` grün nach jedem Task.
- Mutationsprobe: ein Semikolon in einen Dialogtext setzen → Leitplanke rot.
- Browser (Dev-Server :3002, Hintergrund-Tab, eigene Testdaten): Dialoge „Sportpassnummer bestätigen“ und „Wieder
  zulassen“, Kontenliste mit Zahlen, Übersicht mit Nutzung, Anlage und Brücke, Profil eines Testkontos mit Hinweistext
  v2; Telefon 375 px, keine Konsolenfehler.
- `pruefen --start` mit dem Demo-Konto (wie bei P2b und P2d; vorher kurz Bescheid geben).

## Verifikation

Validierungsbericht `reports/2026-10-14-spiegel-texte.md`, danach `/review` gegen `main`. Danach Teil 2 des Textbuchs.
