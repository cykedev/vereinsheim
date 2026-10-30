---
id: spiegel-account-transfer
type: operation
title: "Spiegel — Übernahme aus Treffsicher: Abgleich der Konten und Lauf je Konto"
aliases: [kontenabgleich, account-match, zuordnung-der-konten, übernahme-eines-kontos, account-transfer]
keywords: [runtransfer, decidecard, checktransfer, prüfbestand, geändertes bleibt, movedtospiegelat, umgezogen, --family, nodiscipline, unknownfamily, exit-code, probelauf, dry-run, ausdruck übernehmen, printoutfits, vorschau, treffsicher:preview-, entryfromsession, treffsicherdetails, übernahme, treffsicher, konten, e-mail, zuordnung, mapping, csv, transfer, verdacht, levenshtein, stufe 3, personendaten, reports]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-033]]", "[[adr-029]]", "[[adr-002]]"]
---

**TL;DR** `pnpm --filter spiegel transfer:accounts dev|prod` holt die Konten beider Apps als CSV (je Datenbank eine
Abfrage, keine Verbindung dazwischen) und schreibt nach `reports/tis-v1/` einen Bericht und einen Vorschlag der
Zuordnung `zuordnung-<Tag>.csv`. Diese Datei bearbeitet der User; sie ist der Vertrag mit dem CLI, das in Stufe 3 von
[[adr-033]] Konto für Konto übernimmt. Beide Dateien enthalten Namen und E-Mails und bleiben gitignored ([[adr-029]]).
Danach übernimmt `pnpm --filter spiegel transfer --from … --to …` ein Konto in einer Transaktion: Scheiben, Einträge,
Ziele, Abläufe, Ausdrucke und Belege, mit Prüfbestand und Bericht; wiederholbar, Geändertes bleibt.

## Gruppen

Die reine Funktion `matchAccounts` (`apps/spiegel/src/lib/transfer/accountMatch.ts`) ordnet jedes Treffsicher-Konto
genau einer Gruppe zu:

- **in beiden:** gleiche E-Mail ohne Groß- und Kleinschreibung; Abweichungen in Rolle und Aktiv-Status stehen im Bericht.
- **Verdacht:** keine gleiche E-Mail, aber ein freies Spiegel-Konto mit gleichem oder ähnlichem Namen (Abstand
  höchstens 2 ab sechs Zeichen, sortiert und in Reihenfolge der Wörter) oder gleichem Teil vor dem @.
- **nur Treffsicher:** das Konto entsteht bei der Übernahme mit seinem Passwort.

Ein über die E-Mail vergebenes Spiegel-Konto ist nie zusätzlich ein Verdacht. Zwei Konten einer App mit derselben
E-Mail brechen den Abgleich ab (die Meldung nennt nur die Zahl).

## Zuordnung als Datei

`from,to,status,reason`, eine Zeile je Treffsicher-Konto, bei einem Verdacht eine je Kandidat. `ok` geht an die gleiche
E-Mail, `check` an den Kandidaten (Merkmale in `reason`), `new` an die eigene E-Mail. `formatMappingCsv` und
`parseMappingCsv` schreiben und lesen sie (Fehler mit Zeilennummer). Was der Leser **nicht** prüft und das CLI aus
Stufe 3 deshalb selbst ablehnen muss: übrig gebliebene `check`-Zeilen und widersprüchliche Zeilen zu einem `from`.

## Übernahme eines Kontos

```
pnpm --filter spiegel transfer --from <E-Mail in Treffsicher> --to <E-Mail in Spiegel>
  [--dry-run] [--files <Ordner unter tools/private/>] [--family "<Name>=<Kennung der Familie>"]…
```

