# Spiegel: Scheibe per ID holen

## Context

Der User (24. Oktober 2026): „ich will die Möglichkeit haben, eine bekannte Scheiben-ID ‚zu mir‘ zu importieren.“ Die
ID steht im Fuß jedes Meyton-Ausdrucks (`ID: ff914420`, die ScheibenID als vorzeichenbehaftete 32-Bit-Zahl, belegt am
9. Oktober 2026, [[meyton-printout]]). Heute kommt eine Scheibe nur über das Opt-in per Sportpass zu Spiegel; ohne
Sportpassnummer am Stand (frei getippter Name, Training ohne Starter, Gast) bleibt sie im Schützenhaus. Der geplante
QR-Weg (SP-1.7 b, [[adr-028]]) braucht Scannen, PDF-Speicher und die Aufträge der Brücke mit Vorschau; das ist offen.
Dieser Plan baut den Kern davon, ohne QR und ohne PDF: Die ID wird eingetippt, die Brücke holt genau diese Scheibe.

Die Brücke kennt schon einen Auftrag über `GET /state` und den Heartbeat: das Nachladen der Historie (`history`,
`historyDone`). Der Import folgt demselben Muster, additiv im Vertrag.

## Approach

- **D1 Auftrag statt Vorschau:** Der Schütze nennt ID und Tag. Spiegel legt einen Auftrag an (`CardRequest`), nennt ihn
  der Brücke im Zustand (`requests`), die Brücke liest diese ScheibenID beim nächsten Durchgang und schickt sie, auch
  ohne Zustimmung per Sportpass. Verdeckte Wertung und gesperrte Scheiben bleiben wie immer im Schützenhaus. Die Vorschau
  vor dem Holen (SF-41) kommt mit dem QR-Weg; hier schützt der Tag (D2).
- **D2 Der Tag schützt vor Tippfehlern:** Die ScheibenID ist ein Zähler in Millisekunden; ein Tippfehler in den
  vorderen Stellen trifft eine Scheibe an einem anderen Tag oder keine. Spiegel nimmt den Stand deshalb nur an, wenn der
  Beginn der Scheibe auf den genannten Tag fällt (Abend wie überall: vor 4 Uhr zählt zum Vortag, Zone der Anlage). Sonst
  verwirft das Einlesen ihn, bevor etwas gespeichert wird („Nichts ohne Zustimmung speichern“), und der Auftrag endet mit
  „an diesem Tag nicht gefunden“. Ein Tippfehler in den hinteren Stellen kann die Scheibe eines anderen am selben Abend
  treffen. Dagegen hilft der Tag nicht; die Scheibe steht dann im Konto, und „Löschen“ gibt sie samt Sperre zurück.
  Offener Punkt für den User: ob vor dem Holen eine Vorschau nötig ist (wie beim QR-Weg geplant, SF-41).
- **D3 Wem die Scheibe gehört:** dem Auftraggeber, ohne „Offen“ (er hat sie ausdrücklich geholt). Hat die Scheibe eine
  Sportpassnummer mit aktiver Zustimmung eines anderen Kontos, gewinnt die Zustimmung; der Auftrag endet mit „gehört
  einem anderen Konto“. Liegt die Scheibe schon in Spiegel: beim Auftraggeber → sofort erledigt mit Link; bei einem
  anderen → abgelehnt, ohne zu sagen, wem.
- **D4 Nach dem Holen:** Der Auftrag ist erledigt, die Brücke liest die Scheibe danach nicht mehr von sich aus. Eine
  spätere Korrektur der Standaufsicht kommt nur über eine Zustimmung per Sportpass. Steht so im Vault.
- **D5 Vertrag additiv** (API v1): Zustand `requests: [{ id, scheibenId }]` (optional, höchstens 1.000), Heartbeat
  `requestsDone: [{ id, outcome }]` mit `outcome` ∈ `sent` (Spiegel hat den Stand endgültig beantwortet), `missing`
  (die ID steht nicht in der Ablage), `held` (verdeckt oder gesperrt), optional, höchstens 100. Ein alter Spiegel schickt
  kein `requests`, eine alte Brücke ignoriert es (Go ignoriert unbekannte Felder; der Zustand ist keine `strictObject`-
  Prüfung in Go). Neue Beispiele `examples/api-v1/state.requests.json`, `heartbeat.requests.json`, JSON-Schema neu
  erzeugt.
