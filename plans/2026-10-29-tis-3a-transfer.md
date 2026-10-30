# 3a · Übernahme eines Kontos

Teilplan von Stufe 3 aus `plans/2026-10-26-treffsicher-in-spiegel.md` (Basisbranch `feat/treffsicher-in-spiegel`),
Kindsession `tis-3a-transfer`, Branch `feat/tis-3a-transfer` vom Basisbranch, zurück in den Basisbranch. Entscheidungen:
„Stufe 3“ und „Entschieden mit dem User am 29. Oktober 2026 (Planung Stufe 3)“ im Koordinationsplan, dazu die vier
Fragen vom 29. Oktober 2026 unten unter „Entscheidungen“ (alle mit der Empfehlung). Abweichungen meldet die Kindsession
an die koordinierende Session, bevor sie davon abweicht.

## Kontext

ADR-033 lässt Treffsicher in Spiegel aufgehen. Stufe 1 (Scheiben in jeder Detailtiefe, Ausdrucke, Belege) und Stufe 2
(Tagebuch mit Einträgen, Zielen, Abläufen, Auswertung) sind gebaut. 2c hat mit einem Vorschau-Werkzeug geprobt, wie ein
Konto aus Treffsicher in Spiegel aussieht (`pnpm --filter spiegel diary-preview`, nur Dev-DB, Schlüssel `preview:`).
3a baut daraus die echte Übernahme **eines** Kontos: `--from <E-Mail in Treffsicher> --to <E-Mail in Spiegel>`.
3b macht sie danach betriebsfähig (Lauf über die Zuordnungsdatei, `status`, `vereinsheim transfer`, VPS); 3a läuft nur
gegen die lokale Dev-Datenbank (Prod-Kopie), wie die Vorschau.

**Stand der Daten** (Dev-DB = Prod-Kopie vom 26. Oktober 2026, alle 9 Zeilen der Zuordnung aus V1, Abend in
`Europe/Berlin`, gezählt am 29. Oktober 2026 mit den Funktionen der Vorschau):

| | Einheiten |
| --- | --: |
| alle, in 6 Konten mit Daten (3 Konten ohne Einheit) | 265 |
| ohne Schießen (Trocken, Mental) | 0 |
| ohne Ergebnis: nur ein Eintrag | 13 |
| Disziplin passt zu keiner Familie („Luftgewehr (Zehntel)“ 3, „LP Training vor RWK“ 1; 2 Konten) | 4 |
| Abend hat in der Familie nur Scheiben „nur Probe“: keine Scheibe (entschieden) | 52 |
| eine vorhandene gewertete Scheibe passt (Schusszahl und Ergebnis gleich; 51 gemessen, 3 vom Ausdruck) | 41 |
| mehrere vorhandene gewertete Scheiben, mindestens eine passt | 13 |
| **unsicher:** gewertete Scheibe da, keine passt | 2 |
| keine Scheibe am Abend: neue Scheibe „aus Treffsicher“ | 141 |
| davon zwei Einheiten derselben Familie am selben Abend (je eine eigene Scheibe) | 32 |

Die zwei unsicheren Fälle sind beide im Konto des Users: 343/40 in Treffsicher gegen zwei gemessene Scheiben mit je
347/40, und 336/40 gegen eine gemessene Scheibe mit 3 Schuss. Anhänge: 69 (49 PDF, 25 davon `print_…`; 20 Fotos, alle
unter 4 MiB); 45 landen an neuen Scheiben, 18 an vorhandenen, 1 an einer Scheibe „nur Probe“, 1 an einer von mehreren
passenden, 3 an Einheiten mit unbekannter Familie, 1 Meyton-PDF an einer Einheit ohne Ergebnis. Ziele: 10 in 4 Konten
mit 120 Verknüpfungen zu Einheiten; Abläufe: 4 in 2 Konten, alle ohne Disziplin, Schritte als Array. Kein Konto ist in
Treffsicher als umgezogen markiert. Treffsicher-Zeiten tragen alle eine Uhrzeit (keine 00:00). Die Dateien der Anhänge
liegen lokal im Backup `backups/uploads-treffsicher-2026-10-26_1114.tar.gz` (passt zum Stand der Prod-Kopie).

## Entscheidungen

Aus dem Koordinationsplan (Stufe 3, 26. bis 29. Oktober 2026):

- Konto für Konto per CLI mit `--from`/`--to`; wiederholbar je Konto; Prüfbestand als Bericht je Konto für den
  Betreiber (nur `reports/`, nie im Repo, nicht in der App).
- **Ziel fehlt:** Die Übernahme legt das Konto an, mit dem Passwort aus Treffsicher (beide bcrypt). Gibt es das Ziel,
  bleibt es, wie es ist.
- **Abbruch statt Zusammenführen:** Trägt das Ziel schon Übernommenes aus einem anderen Treffsicher-Konto, oder gehört
  Übernommenes dieses Treffsicher-Kontos schon einem anderen Spiegel-Konto, bricht der Lauf ab und sagt warum.
- **Jede Einheit wird ein Eintrag**, ihr Ergebnis eine Scheibe mit Herkunft `treffsicher`, außer Spiegel hat eine
  passende (Abend, Familie, Schusszahl, Ergebnis). An einem Abend, an dem die Familie nur Scheiben „nur Probe“ hat,
  entsteht keine zweite Scheibe.
- **Ausdrucke aus Treffsicher werden gelesen:** Ein Meyton-PDF wird Ausdruck der Scheibe. Passt er zur Einheit (Tag,
  Schusszahl, Ergebnis), werden seine Werte eine neue Revision über den Zahlen aus Treffsicher, die als frühere
  Revision bleiben. Passt er nicht, hängt er ohne Werte an und steht im Bericht. Hat Spiegel schon eine Scheibe mit
  dieser ID im Fuß (von der Anlage oder per Import), hängt er dort an. Alle übrigen Dateien werden Belege der Scheibe
  ihrer Einheit (Nachtrag 2b, 1f).
- **Ziele und Abläufe nach dem Nachtrag 2b:** Satz, Beschreibung als Notiz, Art, Zeitraum; keine geratene Messung;
  Disziplin aus den verknüpften Einheiten; Verknüpfungen außerhalb des Zeitraums in den Bericht.
- **Lesend je Konto (3e):** Nach einem echten Lauf setzt die Übernahme `User.movedToSpiegelAt` in Treffsicher.
- **Die Vorschau wird vorher gelöscht.** 3a ersetzt das Vorschau-Werkzeug.

Neu, mit dem User am 29. Oktober 2026 (je mit der Empfehlung):