Nur gegen die lokale Dev-Datenbank (`assertDevDatabase`). Treffsicher liest `tools/transfer/source-dev.ts` über `psql`
im Dev-Container (`tools/transfer/treffsicher-account.sql`, eine Zeile JSON je Konto, keine Verbindung der App zur
fremden Datenbank, [[adr-002]]); `runTransfer` (`apps/spiegel/src/parts/transfer/run.ts`) bekommt die Quelle als
Schnittstelle (`TreffsicherSource`). `--files` zeigt auf die entpackten Dateien der Anhänge aus der Sicherung von
Treffsicher, nur unter `tools/private/`. Kennt das Hauptbuch Ausdrucke oder Belege, braucht jeder weitere Lauf
`--files` (sonst `filesMissing`): Ohne die Dateien kennt er ihre Prüfsummen nicht. Exit-Codes: 0 fertig, 1 Befund im Prüfbestand, 2 Aufruf falsch, 3 Abbruch,
4 Fehler (nichts geschrieben), 5 gespeichert, aber Ausgabe oder Bericht fehlt. Die Ausgabe hat nur Zahlen, Gründe und Namen von Disziplinen; der Bericht mit Tagen und
Texten der Stichprobe geht nach `reports/tis-3a/transfer-<Tag>-<acht Zeichen sha256 der E-Mail>.md` (gitignored, nie
E-Mail oder Passwort, [[adr-029]]).

### Schlüssel

`treffsicher:<Kennung>` an Scheibe (`Card.importKey`), Eintrag, Ziel und Ablauf (`src/parts/transfer/keys.ts`). Über ihn
findet ein zweiter Lauf, was er schon geschrieben hat. Die Schlüssel der früheren Vorschau (`treffsicher:preview-`,
`preview:`) zählen nie als übernommen.

### Abbrüche vor dem Schreiben

In dieser Reihenfolge, je mit festem Text im CLI: kein Konto in Treffsicher (`noSource`); Zeilen der Vorschau im Ziel
(`preview`, siehe unten); Übernommenes eines anderen Treffsicher-Kontos im Ziel (`foreignInTarget`); Übernommenes
dieses Kontos an einem anderen Spiegel-Konto (`sourceElsewhere`); Zeilen mit Schlüssel der Übernahme im Ziel, aber
kein Hauptbuch (`ledgerMissing`: Zeilen eines älteren Stands der Übernahme, der Lauf rät nicht, was davon geändert
ist; das gibt es nur in einer Dev-Datenbank: sie neu aus Prod holen oder die Zeilen mit Schlüssel `treffsicher:`
löschen); ein späterer Lauf ohne `--files`, obwohl das Hauptbuch Ausdrucke oder Belege kennt (`filesMissing`); `--family` mit unbekannter Kennung oder doppeltem
Namen (`badFamilyOption`); eine Disziplin aus Treffsicher ohne Familie (`unknownFamily`, Namen mit Zahl der Einheiten);
`--discipline` nennt eine Disziplin in Spiegel, die es unter den eingeordneten nicht genau einmal gibt, eine in einer
anderen Familie oder denselben Namen zweimal (`badDisciplineOption`); für eine neue Scheibe lässt sich keine Disziplin
wählen (`noDiscipline`, Familie, Schusszahl und Grund: Gleichstand oder keine Disziplin mit fester Schusszahl). Die
Familie gibt `--family` an, die Disziplin `--discipline "<Disziplin in Treffsicher>=<Disziplin in Spiegel>"`. Die
Option gilt nur für Einheiten, für die die Wahl nach Schusszahl keine findet: Eine Disziplin aus Treffsicher („Luftpistole“)
hat oft Einheiten mit verschiedener Schusszahl, die übrigen behalten ihre.

Die Wahl nach Schusszahl hat drei Stufen (entschieden mit dem User am 30. Oktober 2026): eine Disziplin der Familie mit
genau der Schusszahl der Einheit; sonst die mit der kleinsten größeren, die Scheibe ist dann unvollständig
(`unvollstaendig`, nicht `complete`: kein Rekord, ein Ziel über die ganze Scheibe lässt sie als „andere Schusszahl“
aus, der Fortschritt rechnet ohnehin je Schuss); sonst die mit der größten, die Scheibe hat dann mehr Schüsse als
geplant (`ueber-soll`, zählt als vollständig und für Rekorde ihrer Schusszahl). Passen auf einer Stufe mehrere gleich,
gilt die vom Konto meistgenutzte, bei Gleichstand bricht der Lauf ab. Der Bericht zählt die Einheiten je Stufe.