- **D6 Brücke:** `filter.Rules` kennt die angefragten IDs: Zustimmung gilt als gegeben, verdeckt und gesperrt nicht.
  `watch` liest eine angefragte ID, bis sie `handled` ist, mit Rang 1 (nicht nur im Leerlauf: es ist eine Scheibe, und
  jemand wartet). `run` meldet je Auftrag `sent`, `held` oder `missing` (nicht in der letzten Runde), bis Spiegel ihn
  nicht mehr nennt. **Braucht eine neue Brücke auf dem Pi** (vor Ort); ohne sie bleiben Aufträge offen.
- **D7 Spiegel:**
  - Modell `CardRequest` (Konto, Anlage, ScheibenID, Tag, Zustand, Scheibe, Zeiten), Zustände `open`, `done`,
    `missing`, `held`, `mismatch`, `taken`, `withdrawn`. Offen höchstens 10 je Konto, nach 30 Tagen ohne Antwort
    `missing`.
  - `bridgeState` nennt die offenen Aufträge aktiver Konten der Anlage.
  - `ingestBatch`: ohne Zustimmung, aber mit offenem Auftrag derselben ScheibenID und passendem Tag → Besitzer ist der
    Auftraggeber (nicht wartend); passt der Tag nicht → verworfen (`no-consent`), Auftrag `mismatch`. Nach dem
    Schreiben: Auftrag `done` mit der Scheibe. Gesperrt oder verdeckt → Auftrag `held`.
  - Heartbeat: `requestsDone` setzt `missing` und `held` an offenen Aufträgen der Anlage; `sent` nur, wenn der Auftrag
    noch offen ist und es die Scheibe beim Auftraggeber gibt, sonst bleibt er offen bis zur Frist.
  - Oberfläche im Profil unter der Sportpassnummer: Abschnitt „Scheibe per ID holen“ mit Feldern ID (wie auf dem
    Ausdruck, `ff914420`, auch mit `ID:` davor) und Tag (Vorgabe heute), Knopf „Scheibe holen“ mit Rückfrage
    (`DecisionDialog`), darunter die Aufträge der letzten 30 Tage mit Zustand und, wenn geholt, Link zur Scheibe; ein
    offener lässt sich zurückziehen.
  - ID lesen über `decodePrintoutId` aus `@vereinsheim/meyton-pdf/printout-id` (reine Funktion, ohne unpdf).
- **D8 Texte** (neu, fürs Textbuch): siehe Task 7.

## Files

- `packages/ingest-contract/src/v1/api.ts`, `examples/api-v1/*.requests.json`, `schema/*` (erzeugt), Tests
- `apps/spiegel-bridge/internal/{api,filter,watch,run}/*.go` und Tests
- `apps/spiegel/prisma/schema.prisma`, Migration `<ts>_card_request`
- `apps/spiegel/src/lib/card-requests/{id.ts,queries.ts,actions.ts}` (+ Tests)
- `apps/spiegel/src/lib/ingest/{ingest.ts,bridges.ts}` (+ Tests)
- `apps/spiegel/src/lib/admin/consequences.ts` (+ Test)
- `apps/spiegel/src/components/profile/CardRequests.tsx`, `ProfileScreen.tsx`, `src/app/(app)/profile/page.tsx`
- `apps/spiegel/package.json` (`@vereinsheim/meyton-pdf`)
- Vault: `spiegel-assignment.md`, `spiegel-bridge.md`, `spiegel-ingest-contract.md`, `spiegel-ingest-pipeline.md`,
  `spiegel-roadmap.md`, `spiegel-privacy.md`; `apps/spiegel/CLAUDE.md`, `apps/spiegel-bridge/CLAUDE.md`,
  `packages/ingest-contract/CLAUDE.md`

## Required Docs