1. **Unsichere Dublette: beide behalten.** Hat der Abend in der Familie eine gewertete Scheibe, aber keine passt,
   entsteht die Scheibe aus Treffsicher trotzdem; der Bericht nennt den Fall, eine echte Dublette löscht der Schütze
   selbst. **Weicht ab von ADR-033** („Der Fall steht in ‚Offen‘, der Schütze entscheidet über einen Folgen-Dialog“):
   für 2 Fälle keine neue Oberfläche. Die koordinierende Session trägt das bei der Übernahme des Branches als Nachtrag
   in ADR-033 ein (die Kindsession ändert `vault/decisions/` nicht).
2. **Familie unbekannt: stoppen.** Passt eine Disziplin aus Treffsicher zu keiner Familie, bricht der Lauf vor dem
   Schreiben ab und nennt die Namen; der Betreiber gibt die Zuordnung mit `--family "<Name>=<Kennung der Familie>"` an.
   Dasselbe gilt, wenn zu einer Familie keine Disziplin mit der Schusszahl passt (dann legt der Admin sie unter Admin →
   Disziplinen an). Nichts wird geraten.
3. **Neues Konto: Rolle Schütze, Status wie bisher.** Rolle immer `USER`, auch für Admins aus Treffsicher; aktiv oder
   deaktiviert wie in Treffsicher; Name und Passwort-Hash mit; kein Passwortwechsel verlangt.
4. **Zweiter Lauf: Geändertes bleibt.** Ersetzt wird nur, was seit dem letzten Lauf unverändert ist; der Bericht nennt,
   was stehen blieb. Bei Scheiben zeigt das die Herkunft (eine von Hand geänderte ist `manual`, eine mit Werten vom
   Ausdruck `pdf`), bei Einträgen, Zielen und Abläufen `updatedAt` gegen den letzten Lauf (`movedToSpiegelAt` in
   Treffsicher). Was im Papierkorb liegt, bleibt dort.

Keine neue Oberfläche in der App: Was der Betreiber sieht, sind Ausgabe und Bericht des CLI. Ein Designkonzept entfällt
deshalb.

### Abweichungen während der Umsetzung

Mit der koordinierenden Session abgestimmt (29. Oktober 2026), je mit Grund im Validierungsbericht:

1. `markMoved` ist der letzte Schritt **in** der Transaktion, nicht nach dem Commit. Scheiterte es nach dem Commit eines
   zweiten Laufs, wären alle Zeilen dieses Laufs jünger als das alte Merkmal, und der dritte Lauf ersetzte nichts mehr.
   Scheitert der Commit nach dem Merkmal, meldet der Lauf `markedNotSaved` (Exit 3) mit beiden Auswegen.
2. `badFamilyOption` vor `unknownFamily`: Mit einer falschen Kennung meldete der Lauf den Namen sonst als unbekannt.
3. Exit-Code 4 für unerwartete Fehler (nichts geschrieben), damit 1 nur „Befund“ heißt.
4. Verknüpfen ändert `updatedAt` des Eintrags nicht: Ein Eintrag gilt auch als geändert, wenn eine seiner Zeilen in
   `DiaryEntryCard` nach dem letzten Lauf geändert wurde. Eine Scheibe, die ein anderer Eintrag hält, bleibt dort.
5. Ein Probelauf schreibt seinen Bericht nach `…-probe.md`, damit er den des echten Laufs nicht überschreibt.

Mit dem User entschieden (30. Oktober 2026), nach der Probe mit echten Daten:

6. **Größere Disziplin statt Abbruch:** Ohne Disziplin mit genau der Schusszahl nimmt die Übernahme die eingeordnete
   Disziplin der Familie mit der kleinsten Schusszahl darüber (Gleichstand wie bei genauer Schusszahl). Die Scheibe ist
   dann unvollständig (`unvollstaendig`, nicht `complete`); der Bericht zählt diese Einheiten. Gibt es keine größere
   oder ist es ein Gleichstand, bleibt es beim Abbruch `noDiscipline`, jetzt mit Grund (`none`, `tie`).
7. **Probe-Ausdruck übernehmen:** Ein Ausdruck im Modus Probe passt, wenn Abend und Schusszahl gleich sind und die
   Summe seiner Schüsse in der Wertung von Treffsicher dem Ergebnis gleicht (`scoringReading`). Seine Schüsse werden
   Wertung (Revision 2, Herkunft `pdf`). `applyPrintoutValues` liest an einer Scheibe mit Schlüssel `treffsicher:`
   ebenso, damit ein späteres Neulesen sie nicht zu einer Scheibe nur aus Probe macht.

Gefunden bei den Wiederholungen mit den Daten des Users (30. Oktober 2026), der koordinierenden Session gemeldet:

8. **Geändertes bleibt in jedem Lauf:** `updatedAt` > Merkmal hielt eine Änderung nur einen Lauf, weil das Merkmal
   vorrückt; Werte und Ausführung, in der App getippt, änderten `updatedAt` des Eintrags gar nicht. Jetzt schreibt jeder
   Lauf Einträge, Ziele, Abläufe und Verknüpfungen mit der Zeit seines Merkmals, unverändert ist nur genau diese;
   `setScale`, `setExecution` und `clearSection` setzen `updatedAt` des Eintrags. Scheitert der Commit nach dem
   Merkmal, setzt der Lauf das alte zurück, erst wenn das scheitert `markedNotSaved` mit dem alten Wert.
9. **Ausführung auf einer Scheibe, die bleibt:** Sie ging verloren, wenn die Scheibe der Einheit geändert war und
   blieb; jetzt bleibt sie auf ihr.
10. **Ein Ausdruck, den ein früherer Lauf an die Scheibe der Einheit hängte,** galt als „eigene Scheibe“ und gab nie
    Werte; jetzt geht er wie beim ersten Lauf über die Scheibe der Einheit.
11. **Größte Disziplin und `--discipline`** (mit dem User entschieden, 30. Oktober 2026): Ohne gleiche oder größere
    Schusszahl nimmt die Übernahme die größte der Familie (`ueber-soll`). Ein Gleichstand bricht ab; `--discipline
    "<Disziplin in Treffsicher>=<Disziplin in Spiegel>"` wählt für die Einheiten ohne Wahl (die übrigen derselben
    Treffsicher-Disziplin behalten ihre, weil sie oft verschiedene Schusszahlen hat); eine Disziplin außerhalb der Familie
    oder nicht eingeordnet bricht vorher ab (`badDisciplineOption`). Der Bericht zählt Einheiten je Stufe.
12. **Nur Werte, kein Eintrag** (mit dem User entschieden, 30. Oktober 2026): `needsEntry` entscheidet, ob eine Einheit
    einen Eintrag bekommt (Trainingsziel, Befinden, Prognose, Feedback, Reflexion mit Text, Ausführung, Favorit; ohne
    Schießen immer). Eine Einheit nur mit Werten wird nur Scheibe; eine Ziel-Verknüpfung ist kein Grund und bestimmt
    weiter die Familie des Ziels. Ein Eintrag aus einem früheren Lauf bleibt. Der Bericht zählt sie.