### Je Einheit

`decideCard` (`src/parts/transfer/decide.ts`, rein) gegen die Scheiben des Abends in der Familie, ohne die
übernommenen:

1. kein Training und kein Wettkampf → keine Scheibe; ohne Ergebnis → keine Scheibe;
2. keine Scheibe am Abend → **neu**, eine Scheibe „aus Treffsicher“;
3. passende Scheiben (nicht nur Probe, gleiche Schusszahl, gleiches Ergebnis in der Wertung von Treffsicher) →
   **vorhanden**, alle passenden werden verknüpft;
4. nur Scheiben „nur Probe“ → keine neue, der Abend leitet sie ab;
5. sonst **unsicher**: trotzdem neu, beide bleiben, der Bericht nennt den Fall (Abweichung von [[adr-033]], die
   Entscheidung steht dort im Nachtrag).

Ein Eintrag entsteht nur mit Inhalt fürs Tagebuch (`needsEntry`, mit dem User entschieden am 30. Oktober 2026):
Trainingsziel, Befinden, Prognose oder Feedback (die Zeile, auch nur mit Skalen), eine Reflexion mit Text, die
Ausführung einer Serie, Favorit; ohne Schießen immer. Eine Einheit nur mit Werten wird nur Scheibe: Werte, Ausdruck,
Belege, Ort und Trefferlage stehen dort. Eine Verknüpfung mit einem Ziel ist kein Grund, sie bestimmt weiter die Familie
des Ziels; das Ziel misst seine Scheiben selbst. Ein Eintrag aus einem früheren Lauf bleibt. Der Bericht zählt „nur
Werte, kein Eintrag“ (davon mit Ziel verknüpft, ohne eigene Scheibe).

Dazu der Eintrag (`entryFromSession`), die festen Verknüpfungen (eine Scheibe, die schon ein anderer Eintrag hält,
bleibt dort), die Ausführung je Serie (`executionsOnCard`, nur bei genau einer Scheibe mit gleicher Zahl Serien) und
die Anhänge:

- **Meyton-Ausdruck:** an die eigene Scheibe mit dieser ID am Abend des Drucks; sonst an die Scheibe der Einheit, und
  wenn sie aus Treffsicher ist und der Ausdruck passt (`printoutFits`: Lesung ok, gleicher Abend, gleiche Schusszahl,
  gleiches Ergebnis in der Wertung von Treffsicher), übernimmt sie seine Werte (Revision 2, Herkunft `pdf`); sonst wie
  „Scheibe holen“ eine Scheibe vom Ausdruck; nennt sein Kopf keine bekannte Disziplin, nimmt sie die der Einheit nach
  den Stufen (Schusszahl aus Treffsicher oder vom Ausdruck, ohne sie die eine Disziplin der Familie). Bleibt ein
  Ausdruck ohne Scheibe, ist das ein Befund im Prüfbestand (Exit 1), nie still. Ein Ausdruck im Modus Probe zählt dabei als Wertung, sein Ergebnis ist die
  Summe seiner Schüsse (`scoringReading`, entschieden mit dem User am 30. Oktober 2026): Treffsicher hat solche
  Abende als Training gewertet. Dieselbe Regel gilt, wenn Spiegel die Ausdrucke einer solchen Scheibe später neu
  anwendet (`applyPrintoutValues` an einer Scheibe mit Schlüssel `treffsicher:`), sonst würde sie dabei eine Scheibe
  nur aus Probe.
- **Foto oder gewöhnliches PDF:** Beleg an der Scheibe der Einheit, ohne Scheibe nur im Bericht.

Ausdruck und Beleg schreiben in der Transaktion der Übernahme (`importPrintoutIn`, `attachEvidenceIn`); gelesen
werden die Dateien vorher, der Leser der Ausdrucke läuft im Kindprozess. Ziele und Abläufe über
`goalFromTreffsicher`/`routineFromTreffsicher` (`src/diary/transfer/treffsicher-goal.ts`): Tage in der Zeitzone der
Anzeige, Familie nur, wenn die verknüpften Einheiten genau eine ergeben, Verknüpfungen außerhalb des Zeitraums im
Bericht; Schritte eines Ablaufs in ihrer Reihenfolge, ungültige als ein Schritt mit allen Texten.

