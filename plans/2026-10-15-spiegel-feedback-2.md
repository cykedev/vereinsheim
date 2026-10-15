# Spiegel: eine Sportpassnummer je Konto, getrennte Brücken entfernen

## Kontext

Zwei weitere Rückmeldungen des Users aus dem Test in Produktion (15. Oktober 2026, wörtlich):

1. „es macht wahrscheinlich keinen sinn, mehrere sportpass nummern zu verknüpfen. aktuell ist es so, dass wenn eine
   eingerichtet ist, weiterhin die möglichkeit besteht, eine weitere einzurichten, inkl. consent usw.“
2. „zudem sehe ich noch getrennte brücken, kann sie aber nicht löschen (das trifft auf meine lokale brücke zum
   testimport zu)“

Keine Schemaänderung, keine geschützten Pfade.

## Entscheidungen

- **D1 Eine Sportpassnummer je Konto** (1): Bisher bis zu drei (`MAX_CONSENTS_PER_ACCOUNT = 3`). Das kam aus SF-39
  („Neuer Ausweis, Vereinswechsel“, Plan `plans/2026-10-14-spiegel-optin.md`, vom User freigegeben). **Das ändert diese
  Entscheidung ausdrücklich:** Für einen neuen Ausweis widerruft der Schütze die alte Nummer und trägt die neue ein.
  Die Scheiben bleiben beim Widerruf (Entscheidung des Users vom 14. Oktober 2026), das Nachladen gilt dann für die neue
  Nummer.
  - Grenze 1. Das Formular steht nur ohne Nummer da. Eine wartende, aktive oder abgelehnte Nummer zählt; eine
    abgelehnte entfernt der Schütze („abgelehnte Nummer entfernen“, gibt es schon), dann kommt das Formular wieder.
  - Unter der eingetragenen Nummer ein Satz, wie es bei einem neuen Ausweis geht.
  - Die Action lehnt eine zweite ab, auch wenn das Formular umgangen wird; der Text nennt den Weg.
  - Konten mit mehr als einer Nummer (vor dieser Änderung angelegt) bleiben, wie sie sind; nur Neues ist begrenzt.
- **D2 Getrennte Brücke entfernen** (2): An einer getrennten Brücke steht „Entfernen“ (statt nichts). Vorher fragt
  `DecisionDialog` mit Folgen (`bridgeRemove` in `consequences.ts`). Gelöscht wird nur eine getrennte Brücke, die
  Bedingung steht im Löschbefehl selbst (`revokedAt: { not: null }`). Rohdaten und Codes verweisen mit `ON DELETE SET
  NULL` auf die Brücke: Keine Scheibe und kein Rohdatensatz geht verloren, sie verlieren nur den Namen des Geräts. Eine
  laufende Brücke wird nie entfernt, erst getrennt.
- **D3 Wortlaut** nach „So schreiben wir“ (`vault/conventions.md` §10), erst ins Textbuch, dann in den Code:
  - Profil, unter der Nummer: „Ein Konto hat eine Sportpassnummer. Für einen neuen Ausweis widerrufe die alte Nummer.
    Dann trag die neue ein. Deine Scheiben bleiben.“
  - Fehler der Action: „Du hast schon eine Sportpassnummer. Für eine neue widerrufe erst die alte.“
  - Dialog „Entfernen“: Titel „Getrennte Brücke „Mac (Kopie 9.10.)“ entfernen?“; worum: „Das Gerät „…“ ist getrennt und
    schickt nichts mehr.“; was passiert: „Es verschwindet aus dieser Liste.“; was nicht: „Es wird keine Scheibe
    gelöscht.“, „Was das Gerät geschickt hat, bleibt in Spiegel.“; zurück: „Nicht möglich. Das Gerät lässt sich mit
    einem neuen Code wieder verbinden.“; Knopf „Entfernen“.

## Required Docs

- `apps/spiegel/CLAUDE.md` (Zustimmung per Sportpass, Admin → Anlage und Brücken, Kein Knopf ohne Folge)
- `vault/conventions.md` §10, Textbuch „Textbuch Spiegel“ (Claude Docs)
- `vault/spiegel/spiegel-assignment.md`, `vault/spiegel/spiegel-edge-cases.md` (SF-39)

## Dateien

| Datei | Änderung |
| --- | --- |
| `apps/spiegel/src/lib/consent/status.ts`, `actions.ts` (+ Test) | T2 |
| `apps/spiegel/src/components/profile/SportpassConsents.tsx` (+ Test) | T2 |
| `apps/spiegel/src/lib/ingest/bridges.ts` (+ Test), `src/lib/admin/site-actions.ts` (+ Test) | T3 |
| `apps/spiegel/src/lib/admin/consequences.ts` (+ Test), `src/components/admin/SiteForms.tsx` (+ Test) | T3 |
| `apps/spiegel/CLAUDE.md`, `vault/spiegel/spiegel-assignment.md`, `vault/spiegel/spiegel-edge-cases.md` | T4 |

## Aufgaben

1. **T1 Textbuch:** Abschnitt „Nach Teil 1 geändert: eine Sportpassnummer, Brücke entfernen“ mit den Texten aus D3.
2. **T2 Eine Nummer:** `MAX_CONSENTS_PER_ACCOUNT = 1` mit Kommentar (SF-39 geändert); Fehlertext der Action; Formular nur
   ohne Nummer, darunter der Satz aus D3. Tests: zweite Zustimmung abgelehnt, nichts angelegt (gegen die
   Dev-Datenbank); Markup ohne Formular mit einer Nummer, mit Formular ohne, mit dem Satz.
3. **T3 Brücke entfernen:** `removeBridge(db, bridgeId)` (nur getrennte, `deleteMany` mit Bedingung, gibt zurück, ob
   entfernt); Action `removeBridgeAction` (`requireAdmin`, Fehler „Diese Brücke ist nicht getrennt oder schon
   entfernt.“); `bridgeRemove` in `consequences.ts`; „Entfernen“ an getrennten Brücken in `BridgeItem`. Tests: eine
   laufende bleibt, eine getrennte geht, ihre Rohdaten bleiben mit `bridgeId` null; Wortlaut und `OLD_WORDS`; Markup
   („Entfernen“ nur an getrennten, „Trennen“ nur an laufenden).
4. **T4 Doku:** Scope-Notiz (Grenze 1, Entfernen), `spiegel-assignment` (eine Nummer je Konto), SF-39 im
   Sonderfall-Katalog (Lösung: widerrufen und neu eintragen).

## Testschritte

- `pnpm check` nach jedem Task.
- Mutationsproben: Grenze zurück auf 3 (Test rot); Bedingung `revokedAt` aus dem Löschbefehl genommen (Test rot).
- `pnpm --filter spiegel pruefen --start` mit dem Demo-Konto (`seed:own --demo`, Prüfung, `seed:own` in einem Befehl).
- Browser, Hintergrund-Tab: Profil mit einer Nummer ohne Formular (Telefon 375 px). Admin „Anlage und Brücke“ mit einer
  getrennten Wegwerf-Brücke: „Entfernen“, Dialog, danach weg; die Wegwerf-Brücke wieder löschen.

## Verifikation

Bericht `reports/2026-10-15-spiegel-feedback-2.md`, danach `/review`. Merge durch den User, danach Release und Deploy.
In Produktion kann der User dann die getrennte „Mac (Kopie 9.10.)“ selbst entfernen.
