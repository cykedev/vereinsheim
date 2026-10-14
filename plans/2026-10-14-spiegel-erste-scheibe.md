# Spiegel: erste Scheibe bestätigen und „Offen“ (SP-1.7 a2)

## Kontext

P2 der Bestandsaufnahme vom 14. Oktober 2026; P1 (SP-1.7 a1, `plans/2026-10-14-spiegel-optin.md`) ist gemergt: Der
Schütze stimmt im Profil zu, ein Admin bestätigt. Das Schema für diesen Teil steht schon (`firstCardConfirmedAt`,
`returnedAt`, `Card.ownerPending`), nichts setzt es. Der Hinweistext v1 verspricht: „danach legt dir Spiegel die erste
Scheibe zur Bestätigung vor“; der Review von P1 hat SP-1.9 deshalb an diesen Plan gebunden.

Entscheidungen des Users (14. Oktober 2026): „Nicht meine“ bei der ersten Scheibe → Grabstein, und die Zustimmung geht
zurück an den Admin. Skizze: Das Einlesen setzt `ownerPending`, bis die erste Scheibe bestätigt ist; die Übersichten
blenden ausstehende Scheiben aus; „Offen“ bietet „Ja, meine“ und „Nicht meine“; Scannen kommt aus der Navigation.

Keine Schemaänderung, keine geschützten Pfade: Der Plan kann autonom laufen (ADR-023).

## Entscheidungen

- **D1 Wann eine Scheibe wartet:** Das Einlesen legt eine **neue** Scheibe mit `ownerPending = true` an, wenn die
  Zustimmung, die sie bringt, noch kein `firstCardConfirmedAt` hat. Spätere Stände derselben Scheibe ändern das nicht
  (`writeRevision` setzt `ownerPending` nur beim Anlegen). `consentsOf` in `ingest.ts` liefert dafür je SportpassID
  Konto und ob die erste Scheibe bestätigt ist.
- **D2 Ausstehend heißt unsichtbar:** Eine wartende Scheibe erscheint nirgends außer in „Offen“: nicht auf Start, nicht
  in Liste und Fortschritt, nicht beim Blättern, und ihre Seite gibt es nicht (404, wie eine fremde). Ein gemeinsamer
  Filter `VISIBLE_CARD = { deletedAt: null, ownerPending: false }` in `src/lib/db/reads.ts` ersetzt `deletedAt: null` in
  `familyCards`, `ownerCards`, `latestCardStart`, `cardWithShots` und in den drei Abfragen in `cards.ts` (Wertung, Art,
  Familien mit eigenen Scheiben). `marksOfCards` bleibt beim Konto (es liefert nur Lagen schon gewählter Kennungen) und
  zeichnet die kleinen Scheiben in „Offen“.
- **D3 „Offen“** (`/open`): je SportpassID mit wartenden Scheiben ein Eintrag mit der **ältesten** wartenden Scheibe: Abend
  und Uhrzeit, Stand, Disziplin, Schusszahl, Ergebnis in der Wertung der Scheibe, die kleine Scheibe (`MiniTarget`); dazu
  „und n weitere Scheiben unter dieser SportpassID“, wenn es mehr gibt. Darunter „Ja, meine“ und „Nicht meine“ (mit
  `ConfirmDialog`, destruktiv). Ohne Wartendes der Satz „Nichts offen.“. Start zeigt oben `OpenBox` mit „Erste Scheibe
  bestätigen“ je SportpassID (Link auf `/open`), und `AppFrame` trägt die Zahl am Start-Symbol (`openCount`, heute fest
  0): Das Layout der App zählt die SportpassIDs mit wartenden Scheiben.
- **D4 „Ja, meine“** (`confirmFirstCard(cardId)`, Server Action): nur eine eigene wartende Scheibe. In einer
  Transaktion: `firstCardConfirmedAt` an der Zustimmung (Konto, Anlage der Quelle, SportpassID der Scheibe), wenn es sie
  noch gibt; alle wartenden Scheiben des Kontos mit dieser SportpassID → `ownerPending = false`. Danach
  `revalidatePath("/", "layout")`.