- `apps/spiegel/CLAUDE.md` (Ingest-API, „Nichts ohne Zustimmung speichern“, Logs ohne Inhalte, Kein Knopf ohne Folge,
  Migrationen nur anhängen), `apps/spiegel-bridge/CLAUDE.md` (Filter wie Spiegel, Nachladen, Heartbeat),
  `packages/ingest-contract/CLAUDE.md` (nur additiv, Beispiele, Schema erzeugt)
- `vault/spiegel/spiegel-assignment.md` (QR-Weg, Fundbüro, Regeln), `vault/decisions/adr-028.md`,
  `vault/spiegel/spiegel-privacy.md`, `vault/conventions.md` §2, §10

## Tasks

1. **Vertrag:** `stateResponseV1.requests` (optional, `[{ id: int ≥ 1, scheibenId: int32 }]`, max. 1.000) und
   `heartbeatV1.requestsDone` (optional, `[{ id: int ≥ 1, outcome: "sent" | "missing" | "held" }]`, max. 100),
   `REQUEST_OUTCOMES`; Beispiele `examples/api-v1/state.requests.json`, `heartbeat.requests.json`; JSON-Schema über
   `pnpm --filter @vereinsheim/ingest-contract schema`; Tests in `api.test.ts` (alte Beispiele bleiben gültig, ein
   unbekanntes `outcome` fällt).
2. **Brücke (Go), Test zuerst:**
   - `api`: `State.Requests []CardRequest`, `Heartbeat.RequestsDone []RequestDone`.
   - `filter`: `NewRules` merkt sich die angefragten IDs; `Decide` lässt Zustimmung für sie gelten, verdeckt und
     gesperrt nicht (Tests: angefragt ohne Zustimmung → senden; angefragt und verdeckt → `hidden`; angefragt und
     gesperrt → `blocked`).
   - `watch`: `SetRequested(func(int32) bool)`; `plan` gibt einer angefragten, nicht `handled` Scheibe Rang 1 (nicht
     nur im Leerlauf); `Busy`, solange eine angefragte offen ist; `RequestedOpen()` wie `HistoryOpen`.
   - `run`: `setRequests(state)`, `updateRequestsDone()`: je Auftrag `missing`, wenn die ID in der letzten Runde nicht in
     der Ablage stand, `held`, wenn der Filter sie hielt (`held` oder gesperrt), `sent`, wenn sie `handled` ist; gemeldet,
     bis Spiegel ihn nicht mehr nennt (höchstens 100). Ein neu genannter Auftrag öffnet die Scheibe wieder (`Resend`).
   - Tests in `run_test.go` mit der Ablage im Speicher; `pnpm --filter spiegel-bridge replay` bleibt grün.
3. **Spiegel, Schema:** Modell `CardRequest` (`id`, `userId`, `siteId`, `scheibenId`, `day` als `YYYY-MM-DD`,
   `status` Enum `CardRequestStatus` {open, done, missing, held, mismatch, taken, withdrawn}, `cardId` mit
   `onDelete: SetNull`, `createdAt`, `closedAt`), Index (`siteId`, `status`, `scheibenId`); Migration über
   `migrate diff`, `migrate deploy`, `generate`.
4. **Spiegel, Aufträge:** `src/lib/card-requests/`:
   - `id.ts`: `parseCardId(text)` → ScheibenID oder null: `ID: ff914420`, `ff914420` (acht Hex, über
     `decodePrintoutId`), dezimal mit Vorzeichen im int32-Bereich; `eveningDayOfStart(hintMs)` (Ortszeit der Anlage,
     wie `startHintMs` sie liefert, vor 4 Uhr der Vortag). Tests.
   - `queries.ts`: `requestCard(db, { userId, siteId, scheibenId, day, nowMs })` → `created` | `exists` (eigene Scheibe
     an dem Tag: sofort `done` mit Link) | `taken` (eine andere) | `tooMany` (10 offene) | `duplicate` (derselbe offene
     Auftrag); `withdrawRequest`, `ownRequests` (30 Tage), `openRequestsOf(siteId)` für den Zustand,
     `closeRequests(…)` für Heartbeat und Einlesen; Frist 30 Tage → `missing`. Tests gegen die Dev-Datenbank.
   - `actions.ts` (`"use server"`): `requestCardAction(id, day)`, `withdrawCardRequest(id)` mit `shooterId`.