13. **Kein Ausdruck geht still verloren** (koordinierende Session, 30. Oktober 2026): Nennt der Kopf eines Ausdrucks,
    der eine eigene Scheibe braucht, keine bekannte Disziplin, nimmt `importPrintoutIn` die der Einheit
    (`fallbackDisciplineId`). Ein Ausdruck ohne Scheibe ist ein Befund (Exit 1), keine Erklärung mehr in der Bilanz.
14. **Aus dem Review** (30. Oktober 2026): Eine Scheibe vom Ausdruck einer Einheit ohne eigene Scheibe bleibt in jedem
    Lauf mit dem Eintrag verknüpft; das Tagebuch schaltet nur ein Lauf ohne jede Zeile der Übernahme ein; eine
    übernommene Scheibe, die der User ergänzt hat (Beleg, geteilt, eigene Wahl, fremde Verknüpfung), bleibt; das
    Merkmal wird auch zurückgesetzt, wenn sein Aufruf scheitert, nachdem er geschrieben hat; Exit 5, wenn nach dem
    Speichern nur Ausgabe oder Bericht scheitern.
15. **Gelöschtes bleibt weg** (koordinierende Session, 30. Oktober 2026): Ab dem zweiten Lauf legt die Übernahme keine
    Scheibe der Einheit, keinen Eintrag, kein Ziel, keinen Ablauf und keinen Anhang wieder an, den es in Spiegel nicht
    mehr gibt; der Bericht zählt sie je Art.
16. **Geändert in der Transaktion prüfen**: Jede Zeile, die der Lauf ändert oder löscht, sperrt er (`FOR UPDATE`) und
    liest sie neu; eine Änderung zwischen dem Lesen vor der Transaktion und dem Schreiben bleibt.
17. **Scheiben aus eigenen Ausdrucken** früherer Läufe zählen beim Entscheiden nicht als Scheiben des Abends.
18. **Merkmal und Zeilen**: Abbruch `markerMissing` (Zeilen ohne Merkmal), `markerWithoutRows` (Merkmal ohne Zeilen) und
    `markerMismatch` (keine Zeile trägt das Merkmal, aber Zeilen die Zeit eines anderen Laufs; ein Konto nur mit Werten
    oder mit allem geändert läuft durch). Ein späterer Lauf ohne geschriebene Zeile lässt das Merkmal stehen.
19. **Aus dem zweiten Review**: Was schon der erste Lauf nicht anlegen konnte (ungültige Scheibe, nicht platzierbarer
    Anhang), bleibt ein Befund statt „in Spiegel gelöscht“ (Anhänge zur Probe in einem `SAVEPOINT`); Belege aus
    Treffsicher machen eine Scheibe nicht zu einer ergänzten; eine eigene Wahl an einer Scheibe aus Treffsicher bleibt
    samt Ausführung; Eintrag vor Scheibe sperren, Scheiben über `lockCard`; das Fenster der Scheiben aus eigenen
    Ausdrucken hat eine obere Grenze; Exit 5 nennt die Befunde.

20. **Hauptbuch der Übernahme, mit Migration** (koordinierende Session, 30. Oktober 2026; Abweichung von „Schema und
    Migrationen fasst 3a nicht an“): zwei neue Tabellen `TransferRun` und `TransferItem`
    (`20261030120000_transfer_ledger`, nur angehängt). „Unverändert“, „geändert, bleibt“, „in Spiegel gelöscht“ und
    „nie platziert“ entscheidet der Lauf je Stück gegen das Hauptbuch; Scheiben nur nach fachlichen Merkmalen (Herkunft,
    Revision, Wahl, Teilen, eigener Beleg), nie nach `updatedAt`. Es fallen weg: der Vergleich mit dem Merkmal,
    `markerMismatch`, `markerWithoutRows`, `markerMissing` (jetzt `ledgerMissing`), das Zeitfenster der Scheiben aus
    eigenen Ausdrucken und die Probe im `SAVEPOINT`. Das Merkmal heißt nur noch „umgezogen“. Export mit den Läufen,
    Konto löschen über die Kaskade. Die Abschnitte oben zu `lastRunAt`, `isTouched` und dem Merkmal als Grenze gelten
    nicht mehr. Nachträge aus dem Review des Hauptbuchs: Anhänge einer entfernten Scheibe gehen aus dem Hauptbuch; eine
    Scheibe mit übernommenen Werten vom Ausdruck wird nach dem Ablegen mit Herkunft `pdf` verzeichnet; `filesMissing`;
    eine fehlende Scheibe einer Einheit bleibt im Hauptbuch; ist die verknüpfte Scheibe gelöscht, entsteht keine aus
    Treffsicher; ein Anhang an seiner verzeichneten Scheibe kommt nicht an eine zweite; Anhänge, die es in Treffsicher
    nicht mehr gibt; Sperre des Kontos in `write`. `kindChoice` setzt ein neuer Lauf nicht neu (wie vorher, offen).

### Offen

- Trägt eine übernommene Scheibe zwei Ausdrucke (einen passenden, einen anderen), kann ein späteres Neulesen die Werte
  des anderen nehmen (`applyPrintoutValues`, `readingOrder`). Für 3b, in der Vault-Note festgehalten.

## Ansatz

### Überblick

```
tools/transfer.ts  ── liest ──>  Treffsicher (psql im Dev-Container, nur lesend; zuletzt das Merkmal „umgezogen“)
      │                          Dateien der Anhänge (--files <Ordner>, entpacktes Backup)
      ▼
src/parts/transfer/run.ts   runTransfer(db, input): Vorprüfung → Dateien lesen → eine Transaktion → Bericht
      ├─ src/parts/transfer/decide.ts      rein: je Einheit Scheibe neu / vorhandene / keine, mit Grund
      ├─ src/lib/transfer/treffsicher-card.ts        rein (aus 2c): Familie, Disziplin, Angaben
      ├─ src/lib/transfer/printout-fit.ts            rein: passt ein Ausdruck zur Einheit?
      ├─ src/lib/transfer/write.ts                   Scheiben schreiben, Ausdruck und Beleg anhängen
      ├─ src/diary/transfer/treffsicher-entry.ts     rein (aus 2c): Eintrag, Ausführung
      ├─ src/diary/transfer/treffsicher-goal.ts      rein, neu: Ziel, Ablauf
      ├─ src/diary/transfer/write.ts                 Einträge, Ziele, Abläufe schreiben (aus 2c, erweitert)
      └─ src/parts/transfer/check.ts       rein: Prüfbestand aus vorher/nachher
```

`src/parts/transfer/` bleibt die Nahtstelle, die beide Teile schreibt (wie die Vorschau). Der Ergebnisteil
(`src/lib/**`) importiert das Tagebuch nie, das Tagebuch (`src/diary/**`) liest Scheiben nur über
`src/lib/results-read.ts` (Gate `src/parts/boundary.test.ts`). Kein Schema-Change in Spiegel und in Treffsicher; keine
Migration; keine neue Brücke.