- **D5 „Nicht meine“** (`rejectFirstCard(cardId)`): nur eine eigene wartende Scheibe. In einer Transaktion: alle
  wartenden Scheiben des Kontos mit dieser SportpassID werden **entfernt** und bekommen einen Grabstein (`reason:
  "nicht-meine"`); die Zustimmung geht zurück an den Admin (`returnedAt = now`, `confirmedAt = null`,
  `firstCardConfirmedAt = null`; eine abgelehnte bleibt abgelehnt). Damit lädt die Brücke nichts mehr, bis der Admin
  erneut bestätigt, und die entfernten Scheiben kommen nie wieder ([[spiegel-privacy]]: „ohne Besitzer wird sie gelöscht
  und bekommt einen Grabstein“). Die Wartenden unter derselben Nummer gehören wahrscheinlich derselben fremden Person.
- **D6 Entfernen** (`purgeCards(tx, cardIds, reason)` in `src/lib/db/purge.ts`, die Grundlage für Löschen und Papierkorb):
  je Scheibe Grabstein (Quelle, ScheibenID, Zyklus, Beginn), dann die Scheibe (Kaskade auf Revisionen, Schüsse,
  Projektion, Ausdrucke), dann ihre Rohdaten: `RawSnapshot` derselben Quelle und ScheibenID mit Beobachtung bis 30 Tage um
  den Beginn (`BLOCK_WINDOW_MS`, wie Grabsteine; die ScheibenID kehrt erst nach 49,7 Tagen wieder, SF-77) und danach jede
  `RawRow` dieser Quelle und ScheibenID, auf die kein verbliebener Stand mehr zeigt. Nur Scheiben mit Quelle; eine ohne
  wird abgelehnt (gibt es hier nicht, D1 setzt nur das Einlesen).
- **D7 Scannen aus der Navigation:** `AppFrame` bekommt `scan?: boolean` (Vorgabe `true`); Spiegel setzt `false`, bis der
  QR-Weg kommt (SP-1.7 b). Ohne Scannen hat die untere Leiste vier Felder, die Seitenleiste keinen Knopf. Die Seite
  `/scan` bleibt als Platzhalter erreichbar; `NoCards` erwähnt das Scannen nicht mehr.
- **D8 Bewusst offen:** Kommt während „Ja, meine“ in derselben Sekunde ein neuer Stapel derselben Nummer an, kann eine
  Scheibe wartend bleiben, weil das Einlesen die Zustimmung zu Beginn des Stapels gelesen hat. Sie steht dann noch einmal
  in „Offen“; ein zweites „Ja, meine“ löst sie. Keine Sperre über Einlesen und Bestätigen.
- **D9 Werkzeuge:** `bridge-e2e` und `ingest-load` legen eine eingespielte Zustimmung an (`firstCardConfirmedAt`
  gesetzt), weil sie das Hochladen messen, nicht die erste Bestätigung.

## Nicht in diesem Plan

Löschen einer eigenen Scheibe mit Papierkorb und weicher Sperre (N4, [[spiegel-navigation]] Entscheidung 15; eigener
Plan P2b, nutzt `purgeCards`). „Nicht meine“ an einer schon bestätigten Scheibe (SP-1.7 c). Admin-Zuweisung. QR-Weg.

## Required Docs

- `apps/spiegel/CLAUDE.md` (Übersichten lesen keine Schüsse, Privat ist Standard, Ingest „nichts ohne Zustimmung“,
  Tests gegen die Dev-Datenbank, Skriptprüfung)
- `vault/spiegel/spiegel-assignment.md` (Opt-in, erste Scheibe, „Nicht meine“), `vault/spiegel/spiegel-navigation.md`
  (Offen, Start, Entscheidung 8 und 16), `vault/spiegel/spiegel-privacy.md`
- `vault/conventions.md` §2, §9 („Prüfen und Löschen gehören in dieselbe Transaktion“), §10
- `packages/shot-ui/CLAUDE.md` (Bausteine mit Markup-Tests)