Ein neues Konto bekommt Name, Passwort-Hash und Aktiv-Status aus Treffsicher, die Rolle Schütze und keinen verlangten
Passwortwechsel; beim ersten Lauf wird das Tagebuch eingeschaltet.

### Hauptbuch: geändert, gelöscht, nie platziert

Was ein Lauf schreibt, verzeichnet er in derselben Transaktion im Hauptbuch der Übernahme (`src/parts/transfer/ledger.ts`,
entschieden mit der koordinierenden Session am 30. Oktober 2026; eine Abweichung vom Plan „ohne Schema“): je Lauf, der
gespeichert hat, eine Zeile `TransferRun` (Zeit, Version der Regeln, Zahlen), je übernommenes Stück eine Zeile
`TransferItem` mit Art, Schlüssel aus Treffsicher, Kennung in Spiegel (nur Text, kein Fremdschlüssel) und dem Stand, den
der Lauf hinterließ. Die Schlüssel je Art stehen am Modell im Schema (`session:<Einheit>` für Scheibe und Eintrag einer
Einheit, `attachment:<Anhang>` für Ausdruck, Beleg und eine Scheibe, die ein Ausdruck anlegte, `goal:`, `routine:`,
`session:<Einheit>/card:<Scheibe>` für eine Verknüpfung). Der nächste Lauf entscheidet je Stück gegen das Hauptbuch:

- **Unverändert** steht ein Stück noch genau so da, wie verzeichnet: eine Zeile des Tagebuchs mit `updatedAt` gleich
  der Zeit, mit der der Lauf sie schrieb (ein Eintrag dazu mit genau den verzeichneten Verknüpfungen); eine Scheibe mit
  Herkunft `treffsicher`, derselben Revision, derselben Wahl (Disziplin, Art, Wertung, Stand, Ort), nicht geteilt, ohne
  eigenen Beleg (einer, der nicht aus Treffsicher stammt), nicht im Papierkorb. `updatedAt` einer Scheibe zählt nicht:
  Jobs (Nachrechnen, Projektion, Zustände) ändern die Zeile, schreiben an Scheiben aus Treffsicher aber keine Revision
  und keine Wahl. Unverändertes ersetzt der Lauf. Hat die Übernahme selbst die Werte eines passenden Ausdrucks
  übernommen, verzeichnet sie die Scheibe danach mit Herkunft `pdf`; so eine Scheibe ist unverändert, solange Herkunft
  und Wahl stimmen, auch mit einer neuen Revision (das Neulesen der Ausdrucke schreibt sie), und der Lauf lässt sie, wie
  sie ist.
- **Geändert, bleibt** ist alles andere, in jedem weiteren Lauf, denn das Hauptbuch behält für ein stehen gelassenes Stück
  den alten Stand. Werte (Befinden, Prognose, Feedback) und Ausführung stehen in eigenen Tabellen; ändert der Schütze sie
  in der App, setzt das `updatedAt` des Eintrags (`touch` in `src/diary/entries.ts`). Ist die Scheibe einer Einheit
  geändert und hat noch ihre Revision, bleibt die Ausführung auf ihr.
- **In Spiegel gelöscht** ist nur ein Stück, das im Hauptbuch steht und fehlt (ein Anhang: an der verzeichneten Scheibe
  keine Zeile mit seiner Prüfsumme). Kein Lauf legt es wieder an; der Bericht zählt es je Art. Kippt dadurch eine
  Entscheidung, entsteht auch keine Scheibe aus Treffsicher: Gelöscht ist gelöscht. Das gilt auch, wenn die Scheibe,
  mit der der letzte Lauf den Eintrag verknüpfte, gelöscht oder im Papierkorb ist, und für eine Scheibe einer Einheit,
  die zwischendurch eine andere hielt (sie bleibt im Hauptbuch, bis die Einheit in Treffsicher fehlt).
- **Nie platziert** ist, was nicht im Hauptbuch steht: Der nächste Lauf versucht es neu. Ein Ausdruck, der wieder nicht
  passt, bleibt ein Befund; ist die Ursache behoben (etwa eine Disziplin angelegt), kommt er an.