### Schlüssel

| Zeile | Schlüssel | Spalte |
| --- | --- | --- |
| Scheibe aus einer Einheit | `treffsicher:<Einheit>` | `Card.importKey` |
| Eintrag | `treffsicher:<Einheit>` | `DiaryEntry.importKey` |
| Ziel | `treffsicher:<Ziel>` | `DiaryGoal.importKey` |
| Ablauf | `treffsicher:<Ablauf>` | `DiaryRoutine.importKey` |

Die Kennungen aus Treffsicher sind cuids und über alle Konten eindeutig. Neu `src/parts/transfer/keys.ts`:

```ts
/** Präfix der Schlüssel der Übernahme in Scheiben und Tagebuch */
export const TRANSFER_PREFIX = "treffsicher:"
/** Präfix der Vorschau aus 2c; ein Lauf bricht ab, solange es Zeilen damit gibt */
export const PREVIEW_CARD_PREFIX = "treffsicher:preview-"
export const PREVIEW_DIARY_PREFIX = "preview:"

export const transferKey = (id: string) => `${TRANSFER_PREFIX}${id}`

/** die Kennung aus Treffsicher in einem Schlüssel der Übernahme; null für andere und für die Vorschau */
export function sourceIdOf(key: string | null): string | null {
  if (!key?.startsWith(TRANSFER_PREFIX) || key.startsWith(PREVIEW_CARD_PREFIX)) return null
  return key.slice(TRANSFER_PREFIX.length)
}
```

`entryFromSession` (`src/diary/transfer/treffsicher-entry.ts`) nimmt den Schlüssel als Argument `importKey` statt
`preview:${session.id}` fest einzubauen. Der Ergebnisteil kennt `keys.ts` nicht; `src/lib/transfer/write.ts` bekommt
den Schlüssel vom Aufrufer.

### Treffsicher lesen: eine Zeile JSON je Konto

Neu `tools/transfer/treffsicher-account.sql` (ersetzt `treffsicher-sessions.sql`), Variable `from` (E-Mail, ohne
Groß- und Kleinschreibung und Rand wie V1). Liefert eine Zeile JSON, ohne Treffer keine:

```
{ user: { id, name, email, passwordHash, isActive, movedToSpiegelAt },
  sessions: [ …wie bisher…, attachments: [{ id, filePath, fileType, originalName, createdAt }] ],
  goals: [{ id, title, description, type, dateFrom, dateTo, sessionIds: [..] }],
  routines: [{ id, name, discipline: { name } | null, steps }] }
```

Zeiten als ISO in UTC wie heute (`to_char(… 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`). `passwordHash` geht nur in den
Speicher des Prozesses, nie in Ausgabe oder Bericht. Dazu zwei kleine Abfragen im selben Modul der Quelle:

- `sessionOwners(ids)`: `select id, "userId" from "TrainingSession" where id = any(:ids)` (dazu `Goal`, `ShotRoutine`),
  für die Vorprüfung „gehört einem anderen Konto“;
- `markMoved(userId, at)`: `update "User" set "movedToSpiegelAt" = :at where id = :id`.

Die Quelle ist eine Schnittstelle, damit 3b eine für den VPS ergänzt und Tests ohne Docker laufen:

```ts
// src/parts/transfer/source.ts
export interface TreffsicherSource {
  readAccount(email: string): Promise<unknown | null>
  sessionOwners(ids: readonly string[]): Promise<Map<string, string>>
  markMoved(userId: string, at: Date): Promise<void>
}
```

Die Umsetzung für Dev (`tools/transfer/source-dev.ts`) ruft `docker compose -f docker-compose.dev.yml exec -T db psql
-U postgres -d treffsicher -At -v ON_ERROR_STOP=1` wie `readTreffsicher` in `tools/diary-preview.ts` heute; Werte gehen
als `-v name=wert` und werden im SQL mit `:'name'` zitiert, nie in den SQL-Text gesetzt. `ids` als ein Wert
`'{a,b,c}'` (`:'ids'::text[]`); die cuids sind `[A-Za-z0-9_-]` (das prüft das zod-Schema schon).

Das zod-Schema der Zeile (`treffsicherAccount`) liegt in `src/parts/transfer/treffsicher-export.ts`; es übernimmt die
Teile von `treffsicherExport` aus `src/parts/transfer/diary-preview.ts` und ergänzt `user`, `attachments`, `goals`,
`routines`. `filePath`: relativ, ohne `..`, ohne führenden `/`, nur `[A-Za-z0-9._/-]` (Treffsicher speichert UUID-Namen).

### Vorprüfung: Abbruch, bevor etwas geschrieben wird

`runTransfer` prüft in dieser Reihenfolge und bricht mit einem festen Grund ab (`TransferAbort`, Text im CLI, ohne
E-Mails):

1. `noSource`: kein Konto in Treffsicher mit dieser E-Mail.
2. `preview`: Das Ziel hat Scheiben mit `treffsicher:preview-` oder Einträge, Ziele, Abläufe mit `preview:` →
   „Erst die Vorschau löschen: `pnpm --filter spiegel diary-preview --delete --to …`“ (bis Aufgabe 9 das Werkzeug
   entfernt; danach steht im Text die SQL-freie Lösung, siehe Aufgabe 9).
3. `foreignInTarget`: Das Ziel hat Zeilen mit `treffsicher:<id>`, deren `id` laut `sessionOwners` einem anderen
   Treffsicher-Konto gehört.
4. `sourceElsewhere`: Ein Schlüssel `treffsicher:<id>` einer Einheit, eines Ziels oder Ablaufs dieses Kontos steht an
   einer Zeile eines anderen Spiegel-Kontos.
5. `unknownFamily`: Einheiten, Ziele oder Abläufe mit Disziplin, deren Name weder über `familyForName` noch über
   `--family` eine Familie findet (Ausgabe: je Name die Zahl der Einheiten). Ein Ablauf ohne Disziplin ist kein Fall.
6. `badFamilyOption`: `--family` nennt eine Kennung, die es nicht gibt, oder denselben Namen zweimal.
7. `noDiscipline`: Eine Einheit braucht eine neue Scheibe, aber `disciplineForShots` findet in ihrer Familie keine
   Disziplin der ersten Anlage mit ihrer Schusszahl (Ausgabe: Familie und Schusszahl, Zahl der Einheiten).

Zeilen ohne Gegenstück in Treffsicher (die Einheit gibt es dort nicht mehr, `sessionOwners` kennt die Kennung nicht)
sind kein Abbruch: Unveränderte gehen, geänderte bleiben (Bericht).

### Je Einheit: Scheibe neu, vorhandene oder keine (rein)