## Dateien

| Datei | Änderung |
| --- | --- |
| `apps/spiegel/src/lib/ingest/ingest.ts` (+ Test) | D1 |
| `apps/spiegel/src/lib/db/cards.ts` (+ Test) | `RevisionInput.card.ownerPending` beim Anlegen; `VISIBLE_CARD` in drei Abfragen |
| `apps/spiegel/src/lib/db/reads.ts` (+ Test) | `VISIBLE_CARD`; `pendingFirstCards(db, ownerId)`, `pendingCount(db, ownerId)` |
| `apps/spiegel/src/lib/db/purge.ts` (neu, + Test) | D6 |
| `apps/spiegel/src/lib/first-card-actions.ts` (neu, + Test) | D4, D5 |
| `apps/spiegel/src/app/(app)/open/page.tsx`, `src/components/open/OpenScreen.tsx` (neu, + Markup-Test) | D3 |
| `apps/spiegel/src/app/(app)/page.tsx`, `src/components/start/StartScreen.tsx`, `src/lib/overview.ts` | `OpenBox` auf Start |
| `apps/spiegel/src/app/(app)/layout.tsx`, `src/components/shell/AppShell.tsx`, `NoCards.tsx` | `openCount`, `scan={false}` |
| `packages/shot-ui/src/layout/AppFrame.tsx` (+ Test) | D7 |
| `apps/spiegel/tools/bridge-e2e.ts`, `tools/ingest-load.ts` | D9 |
| `apps/spiegel/tools/pruefen.ts` | Prüfung „Offen“ und Leiste ohne Scannen |
| Vault-Notes, `apps/spiegel/CLAUDE.md` | T9 |

## Aufgaben

**T1 Einlesen setzt `ownerPending`** (`ingest.ts`, `cards.ts`)
- `consentsOf` → `Map<string, { userId: string; firstConfirmed: boolean }>`; der Adapter-Aufruf reicht
  `ownerPending: !firstConfirmed` an `writeRevision`, das ihn nur in `card.create` schreibt.
- Tests (`ingest.test.ts`): Zustimmung ohne `firstCardConfirmedAt` → neue Scheibe wartet; ein späterer Stand derselben
  Scheibe nach dem Setzen von `firstCardConfirmedAt` ändert `ownerPending` nicht; mit gesetztem → wartet nicht. Die
  bestehenden Fixtures legen ihre Zustimmung mit `firstCardConfirmedAt` an (sie testen das Einlesen, nicht die erste
  Bestätigung). Gegenprobe: `ownerPending` im Update mitschreiben → der Test „späterer Stand“ wird rot.

**T2 Sichtbarkeit** (`reads.ts`, `cards.ts`)
- `export const VISIBLE_CARD = { deletedAt: null, ownerPending: false } as const`, an allen sieben Stellen aus D2.
- `pendingFirstCards(db, ownerId)`: je SportpassID die älteste wartende Scheibe als `OverviewCard` plus `more: number`;
  `pendingCount(db, ownerId)`: Zahl der SportpassIDs mit Wartenden (für das Start-Symbol).
- Tests (`reads.test.ts`): eine wartende Scheibe fehlt in `familyCards`, `ownerCards`, `latestCardStart`,
  `cardWithShots`; `pendingFirstCards` liefert die älteste je Nummer mit `more`; Gegenprobe: `VISIBLE_CARD` ohne
  `ownerPending` → mindestens ein Test rot.

**T3 Entfernen** (`purge.ts` + Test gegen die Dev-Datenbank)
- D6, in der übergebenen Transaktion. Tests: nach `purgeCards` gibt es Scheibe, Revisionen, Schüsse, Projektion,
  Stände und Zeilen dieser Scheibe nicht mehr, ein Grabstein steht (`reason`); Stände und Zeilen **derselben
  ScheibenID 60 Tage später** (anderer Zyklus) bleiben; eine Zeile, die ein verbliebener Stand braucht, bleibt.
  Danach verwirft das Einlesen denselben Stand als `blocked`. Gegenprobe: Zeitfenster weglassen → der Test „anderer
  Zyklus“ wird rot.

