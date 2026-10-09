---
id: src-ssmdb2-abend-2026-10-09
type: source
title: "Abend-Mitschnitt der SSMDB2 im Trainingsbetrieb, 9. Oktober 2026"
retrieved: 2026-10-09
keywords: [abend-mitschnitt, sp-0.6, messung, trainingsabend, lebenszeichen, heartbeat, zerrissener snapshot, torn read, neustart der probe, probe gelöscht, uhr je stand, anzeigeart, wertungsmodus, toleranz, 10 µm, hüllkreis, trefferkreis, trefferlage, gegenprobe, disziplin-katalog, latenz]
relates_to: ["[[meyton-ssmdb2]]", "[[spiegel-edge-cases]]", "[[ssmdb2-erkundung]]", "[[meyton-printout]]"]
---

**TL;DR** Mitschnitt der SSMDB2 an einem echten Trainingsabend (18:57 bis 19:48, 17 Scheiben, 640 verschiedene Schüsse, 1.543 Stände im Sekundentakt) mit der Phase `abend` von [[ssmdb2-erkundung]], dazu ein Meyton-Ausdruck derselben Anlage. Belegt: Probe wird beim Umschalten und beim Neustart gelöscht, Lesungen können für einen Durchgang zerrissen sein, `Scheiben.Zeitstempel` ist ein Lebenszeichen, Zeitstempel kommen von der Uhr des Stands, Meyton wertet jede Grenze 10 µm großzügiger. Die Rohdaten liegen nur auf dem Mac des Users (`~/ssmdb2-erkundung/2026-10-09_1857/`), nie im Repo ([[adr-029]]).

## Herkunft

- **Anlage:** ShootMaster 6.0.2, MariaDB 10.6.20 (`@@version_comment` „MariaDB package“), Systemzeitzone CEST, Uhr des Servers 24 ms vor dem Mac.
- **Lesen:** jede Sekunde eine Read-only-Transaktion über `Scheiben`, `Serien`, `Treffer` aller Scheiben mit einer Änderung in den letzten 90 Minuten; Abfragen rund 60 ms über der Grundlast des Docker-Clients, kein einziges Mal gedrosselt. Das Netz über `Treffer.Zeitstempel` war aus; ob wegen eines Vollscans laut `EXPLAIN` oder weil `EXPLAIN` nicht lesbar war, hält das Protokoll nicht fest.
- **Ausdruck:** eigene Scheibe des Users auf Stand 9 (LP 40 alt), PDF über den QR-Code, `ID: 1a2b3c4d`.
- Checkliste und Kopie (SP-0.1) liefen an diesem Abend nicht; Engine und Indizes sind deshalb weiter offen.

## Befunde