Neu `src/parts/transfer/decide.ts`. Die Scheiben des Ziels liest der Lauf über `resultCards` (sichtbar, nicht im
Papierkorb, nicht wartend), **ohne** die eigenen übernommenen (`sourceIdOf(importKey) !== null`). Dafür bekommt
`ResultCard` (`src/lib/results-read.ts`) zwei Felder aus der aktuellen Revision, damit der Vergleich nicht von der
Wertung der Familie abhängt:

```ts
  /** Gesamtergebnis in ganzen Ringen und in Zehnteln (Zehntel × 10); null, wo die Scheibe es nicht hat */
  totals: { rings: number | null; decimalTenths: number | null }
  /** der Schlüssel der Übernahme, null ohne */
  importKey: string | null
```

`totals` kommt aus der Projektion, die `overviewCards` ohnehin liest: die Kennzahl des Ergebnisses
(`metricByKey("result.decimal")`) in beiden Wertungen über `projectedValues` bzw. denselben Weg, den
`cardListModel` für die Spalte Ergebnis nimmt (`rings` = Wert in `rings`, `decimalTenths` = Wert in `decimal` × 10,
gerundet), null, wo die Projektion keinen Wert hat. Ein Test je Detailtiefe (Schüsse, Serien-Summen, nur
Gesamtergebnis, ohne Werte) belegt, dass es dieselben Zahlen sind wie in der Liste. `importKey` braucht `OverviewCard`
(über `OWNER_CARD_SELECT` in `reads.ts`).

```ts
export type CardDecision =
  /** eine passende vorhandene Scheibe (oder mehrere): verknüpfen, keine neue */
  | { kind: "existing"; cardIds: string[] }
  /** keine Scheibe am Abend in der Familie */
  | { kind: "new" }
  /** gewertete Scheiben am Abend, keine passt: trotzdem neu (beide behalten), im Bericht */
  | { kind: "uncertain"; others: { cardId: string; shots: number; total: number | null }[] }
  /** nur Scheiben „nur Probe“ am Abend: keine neue */
  | { kind: "probeEvening"; cardIds: string[] }
  | { kind: "none"; reason: "notShooting" | "noResult" }

export function decideCard(
  session: { type: SessionType; scoring: "WHOLE" | "TENTH" },
  details: { shots: number; total: { rings?: number; decimalTenths?: number } | null } | null,
  evening: readonly { id: string; probeOnly: boolean; shots: number; totals: ResultCard["totals"] }[]
): CardDecision
```

Regeln, in dieser Reihenfolge:

1. Nicht `TRAINING`/`WETTKAMPF` → `none/notShooting`; ohne Angaben (`treffsicherDetails` null) → `none/noResult`.
2. Keine Scheibe am Abend in der Familie → `new`.
3. **Passt** heißt: nicht `probeOnly`, `shots` gleich, und das Gesamtergebnis gleich in der Wertung, die Treffsicher
   hatte (`WHOLE`: `rings`; `TENTH`: `decimalTenths`). Ohne Gesamtergebnis in Treffsicher (eine Serie ohne Wert) passt
   keine. Gibt es passende → `existing` mit allen passenden (in der Prod-Kopie 12-mal zwei gleiche gemessene Scheiben).
4. Nur Scheiben `probeOnly` → `probeEvening`.
5. Sonst → `uncertain`.

Familie und Disziplin wie in der Vorschau (`familyForName`, `disciplineForShots`), mit den Zuordnungen aus `--family`
vor `familyForName`.

### Schreiben: eine Transaktion je Konto

`runTransfer` liest erst alles, was dauert, außerhalb der Transaktion:

- die Dateien der Anhänge aus `--files` (fehlt die Option oder eine Datei: im Bericht „Datei fehlt“, der Lauf geht
  weiter; die Datei bleibt in der Sicherung von Treffsicher);
- jedes PDF über `storePrintout(bytes, { write: !dryRun })` (Kindprozess, ID und Druckzeit, Werte); `stored` ist ein
  Meyton-Ausdruck, `rejected` mit `noId` ein gewöhnliches PDF, jeder andere Grund steht im Bericht und das PDF wird
  Beleg;
- Fotos und gewöhnliche PDFs: `evidenceTypeOf`, Größe ≤ `EVIDENCE_MAX_BYTES`, sha256, Datei über `writeEvidenceFile`
  (nicht im Probelauf).

Dann eine interaktive Transaktion (`timeout` 300 s, `maxWait` 10 s wie die Vorschau), `dryRun` rollt sie am Ende mit
einem eigenen Fehler zurück (Muster `DryRun` aus der Vorschau). Darin:

1. **Konto:** `to` gibt es → bleibt. Sonst `user.create` mit `email: to`, `name`, `passwordHash`, `isActive` aus
   Treffsicher, `role: "USER"`, `mustChangePassword: false`. `DiarySettings.enabled = true`, wenn das Ziel vor dem Lauf
   keinen Eintrag mit `treffsicher:` hatte (erster Lauf); ein späterer Lauf lässt den Schalter, wie er ist.
2. **Je Einheit** (nach Datum): `decideCard`, dann
   - `new` und `uncertain`: `writeTransferCard` (in `src/lib/transfer/write.ts`) → `writeEnteredCardIn` mit
     `origin: "treffsicher"`, Disziplin, Beginn, `kind`/`kindChoice` aus dem Typ, `place: location`,
     `importKey: transferKey(id)`, `details`, `reason: "treffsicher"`. Gibt es die Scheibe schon mit `origin`
     `manual` oder `pdf` (`notEditable`) oder im Papierkorb (`missing`), bleibt sie und der Bericht zählt sie unter
     „geändert, bleibt“.
   - `existing`, `probeEvening`, `none`: eine früher übernommene Scheibe dieser Einheit mit `origin: "treffsicher"`,
     nicht im Papierkorb, geht (`releaseImportedLinks`, `purgeCards(tx, ids, { lock: true })` wie die Vorschau); eine
     geänderte bleibt.
   - **Eintrag:** `entryFromSession(…, { importKey: transferKey(id), familyId, withCard, timeZone })` und
     `upsertImportedEntry`, außer der Eintrag ist geändert (`updatedAt > lastRunAt`) oder im Papierkorb: dann bleibt er
     samt Verknüpfung und Ausführung. Verknüpft fest (`setImportedLinks`) werden die neue Scheibe bzw. die passenden
     (`existing`); bei `probeEvening` nichts (der Abend leitet sie ab, Nachtrag 2a).
   - **Ausführung** wie in der Vorschau (`executionsOnCard` auf die eine Scheibe des Eintrags; bei `probeEvening` auf
     die eine gezählte, sonst ausgelassen mit Grund).
   - **Anhänge** der Einheit, siehe unten.