**T4 Actions** (`first-card-actions.ts` + Test; Sitzung über `shooterId()`, `ActionResult`, nie werfen)
- D4, D5. Tests: „Ja, meine“ macht alle Wartenden der Nummer sichtbar und setzt `firstCardConfirmedAt`; eine fremde oder
  nicht wartende Scheibe → „Die Scheibe gibt es nicht.“, nichts geändert; „Nicht meine“ entfernt alle Wartenden der
  Nummer, setzt Grabsteine, die Zustimmung ist `returned` und fehlt in `GET /state`; eine abgelehnte Zustimmung bleibt
  abgelehnt; Scheiben derselben Nummer, die schon bestätigt sind, bleiben unberührt; `mustChangePassword` → Fehler.
  Gegenprobe: Bedingung `ownerId` weglassen → der Test „fremde Scheibe“ wird rot.

**T5 Navigation ohne Scannen** (`AppFrame.tsx` + Test, `AppShell.tsx`, `NoCards.tsx`)
- D7. Markup-Test in shot-ui: mit `scan={false}` kein Link auf den Bereich `scan`, die untere Leiste hat vier Spalten
  (`grid-cols-4`); ohne Angabe wie bisher.

**T6 „Offen“ und Start** (`open/page.tsx`, `OpenScreen.tsx`, Start, Layout)
- D3. Das Layout ruft `pendingCount` und reicht `openCount` an `AppShell`. Start reicht `OpenItem[]` an `StartScreen`
  (über `OpenBox`). `OpenScreen` ist eine Client-Komponente mit den beiden Actions, Fehler als Text, danach
  `router.refresh()`. Markup-Test: Datum, Stand, Disziplin, „und 2 weitere“, beide Knöpfe; ohne Wartendes der Satz.

**T7 Werkzeuge** (`bridge-e2e.ts`, `ingest-load.ts`): D9. `pnpm --filter spiegel bridge-e2e` grün.

**T8 Prüfung**
- Browser (Dev-Server :3002, Demo-Konto): Zustimmung und erste Scheibe von Hand vorbereitet (Zeile mit `confirmedAt`
  und zwei Scheiben mit `ownerPending` über `seed:own --demo` + SQL); Start zeigt „Offen 1“, das Symbol trägt 1, „Offen“
  zeigt die älteste mit „und 1 weitere“; „Ja, meine“ → beide in der Liste, Offen leer, Zahl weg. Zweiter Durchgang:
  „Nicht meine“ → beide weg, Zustimmung im Admin „zurück beim Admin“. Telefon und Desktop, keine Konsolenfehler,
  Leiste mit vier Feldern. Danach alles zurück (`seed:own`).
- `pnpm --filter spiegel pruefen --start` grün, mit neuer Prüfung: ohne Wartendes sagt „Offen“ „Nichts offen.“, die
  untere Leiste hat keinen Scan-Knopf.

**T9 Doku**
- `spiegel-assignment` (erste Scheibe gebaut, D3–D5), `spiegel-navigation` (Offen gebaut, Scannen bis SP-1.7 b
  ausgeblendet), `spiegel-privacy` (Entfernen bei „Nicht meine“: Scheibe, Rohdaten, Grabstein), `spiegel-db-schema`
  (`purgeCards`), `spiegel-roadmap` (SP-1.7 a erledigt; N6 in SP-1.8), `apps/spiegel/CLAUDE.md` (Regel `VISIBLE_CARD`:
  jede neue Abfrage über Scheiben nimmt ihn). `/sync-graph`.

## Verifikation

- `pnpm check` grün; Spiegel ohne Cache grün.
- Tests und Gegenproben aus T1–T4.
- `bridge-e2e` grün, `pruefen --start` grün.
- Browser wie T8; was die Daten nicht hergeben, steht im Bericht als „nicht belegt“.