Was der Lauf vor der Transaktion las, kann beim Schreiben überholt sein: Dazwischen liest er die Anhänge, und die App
läuft daneben. Jeden Eintrag, jedes Ziel, jeden Ablauf und jede Scheibe, die er ändern oder löschen will, sperrt er
deshalb in der Transaktion und liest sie neu (Eintrag mit `FOR UPDATE`, Scheibe mit `lockCard`; erst der Eintrag der
Einheit, dann ihre Scheibe); was jemand dazwischen geändert hat, bleibt. Eine Änderung in der App, die erst danach
kommt, wartet auf die Sperre; das Tagebuch schreibt `Serializable` und meldet danach einen Fehler, die Änderung muss
noch einmal gespeichert werden.

Entfernt ein Lauf eine unveränderte Scheibe aus Treffsicher (die Einheit hat jetzt eine passende), nimmt er ihre
Ausdrucke, Belege und Verknüpfungen aus dem Hauptbuch: Sie hingen nur dort und gehen an die neue Scheibe. Hängt ein
Anhang noch an seiner verzeichneten Scheibe, legt ihn kein Lauf ein zweites Mal an eine andere (im Bericht „an der
verzeichneten Scheibe“). Gibt es einen Anhang in Treffsicher nicht mehr, geht er aus dem Hauptbuch, eine Scheibe, die
er anlegte, wie die einer verschwundenen Einheit. Ein Lauf je Konto zur Zeit: `write` nimmt eine Sperre des Kontos
(`pg_advisory_xact_lock`) und liest das Hauptbuch darunter neu.

Scheiben, die ein früherer Lauf aus einem Ausdruck dieses Kontos angelegt hat, stehen im Hauptbuch und zählen beim
Entscheiden nicht als Scheiben des Abends; sonst kippte ein Abend nur aus Probe zu „vorhanden“ oder zu „unsicher“ mit
einer zweiten Scheibe.

Der Export des Kontos enthält die Läufe (Zeit, Version, Zahlen), nicht die Stücke. Konto löschen nimmt beide Tabellen
über die Kaskade vom Konto mit. Nur `src/parts/transfer` liest und schreibt sie (`boundary.test.ts`).

### Merkmal „umgezogen“

Das Merkmal `movedToSpiegelAt` in Treffsicher ([[treffsicher-read-only]]) heißt nur noch „umgezogen“; was geändert
ist, sagt das Hauptbuch. Der letzte Schritt der Transaktion setzt es; der Probelauf setzt nichts. Scheitert danach das
Speichern in Spiegel, setzt der Lauf das alte Merkmal zurück (beim ersten Lauf: keins, sonst wäre das Konto in
Treffsicher nur lesend, ohne Daten in Spiegel). Geht auch das nicht, meldet das CLI „Übernahme in Spiegel nicht
gespeichert, das Merkmal in Treffsicher ist vielleicht gesetzt“ (Exit 3) und nennt den alten Wert.

### Prüfbestand

`checkTransfer` (`src/parts/transfer/check.ts`, rein) liest nach dem Schreiben in derselben Transaktion zurück: je
Einheit mit Ergebnis Ergebnis und Ø je Schuss vorher gleich nachher (Abweichungen nur erklärt: Abend nur Probe,
unsicher, Werte vom Ausdruck, geändert), je Tabelle Zahl vorher, nachher und Erklärung der Differenz, dazu eine
Stichprobe der fünf Einheiten mit den meisten Texten Feld für Feld. Jede unerklärte Abweichung ist ein Befund
(Exit 1).

### Zeilen der Vorschau

Das frühere Vorschau-Werkzeug des Tagebuchs schrieb nur in die Dev-Datenbank, mit Schlüsseln `treffsicher:preview-`
(Scheiben) und `preview:` (Tagebuch). Hat das Ziel noch solche Zeilen, bricht die Übernahme ab und nennt diese Sätze
SQL für die Datenbank von Spiegel (die Verknüpfungen zuerst, sie hängen an keiner Scheibe):