3. **Ziele und Abläufe** über `goalFromTreffsicher`/`routineFromTreffsicher` und `upsertImportedGoal`/
   `upsertImportedRoutine`, geänderte und gelöschte bleiben.
4. **Verschwundene:** Zeilen des Ziels mit `treffsicher:<id>`, deren `id` dieses Konto nicht mehr hat und keinem
   anderen gehört: unveränderte gehen (Scheiben wie oben, Einträge, Ziele, Abläufe mit `delete`), geänderte bleiben.

`lastRunAt` ist `user.movedToSpiegelAt` aus Treffsicher (null beim ersten Lauf: nichts gilt als geändert). Nach einem
echten Lauf, nach dem Commit, setzt `source.markMoved(user.id, new Date())` das Merkmal; schlägt das fehl, sagt der
Bericht es, und ein zweiter Lauf holt es nach. Der Probelauf setzt nichts.

### Anhänge

Je Anhang einer Einheit, in `src/lib/transfer/write.ts` (`placeAttachment`), wohin er geht:

1. **Meyton-Ausdruck** (`stored`):
   1. Hat das Konto eine Scheibe mit dieser ID am Abend des Drucks (`ownCardOfEvening` mit `scheibenId`, Tag aus
      `printedAt`): `attachPrintout` dort; an einer Scheibe vom Ausdruck ohne Brücke `applyPrintoutValues` (wie
      `importPrintout`).
   2. Sonst an die Scheibe der Einheit, wenn es genau eine gibt (neu, `uncertain` oder die erste passende): an einer
      Scheibe `treffsicher`, wenn der Ausdruck passt (`printoutFits`, unten), `adoptPrintoutValues`; sonst nur
      anhängen (ohne Werte) und im Bericht.
   3. Sonst (keine Scheibe: ohne Ergebnis, Abend nur aus Probe) wie `importPrintout`: eine Scheibe vom Ausdruck mit der
      Disziplin aus dem Kopf (`headerDisciplineId`), ohne Auftrag; geht das nicht (`noDiscipline`, `taken`,
      `blocked`, `trashed`), steht der Ausdruck mit Grund im Bericht. Dafür wird `importPrintout`
      (`src/lib/fetch-card/import.ts`) zu `importPrintoutIn(tx, …)` in der Transaktion des Aufrufers;
      `importPrintout` ruft es in seiner eigenen.
2. **Foto oder gewöhnliches PDF:** Beleg an der Scheibe der Einheit (neu, `uncertain`, die erste passende, bei
   `probeEvening` die eine gezählte). Ohne Scheibe oder bei mehreren gezählten im Bericht unter „Beleg ohne Scheibe“
   (die Datei bleibt in der Sicherung von Treffsicher). Dafür wird der Teil von `attachEvidence`
   (`src/lib/evidence/actions.ts`), der unter `lockCard` die Grenze, die Prüfsumme und die Zeile schreibt, zu
   `attachEvidenceIn(tx, { cardId, ownerId, sha256, type, size, fileName })` in `src/lib/evidence/attach.ts`;
   `attachEvidence` ruft es. Name über `evidenceFileName(originalName)`. Grenze (10), Dublette und eine Scheibe im
   Papierkorb stehen im Bericht.

`printoutFits` (neu, rein, `src/lib/transfer/printout-fit.ts`): Der Ausdruck passt zur Einheit, wenn seine Lesung `ok`
ist, `eveningDay(printedAt)` der Abend der Einheit ist, die Zahl der Wertungsschüsse gleich ist und das Gesamtergebnis
gleich in der Wertung von Treffsicher (`WHOLE`: Summe der ganzen Ringe; `TENTH`: Summe der Zehntel). Eine Lesung nur
aus Probe passt nie.

`adoptPrintoutValues(tx, cardId, file, targetId)` (neu, `src/lib/transfer/write.ts`): `newCardValues(file, targetId)`;
sind Werte da, `writeEnteredCardIn` mit `cardId`, `origin: "pdf"`, den Werten und der Standnummer, `reason:
"printout"`; die Scheibe wird damit „vom Ausdruck“, Revision 1 (Treffsicher) bleibt. Dafür erlaubt `detailsWriter`
(`src/lib/entered/details.ts`) den Übergang `treffsicher` → `pdf` (nur der Ausdruck; `manual` → `pdf` bleibt
verboten). Die Tabelle im Test von `detailsWriter` und der Absatz zu `detailsWriter` in `apps/spiegel/CLAUDE.md`
(„aus Treffsicher von Hand oder von der Übernahme“) bekommen den Fall dazu. Eine solche Scheibe ersetzt ein zweiter Lauf
nicht mehr (`notEditable`, „geändert, bleibt“), genau wie eine von Hand geänderte.

### Ziele und Abläufe (rein)

Neu `src/diary/transfer/treffsicher-goal.ts`:

- `goalFromTreffsicher(goal, { familyOfSession, timeZone })`: `title` → `title`, `description` → `note`,
  `RESULT`/`PROCESS` → `result`/`process`, `dateFrom`/`dateTo` → Tage in der Anzeige-Zone (`eveningDay` ist hier falsch:
  ein Zeitraum ist ein Kalendertag; `dateOfDay` aus `src/diary/validation.ts` und der Tag in der Zone), keine Messung,
  `outcome` null. Familie: haben alle verknüpften Einheiten mit Familie dieselbe → diese, sonst null. Liefert dazu die
  Zahl der Verknüpfungen außerhalb des Zeitraums (Bericht).
- `routineFromTreffsicher(routine, familyOf)`: `name`, Familie über den Namen der Disziplin (oder null), `steps` nach
  `order` sortiert als `{ title, description? }`, geprüft mit `routineSteps`; ein Schritt, den `routineSteps` ablehnt,
  bricht nicht ab, sondern der Ablauf kommt als ein Schritt mit dem Text aller Schritte (Bericht).

`src/diary/transfer/write.ts` bekommt `upsertImportedGoal`/`upsertImportedRoutine` (wie `upsertImportedEntry`: über
den Schlüssel anlegen oder setzen, fremder Besitzer wirft) und `isTouched(row, lastRunAt)`
(`row.deletedAt !== null || (lastRunAt !== null && row.updatedAt > lastRunAt)`). `deletePreviewDiary` bleibt bis
Aufgabe 9.

### Prüfbestand (rein) und Bericht

Neu `src/parts/transfer/check.ts`, `checkTransfer(before, after)`:

- **Je Einheit mit Ergebnis:** Ergebnis und Ø je Schuss vorher (Treffsicher, in seiner Wertung; Ø in ganzen Ringen bei
  `WHOLE`, in Zehnteln bei `TENTH`) gleich nachher (die verknüpfte Scheibe: neu oder passend). Abweichungen nur
  erklärt: `probeEvening`, `uncertain` (beide stehen da), `adopted` (Werte vom Ausdruck, gleiches Ergebnis nach
  `printoutFits`), `kept` (geändert, bleibt). Jede unerklärte Abweichung ist ein Befund und macht den Exit-Code 1.