1. **Probe ist der Normalfall:** 13 der 17 Scheiben hatten keinen Wertungsschuss, bis zu 60 Probeschüsse; Wertung nur auf 3 Scheiben, eine davon nach 10 von 40 abgebrochen und auf einer neuen ScheibenID fortgesetzt.
2. **Umschalten löscht die Probe:** Mit dem ersten Wertungsschuss verschwinden alle Probeschüsse im selben Lesevorgang (5 → 0 bei Wertung 1).
3. **Neustart der Probe löscht die alte Probe:** fünfmal beobachtet (2, 8, 17, 25, 48 Schüsse verloren). Die ScheibenID bleibt, die Nummern beginnen wieder bei 1, die alten Schüsse tauchen unter keiner ScheibenID wieder auf (Suche über den Fingerabdruck aus Lage, Zeitstempel und Millisekunden). Der Neustart greift mit dem ersten neuen Schuss.
4. **Zerrissene Lesungen:** 16 Lesungen zeigten Schüsse nicht, die eine Lesung später wieder da waren, teils alle (Probe 38 → 0, Wertung 60 → 0, die eigene Scheibe kurz 36 → 3), auch bei Scheiben, die schon fertig waren. Jede dauerte genau eine Lesung.
5. **Lebenszeichen:** `Scheiben.Zeitstempel` steigt alle 5 bis 10 s, solange der Stand belegt ist, auch ohne Schuss und in der Probe; es endet beim Freigeben des Stands, 16 s bis 17,5 min nach dem letzten Schuss. Danach änderte sich keine Scheibe mehr. Eine reine Probe stand 44 min nach dem Freigeben noch vollständig in der Ablage.
6. **Zeitstempel kommen vom Stand:** Die Treffer von Stand 20 lagen über alle 51 Schüsse konstant 663 s hinter der Beobachtung (Streuung unter einer Sekunde), Lebenszeichen ebenso: Die Uhr dieses Stands geht 11 Minuten nach. An den übrigen Ständen lag die Latenz vom Schuss bis zur Sichtbarkeit bei 0,5 bis 1,0 s im Median, höchstens 1,7 s.
7. **Anzeigeart schreibt um:** Schaltet der Schütze die Anzeige am Monitor um, ändern sich `Treffer.Wertung` und `Text` für ganze Serien oder die ganze Scheibe auf einmal (beobachtet 1, 2, 3, 8, 9, 11); Ring, Zehntel, Lage und Teiler bleiben. Die eigene Scheibe stand zuletzt auf Modus 2 (ganze Ringe), der Ausdruck zeigt trotzdem Zehntel.
8. **Felder:** `Startzeit` immer `0000-00-00`, `Status` leer, `Starterliste` „Direktbelegung“ oder leer; `Serien` hat auch Zeilen für die Probe (Stellung 0, in Zehnerserien); `Treffer.Ring`, `Ring01`, `TotalRing`, `TotalRing01` stehen in Zehnteln, `Serien.Ring` in ganzen Ringen, `Serien.Ring01` in Zehnteln; `Teiler01` ist der Abstand in µm (PDF-Teiler × 10), `Teiler001` in 0,1 µm; x und y in 1/100 mm.
9. **Wertung:** Mit Grenzen, die 10 µm weiter außen liegen als nach Regel, und einem Abstand, der die Grenze nicht erreichen darf (strikt), stimmen alle 640 Zehntelwerte und Innenzehner, gleich ob aus der Lage (1/100 mm) oder aus `Teiler001` gerechnet. Ohne die 10 µm wertet `shot-core` 15 Schüsse ein Zehntel niedriger. Zulässig ist eine Verschiebung von 9,3 bis 10,0 µm (LG) bzw. 7,6 bis 11,9 µm (LP).
10. **Ausdruck gegen Ablage:** ID im Fuß = ScheibenID (`1a2b3c4d` = 439041101). Alle 40 Zehntel, Innenzehner, Serien, Ergebnis, beste Teiler und der Kopf stimmen. Trefferkreis = kleinster Hüllkreis um die Schussmitten plus Kaliber 4,5 mm, auf 1/100 mm gerundet (alle fünf Werte). Trefferlage = Schwerpunkt, auf 1/100 mm **abgeschnitten** (5,756 → 5,75); „Weiteste“ = Teiler, auf ganze Zahlen abgeschnitten. „initialisiert“ ist der Wechsel auf Wertung, nicht der erste Probeschuss; die Zeit im Kopf ist der letzte Schuss.
11. **Disziplinen:** Alle neun DisziplinIDs des Abends (10110020, 10110040, 10111030, 10210040, 10211030, 19110040, 19110060, 19210040, 19210060) löst `shot-core` über den Katalog richtig auf, samt Anschlag, Soll-Schusszahl und Vollständigkeit.

## Umgang

Die Entscheidungen daraus stehen in [[adr-027]] (Änderung vom 9. Oktober 2026), die Fälle in [[spiegel-edge-cases]] (SF-71 bis SF-76, Nachträge bei SF-01, SF-03, SF-07, SF-10, SF-50, SF-51), die Feldkunde in [[meyton-ssmdb2]].