5. **Spiegel, Einlesen:** `ingestBatch`: ohne Zustimmung → offener Auftrag derselben Anlage und ScheibenID? Tag aus
   `startOf` passt → Besitzer der Auftraggeber (nicht wartend); passt nicht → verworfen (`no-consent`), Auftrag
   `mismatch`. Eine aktive Zustimmung eines anderen Kontos geht vor: Auftrag `taken`. Nach dem Schreiben Auftrag `done`
   mit der Scheibe (jüngster Block der Kennung beim Auftraggeber). Gesperrt oder verdeckt → Auftrag `held`. Tests in
   `ingest.test.ts`-Art mit einem eingefrorenen Fall (ohne Zustimmung, mit Auftrag): genau dann gespeichert, sonst nichts
   abgelegt.
6. **Spiegel, Brücke:** `bridgeState` nennt `requests` (offene Aufträge aktiver Konten der Anlage, älteste zuerst) und
   liefert mit einem offenen Auftrag alle Sperren; `recordHeartbeat` schließt `missing`/`held` an offenen Aufträgen
   der Anlage. Tests in `bridges.test.ts`.
7. **Texte** (`consequences.ts`, neu fürs Textbuch): `cardRequest({ hex, day })` — Titel „Scheibe holen?“, about „Du
   holst die Scheibe mit der ID ff914420 vom Di 21.10.2026.“, check „Die ID steht unten auf deinem Ausdruck. Der Tag
   muss stimmen.“, happens „Läuft die Anlage, holt Spiegel genau diese Scheibe in dein Konto. Das dauert ein paar
   Minuten.“, „Ist die Anlage aus, holt Spiegel sie beim nächsten Einschalten.“, notHappening „Andere Scheiben holt
   Spiegel nicht.“, „An der Meyton-Anlage ändert sich nichts.“, undo „Den Auftrag hier zurückziehen. Eine geholte Scheibe
   auf ihrer Seite löschen.“, Knopf „Scheibe holen“. Zustände der Liste: „wartet auf die Anlage“, „geholt“, „nicht
   gefunden“, „an diesem Tag nicht gefunden“, „lässt sich nicht holen“ (verdeckt oder gesperrt), „gehört zu einem
   anderen Konto“, „zurückgezogen“. Tests mit `OLD_WORDS`.
8. **Oberfläche:** `src/components/profile/CardRequests.tsx` im Profil unter der Sportpassnummer: Felder „ID vom
   Ausdruck“ und „Tag“ (Vorgabe heute in der Zone), Knopf mit Rückfrage, Liste der Aufträge mit Zustand, Link zur
   geholten Scheibe, „Zurückziehen“ für offene. Markup-Test; Skriptprüfung: Abschnitt da, ungültige ID zeigt den
   Feldfehler.
9. **Ende zu Ende:** `pnpm --filter spiegel bridge-e2e` um einen Fall erweitern (Scheibe ohne Zustimmung, Auftrag →
   kommt beim Auftraggeber an); sonst mindestens `replay` und die Tests.
10. **Vault:** `spiegel-assignment` (neuer Weg „ID vom Ausdruck“), `spiegel-bridge` und `apps/spiegel-bridge/CLAUDE.md`
    (Aufträge per Zustand), `spiegel-ingest-contract`, `spiegel-ingest-pipeline`, `spiegel-privacy` (ausdrücklich
    geholt), `spiegel-roadmap` (SP-1.5/1.7: „Scheibe per ID“ erledigt, Vorschau offen), `packages/ingest-contract/CLAUDE.md`.

## Verification

- `pnpm check` grün; `pnpm --filter spiegel-bridge replay`; `pnpm --filter spiegel bridge-e2e` (nach `build`).
- Skriptprüfung Spiegel ohne FAIL.
- Mutation: die Tagesprüfung im Einlesen testweise entfernen → der Test „anderer Tag wird nicht gespeichert“ fällt.
- **Vor Ort:** neue Brücke auf den Pi (sonst bleiben Aufträge offen), dann ein Auftrag mit einer echten ID.