- **Vollständigkeit je Tabelle:** Einheiten = Einträge; Wellbeing → Werte `sleep … motivation`; Prognose/Feedback →
  Werte und Felder nach `entryFromSession`; Serien mit `executionQuality` → Ausführung + ausgelassen mit Grund;
  Anhänge → Ausdrucke + Belege + Bericht; Ziele, Abläufe, Verknüpfungen von Zielen (im Zeitraum, außerhalb). Jede
  Zeile: Zahl vorher, Zahl nachher, Erklärung der Differenz.
- **Stichprobe Feld für Feld:** 5 Einheiten mit den meisten Texten, je Feld Text vorher und nachher.

Der Bericht geht nach `reports/tis-3a/transfer-<YYYY-MM-DD>-<acht Zeichen sha256 der E-Mail in Treffsicher>.md`
(gitignored; enthält Texte, nie E-Mail oder Passwort). Die Ausgabe des CLI nur Zahlen, Gründe und Namen von
Disziplinen.

### CLI

`tools/transfer.ts`, Skript `"transfer": "tsx tools/transfer.ts"` in `apps/spiegel/package.json`:

```
pnpm --filter spiegel transfer --from <E-Mail in Treffsicher> --to <E-Mail in Spiegel>
  [--dry-run] [--files <Ordner mit den Dateien aus Treffsicher>] [--family "<Name>=<Kennung>"]…
```

Nur gegen die lokale Dev-Datenbank (`assertDevDatabase` aus `tools/dev-guard.ts`); 3b öffnet es für den VPS. Für die
Dateien entpackt der Betreiber das Backup in einen Ordner unter `tools/private/` (gitignored), etwa
`tools/private/treffsicher-uploads/`; `--files` liest nur darin (Pfad relativ aus `filePath`, `realpath` muss im Ordner
bleiben). Exit-Codes: 0 fertig ohne Befund, 1 Befund im Prüfbestand, 2 Aufruf falsch, 3 Abbruch der Vorprüfung.

### Die Vorschau geht

Nach dem echten Lauf für das Konto des Users (Aufgabe 8) entfällt die Vorschau: `tools/diary-preview.ts`,
`src/parts/transfer/diary-preview.ts` (+ Test), `tools/transfer/treffsicher-sessions.sql`, `deletePreviewDiary` und
der Eintrag in `apps/spiegel/package.json` gehen; die Abfrage `preview` der Vorprüfung bleibt (alte Zeilen löscht dann
ein Satz SQL, den der Abbruchtext nennt: `DELETE FROM "DiaryEntry" WHERE "importKey" LIKE 'preview:%'` u. a., in
`vault/spiegel/spiegel-account-transfer.md` festgehalten).

## Dateien

Neu:

- `apps/spiegel/src/parts/transfer/{keys,source,treffsicher-export,decide,run,check}.ts` (+ Tests zu `decide`, `run`,
  `check`, `treffsicher-export`)
- `apps/spiegel/src/lib/transfer/{printout-fit,write}.ts` (+ Tests)
- `apps/spiegel/src/lib/evidence/attach.ts` (+ Test)
- `apps/spiegel/src/diary/transfer/treffsicher-goal.ts` (+ Test)
- `apps/spiegel/tools/transfer.ts`, `apps/spiegel/tools/transfer/{treffsicher-account.sql,source-dev.ts}`

Geändert:

- `apps/spiegel/src/lib/results-read.ts` (`totals`, `importKey`), `src/lib/db/reads.ts` bzw. `src/lib/overview.ts`
  (Felder durchreichen)
- `apps/spiegel/src/lib/entered/details.ts` (+ Test): `treffsicher` → `pdf`
- `apps/spiegel/src/lib/evidence/actions.ts` (ruft `attachEvidenceIn`)
- `apps/spiegel/src/lib/fetch-card/import.ts` (`importPrintoutIn`)
- `apps/spiegel/src/diary/transfer/{treffsicher-entry,write}.ts` (+ Tests)
- `apps/spiegel/package.json` (`transfer`, später ohne `diary-preview`)
- `apps/spiegel/CLAUDE.md` (Befehle, `detailsWriter`, Tagebuch), `vault/spiegel/spiegel-account-transfer.md`,
  `vault/spiegel/spiegel-diary.md` (Vorschau → Übernahme)

Entfernt (Aufgabe 9): `apps/spiegel/tools/diary-preview.ts`, `apps/spiegel/src/parts/transfer/diary-preview{,.test}.ts`,
`apps/spiegel/tools/transfer/treffsicher-sessions.sql`.

Nicht angefasst: Schema und Migrationen beider Apps, `vault/decisions/`, `scripts/`, `compose.yml`, Treffsicher.

## Required Docs

- `vault/spiegel/spiegel-account-transfer.md` (V1, Zuordnungen der Vorschau)
- `vault/spiegel/spiegel-diary.md` (Einträge, Ziele, Abläufe, Ableitung der Scheiben eines Abends)
- `vault/decisions/adr-033.md` (Stufe 3 „Verlustfrei“, „Prüfbestand“; Nachträge 1a, 1c, 1d, 2a, 2b, 1f)
- `vault/apps/treffsicher/treffsicher-read-only.md` (Merkmal `movedToSpiegelAt`)
- `vault/spiegel/meyton-printout.md` („Alte Ausdrucke einlesen“)
- `apps/spiegel/CLAUDE.md` (Scheiben mit Angaben, Belege, Ausdrucke, Tagebuch, Tests gegen die Dev-Datenbank)
- `vault/conventions.md` §9 (Tests gegen die Dev-Datenbank fassen nur eigene Zeilen an; Mocks filtern; Mutationsprobe)

## Aufgaben

1. **Schlüssel und Quelle.** `keys.ts`, `source.ts`, `treffsicher-export.ts` (zod, aus `treffsicherExport` übernommen
   und ergänzt), `tools/transfer/treffsicher-account.sql`, `tools/transfer/source-dev.ts`. Test: zod-Schema gegen ein
   erfundenes Konto (alle Felder, `filePath` mit `..` abgelehnt). Probe: das SQL für das Konto des Users im
   Dev-Container ausführen und nur Zahlen ausgeben. Erwartet für das Konto des Users: 94 Einheiten, 2 Anhänge,
   3 Ziele, 2 Abläufe (die erfundenen Ziele und Abläufe der Vorschau liegen nur in Spiegel).
2. **`ResultCard.totals` und `importKey`.** Felder durchreichen; Test je Detailtiefe (Schüsse, Serien-Summen, nur
   Gesamtergebnis, ohne Werte), dass `totals` dieselbe Zahl ist wie das Ergebnis der Liste in ganzen Ringen bzw.
   Zehnteln.