```sql
DELETE FROM "DiaryEntryCard" WHERE "cardId" IN (SELECT id FROM "Card" WHERE "importKey" LIKE 'treffsicher:preview-%');
DELETE FROM "DiaryEntry" WHERE "importKey" LIKE 'preview:%';
DELETE FROM "DiaryGoal" WHERE "importKey" LIKE 'preview:%';
DELETE FROM "DiaryRoutine" WHERE "importKey" LIKE 'preview:%';
DELETE FROM "Card" WHERE "importKey" LIKE 'treffsicher:preview-%';
```

### Zuordnungen

- **Scheibe** (`apps/spiegel/src/lib/transfer/treffsicher-card.ts`, rein): `familyForName` (Name der Treffsicher-Disziplin
  gleich dem der Familie, ohne Groß- und Kleinschreibung, genau eine; `--family` geht vor), `disciplineForShots`
  (Disziplin der ersten Anlage mit derselben Schusszahl, sonst die kleinste größere, sonst die größte; bei mehreren
  die meistgenutzte des Kontos, sonst keine),
  `treffsicherDetails` (Wertungsserien mit Wert neu nummeriert; Einzelschüsse nur, wenn jede Serie sie hat und ihre
  Summe zum Wert passt, sonst Serien-Summen; Probeserien als Probe; Trefferlage mit Richtung).
- **Eintrag** (`apps/spiegel/src/diary/transfer/treffsicher-entry.ts`, rein): `entryFromSession` (Abend, Art, Vorhaben aus
  Trainingsziel oder Leistungsziel, „Hat es geklappt?“ nur mit Vorhaben, Erkenntnis, Lernfrage, Notiz mit Überschriften
  je übrigem Feld, Werte genau wie gespeichert) und `executionsOnCard`. Geschrieben über `src/diary/transfer/write.ts`
  (anlegen oder über den Schlüssel ersetzen).

## Fallstricke

- Offen (für 3b): Trägt eine übernommene Scheibe zwei Ausdrucke, einen passenden (seine Werte wurden übernommen) und
  einen anderen, kann ein späteres Neulesen (neue Version des Lesers, andere Disziplin) mit `readingOrder` die Werte
  des anderen nehmen; `applyPrintoutValues` kennt den übernommenen nicht.

- Ein zweiter Lauf am selben Tag bricht ab, solange `zuordnung-<Tag>.csv` existiert: Sonst überschriebe er die
  Bearbeitung des Users. Umbenennen oder löschen, dann neu laufen lassen.
- `prod` läuft über `ssh` mit `VPS_HOST` und `VPS_REPO_PATH` aus `.vereinsheim.local` und nur durch den User.
- Spalten der SQL und des Parsers sind über feste Listen gekoppelt: Eine umbenannte Spalte ist ein Fehler, keine
  stille 0.
- Ein Abend nur aus Probe oder eine Einheit ohne Ergebnis mit Meyton-Ausdruck: Lauf 1 legt die Scheibe vom Ausdruck
  an. Passt sie nicht zum Ergebnis in Treffsicher, sähe Lauf 2 sie als unsicher und legte eine Scheibe „aus
  Treffsicher“ daneben. In den Daten der Probe kam der Fall nicht vor.
- Die Ausdrucke des Users in Treffsicher sind beide im Modus Probe gedruckt (kein Gesamtergebnis). Sie geben Werte erst
  seit der Regel „Summe der Schüsse“ (`scoringReading`, 30. Oktober 2026).
- Faustregeln über Zeiten (`updatedAt` gegen das Merkmal, „eine Zeit, die mehrere Zeilen teilen“, „fehlt heißt
  gelöscht“) kosten still Daten: ein Merkmal, das weiterrückt, ein Konto ohne geschriebene Zeile, ein Ausdruck, der
  erst später passt. Deshalb das Hauptbuch (Reviews vom 30. Oktober 2026).
- In der ersten Anlage gibt es „LP 60“ und „LP 60 alt“, „LG 60“ und „LG 60 alt“ mit derselben Schusszahl: Ohne eigene
  Scheiben im Konto ist das ein Gleichstand, `--discipline` wählt.