3. **`decideCard` (rein).** Tests für jede Regel, mit Fixtures, in denen „falsche Quelle“ ein anderes Ergebnis ergäbe
   (§9): passende Scheibe mit gleicher Schusszahl, aber anderem Ergebnis → `uncertain`; zwei passende → `existing` mit
   beiden; `WHOLE` gegen eine Scheibe mit gleichen Zehnteln, aber anderen Ringen; nur Probe → `probeEvening`; Treffsicher
   ohne Gesamtergebnis → nie `existing`. Mutationsprobe: die Bedingung `shots` gleich durch `true` ersetzen, ein Test
   wird rot.
4. **Ziele und Abläufe (rein) und Schreiben im Tagebuch.** `treffsicher-goal.ts`, `entryFromSession` mit `importKey`,
   `upsertImportedGoal`, `upsertImportedRoutine`, `isTouched`. Tests: Zeitraum über die Zeitzonengrenze (31. August
   22:30 UTC ist in Berlin der 1. September), Familie aus gemischten Einheiten → null, Schritte in falscher Reihenfolge.
5. **Ausdruck und Beleg in Transaktionen.** `importPrintoutIn`, `attachEvidenceIn`, `detailsWriter` `treffsicher` →
   `pdf`, `printoutFits`, `adoptPrintoutValues`, `placeAttachment`. Bestehende Tests von Import und Belegen bleiben
   grün; neue Tests gegen die Dev-Datenbank mit eigener Anlage (`createTestSite`) und dem erfundenen Ausdruck aus
   `tools/printout-sample.ts` (`--values`): passt → Revision 2 vom Ausdruck, Revision 1 bleibt, Herkunft `pdf`;
   passt nicht → angehängt, keine Revision; Scheibe mit dieser ID schon da → dort angehängt.
6. **`runTransfer` und `checkTransfer`.** Vorprüfung, Konto, Transaktion, verschwundene Zeilen, Bericht. Tests gegen
   die Dev-Datenbank mit einer `TreffsicherSource` aus dem Speicher, eigener Anlage und eigenem Konto (Muster
   `diary-preview.test.ts`): neues Konto mit Hash und Rolle `USER`; jeder Abbruchgrund; zweiter Lauf ohne Änderung
   ändert nichts (Zeilen vorher und nachher gleich); zweiter Lauf nach geändertem Eintrag (`updatedAt` nach
   `lastRunAt`) und von Hand geänderter Scheibe (`manual`) lässt beide stehen; eine in Treffsicher verschwundene Einheit
   nimmt ihre unveränderten Zeilen mit; `dryRun` schreibt nichts; ein Prüfbestand mit absichtlich falscher Scheibe
   meldet den Befund (Gegenprobe, §9).
7. **CLI.** `tools/transfer.ts` mit Argumenten, Ausgabe, Bericht, Exit-Codes; `--files` nur unter `tools/private/`.
   Kein Test gegen Docker; die Argumente als reine Funktion mit Test (wie `argsOf` in `tools/diary-preview.ts`).
8. **Probe mit echten Daten (nur auf Zeichen der koordinierenden Session).** Vorher `pnpm --filter spiegel
   diary-preview --delete --to <E-Mail>` (Zeichen abwarten). Backup entpacken nach
   `apps/spiegel/tools/private/treffsicher-uploads/`. Dann:
   1. Probelauf (`--dry-run`) für alle 9 Zeilen der Zuordnung `reports/tis-v1/zuordnung-2026-10-26.csv` (E-Mails nur
      auf der Kommandozeile, aus der Datei gelesen; nie in Dateien des Repos). Erwartet: Abbruch `unknownFamily` für
      die zwei Konten mit „Luftgewehr (Zehntel)“ und „LP Training vor RWK“, mit `--family` danach durch; die Zahlen der
      Tabelle oben (52 `probeEvening`, 54 `existing`, 2 `uncertain`, 141 neu, 13 ohne Ergebnis).
   2. Echter Lauf nur für das Konto des Users (`--from`/`--to` je seine E-Mail), zweimal; der zweite ändert nichts.
      Prüfbestand ohne Befund. Danach `pnpm --filter treffsicher moved --clear <E-Mail>` nicht ausführen: Das Konto
      bleibt in der Dev-DB umgezogen, bis der User es anders sagt.
   3. Im Browser (eigener Port, gemeldet) als User angemeldet: eine neue Scheibe aus Treffsicher, eine mit Ausdruck und
      Werten (Revision 2), ein Eintrag mit Ausführung, ein Ziel, die Belege einer Scheibe; Screenshots nach
      `reports/tis-3a/`.
9. **Vorschau entfernen** (siehe „Die Vorschau geht“), Doku nachziehen: `vault/spiegel/spiegel-account-transfer.md`
   (Abschnitt „Übernahme eines Kontos“: Aufruf, Regeln, Schlüssel, Abbrüche, Prüfbestand, „Geändertes bleibt“,
   Vorschau-Zeilen per SQL), `vault/spiegel/spiegel-diary.md`, `apps/spiegel/CLAUDE.md` (Befehl `transfer` statt
   `diary-preview`, `detailsWriter`).
10. **Abschluss** nach den Regeln für Kindsessions (Lessons, Rebase auf den Basisbranch, `pnpm check` im Worktree,
    `/validate`, `/review`, Meldung mit Zahlen der Probe, was nicht belegt ist, neue Brücke: nein).

## Tests

- `pnpm --filter spiegel test` (Gate): neue Tests aus den Aufgaben 1 bis 7, bestehende von Import, Belegen,
  Ausdrucken, Tagebuch und Grenze der Teile (`boundary.test.ts`) grün.
- Mutationsproben: `decideCard` (Aufgabe 3), `isTouched` (Bedingung `updatedAt` weg → der Test „geänderter Eintrag
  bleibt“ wird rot), `printoutFits` (Ergebnis nicht verglichen → rot). Geänderte Dateien vorher per `cp` sichern.
- Kein neuer Lauf der Skriptprüfung nötig (keine neue Oberfläche); die Sichtprüfung in Aufgabe 8.3 belegt die
  Anzeige übernommener Daten.

## Verification

- `pnpm check` grün im Worktree; `node .claude/vault-lint.mjs` grün; `scripts/consistency-check.sh` grün.
- Bericht `reports/2026-10-29-tis-3a-validate.md` mit: Zahlen der Probeläufe aller 9 Zeilen gegen die Tabelle im
  Kontext, Prüfbestand des Users ohne Befund, zweiter Lauf ohne Änderung (Zeilen je Tabelle vorher/nachher), Exit-Codes
  der Abbrüche, Screenshots.
- `reports/2026-10-29-tis-3a-review.md` aus `/review`.
- Nicht belegt bleibt, bis 3b: der Lauf auf dem VPS, die Zuordnungsdatei als Ganzes, `status`.
