---
id: spiegel-assignment
type: concept
title: "Spiegel — Zuordnung von Scheiben zu Schützen"
aliases: [zuordnung, claim, scheibe-holen, fundbüro]
keywords: [zuordnung, werte vom ausdruck, vorbelegung, schuss für schuss, printedshotsfit, printout-import, claim, kamera-scan, scheibe holen, holen, scan, qr scannen, link einfügen, pdf hochladen, id eintippen, neue scheibe, wartet auf die anlage, passt nicht zum ausdruck, printMismatch, nicht mehr holen, teilen, druckzeit, metadaten, layout-unabhängig, besitzer, meyton-qr, qr-code, ausdruck, pdf, scheibenid, sportpass, schützenliste, frei getippte namen, fundbüro, scheibe holen, check-in, stand-aufkleber, admin, konflikt, das war ich, frist, auswärts, erste scheibe bestätigen, nicht meine, mehrdeutige sportpassid, überlauf, zwischenstand, gäste-lan]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-028]]"]
relates_to: ["[[meyton-printout]]", "[[spiegel-bridge]]", "[[spiegel-privacy]]", "[[spiegel-edge-cases]]"]
---

**TL;DR** Meyton kennt Schützen über Namen, SportpassID und Startnummer, Spiegel kennt Konten. Standard ist das **Opt-in per Sportpass**: Wer seine Sportpassnummer einmal verknüpft und zustimmt, dessen Scheiben lädt die Brücke noch am Trainingsabend automatisch hoch. Für alles andere gibt es die Seite **„Scheibe holen“** (`/scan`): QR-Code des Meyton-Ausdrucks, eingefügter Link, ein PDF oder die eingetippte ID, jeder Weg gleich. Das Fundbüro (SP-2.4, später) heißt nur noch Fundbüro. Hochgeladen wird erst, wenn ein Besitzer feststeht. An jeder Scheibe steht, auf welchem Weg sie zum Konto kam.

## Wege

| Weg | Wann | Ablauf | Sicherheit |
|---|---|---|---|
| Opt-in per Sportpass (Standard) | Starter aus der Schützenliste mit SportpassID (nicht bei allen gepflegt; für Interessierte pflegt der Admin sie in der Meyton-Schützenverwaltung nach) | einmal im Profil eintragen und zustimmen, Admin bestätigt; die Brücke lädt jede passende Scheibe live am Abend hoch, auch rückwirkend | hoch |
| „Scheibe holen“ (gebaut, 1b-2) | ohne Sportpass, Training ohne Starter, auswärts; den QR gibt es zu jedem Ausdruck, der Link gilt eine Woche | auf `/scan` den QR scannen, den Link einfügen, ein PDF hochladen oder die ID mit Tag eintippen; liegt die Scheibe schon in Spiegel, öffnet sie sich (ein PDF hängt an), sonst Disziplin und Art wählen, die Scheibe entsteht sofort und die Brücke füllt sie; geprüft wird automatisch (Abend, mit PDF die Druckzeit), ohne Vorschau | hoch mit PDF, mittel bis hoch getippt (siehe unten) |
| Fundbüro | QR verloren oder Link abgelaufen (selten) | Stand und Zeitraum wählen; Spiegel fragt die Brücke nach Scheiben ohne Besitzer; Vorschau, bestätigen | mittel, mit Protokoll |
| Admin | Korrekturen, Sammelzuweisung nach dem Training | zuweisen und umhängen, mit Protokoll | hoch |

Frei getippte Namen (bei euch neben der Schützenliste üblich) ergeben nur **Vorschläge**, nie eine automatische Zuordnung. LANA mit Starterkarten nutzt ihr nicht; käme es dazu, wäre es ein weiterer automatischer Weg.

## Opt-in per Sportpass

- Der Schütze trägt im Profil seine Sportpassnummer ein, liest den Hinweistext und stimmt mit einem Haken zu; ein Admin bestätigt die Verknüpfung einmal. Eintragen kann nur der Schütze, der Admin bestätigt, lehnt ab oder entfernt; ein Admin bestätigt auch eine eigene Zustimmung (Admins gelten als vertrauenswürdig). Den Namen aus der SSMDB2 sieht Spiegel vor der ersten Scheibe nicht (Datensparsamkeit); der Admin prüft die Nummer deshalb in der Meyton-Schützenverwaltung, und die Bestätigung der ersten Scheibe fängt den Rest (SF-34).
- **Zustände** (`consentStatus`): wartet auf den Admin, aktiv (bestätigt), abgelehnt, zurück beim Admin (nach „Nicht meine“ bei der ersten Scheibe). Nur aktive gehen an die Brücke und ins Einlesen; eine Ablehnung geht allem vor. Gespeichert werden Zeitpunkt und Version des Hinweistexts (der Wortlaut steht unveränderlich im Code, [[spiegel-privacy]]). Eine Sportpassnummer je Konto; Konten, die schon mehrere haben, behalten sie.
- **Widerruf** im Profil, jederzeit: Danach lädt die Brücke nichts mehr (SF-38); hochgeladene Scheiben bleiben beim Schützen, er löscht sie selbst.
- Spiegel gibt der Brücke eine Liste gehashter SportpassIDs der Zustimmenden. Jede Scheibe mit passender SportpassID lädt die Brücke **während des Abends** hoch, ohne dass jemand etwas tun muss; in Spiegel steht sie wie am Ausdruck (bei Wertung ohne Probe, [[adr-027]]).
- Rückwirkend: Nach der Bestätigung lädt die Brücke ältere Scheiben mit dieser SportpassID nach, während geschossen wird in kleinen Portionen; eine Vorschau davor ist offen (SP-2.5). Meyton kopiert die SportpassID beim Schießen in die Scheibe; eine später nachgepflegte Nummer steht deshalb nicht in alten Scheiben. Die schlägt Spiegel über den Namen vor, und der Schütze bestätigt (SF-36).
- Voraussetzung ist, dass der Name am Stand aus der Schützenliste gewählt wird. Frei getippte Namen tragen keine SportpassID; dann hilft der QR.
- Das Original-PDF fehlt auf diesem Weg, solange es nicht auch auf der Meyton-Freigabe liegt (offen, SP-0.1). Wer es haben will, scannt den QR; Spiegel hängt es an die vorhandene Scheibe.
- **Erste Scheibe bestätigen:** Die erste automatisch zugeordnete Scheibe legt Spiegel dem Schützen vor („Dienstag, Stand 6, 19:12, deine?“). Erst danach läuft das Opt-in ohne Rückfrage. So fällt eine vertippte oder vertauschte SportpassID auf, bevor fremde Scheiben im Konto landen (SF-34). „Nicht meine“ dabei gibt der Scheibe einen Grabstein, und die Zustimmung geht zurück an den Admin. Bis zur Bestätigung legt das Einlesen jede neue Scheibe als wartend an (`Card.ownerPending`); sie steht nur in „Offen“, je SportpassID die älteste mit „und n weitere“. „Ja, meine“ macht alle Wartenden der Nummer sichtbar und setzt `firstCardConfirmedAt`. „Nicht meine“ entfernt alle Wartenden der Nummer samt Rohdaten (`purgeCards`), setzt Grabsteine und gibt die Zustimmung zurück (`returnedAt`); bis der Admin erneut bestätigt, lädt die Brücke unter dieser Nummer nichts. Kommt in derselben Sekunde ein Stapel, kann eine Scheibe noch einmal in „Offen“ stehen; ein zweites „Ja, meine“ löst sie. Ebenso bewusst offen: Ein Stapel, der beim „Nicht meine“ schon läuft, hat die Zustimmung zu seinem Beginn gelesen und kann noch eine *neue* wartende Scheibe derselben Nummer anlegen; sie steht dann in „Offen“, ein weiteres „Nicht meine“ entfernt sie. Was gerade entfernt wurde, kommt dagegen nie zurück: Die Ablage prüft Grabsteine unter derselben Sperre wie das Entfernen. Gruppiert wird je Anlage und SportpassID.
- **Keine Automatik bei mehrdeutiger SportpassID:** Kommt eine SportpassID in der SSMDB2 mit verschiedenen Namen vor (Tippfehler in der Schützenverwaltung oder Überlauf langer Nummern im Feld `int(11)`), ordnet Spiegel sie nicht automatisch zu und meldet es dem Admin. Gesperrt sind außerdem 0, leer und 2147483647; vor dem Hashen wird die Nummer normalisiert (SF-35).
- **„Nicht meine“:** Wählt jemand am Stand den falschen Namen, landet seine Scheibe automatisch im fremden Konto. Ein Tipp auf „Nicht meine“ nimmt sie sofort heraus und legt sie dem Admin vor; findet sich kein Besitzer, wird sie gelöscht und bekommt einen Grabstein, den auch die Brücke kennt, damit der nächste Abgleich sie nicht wieder hochlädt (SF-28, SF-37).
- Ein Konto hat eine Sportpassnummer. Nach einem neuen Ausweis (SF-39) widerruft der Schütze die alte Nummer und
  trägt die neue ein; die Scheiben bleiben beim Widerruf.

## Der QR-Weg im Detail

Spiegel hängt dabei nicht vom Layout des Meyton-PDFs ab ([[adr-028]], Änderung vom 6. Oktober 2026).

1. **Erfassen** auf der Seite „Scheibe holen“ (`/scan`, Mitte der Navigation): QR-Code mit der Kamera (natives
   `BarcodeDetector`, sonst `jsqr` auf einem Bild aus dem Video; ein Knopf „QR-Code scannen“, der ohne Kamerabild von
   selbst ein Foto öffnet und sagt warum), Link einfügen oder ein
   einzelnes PDF hochladen (alte Ausdrucke). Die Kamera gibt es nur über HTTPS oder `localhost`. Es gibt vorerst keine Liste erlaubter Adressen; es
   bleiben nur PDF, höchstens 1 MiB, 10 s und keine Weiterleitungen (SF-47, [[adr-028]], Nachtrag vom 26. Oktober
   2026). Ein Ausdruck hat rund 40 KB. Das Format beschreibt [[meyton-printout]].
2. **Speichern und lesen:** Spiegel liest ID und Druckzeit in einem kurzlebigen Kindprozess mit eigener Speicher- und
   Zeitgrenze (SF-48) und speichert das PDF als Original nach seiner sha256 im Upload-Volume (Meyton hält es nur eine
   Woche). Nur mit lesbarer ID und Druckzeit entsteht eine Datei. Ändert Meyton das Layout, ändert sich daran nichts
   (SF-46). Danach liest derselbe Kindprozess die Werte und das Trefferbild mit Selbstprüfung ([[meyton-printout]]
   „Werte lesen“, seit 1c); scheitern sie, gelten ID und Druckzeit trotzdem.
3. **Scheibe:** Liegt die eigene Scheibe des Abends schon in Spiegel, öffnet Spiegel sie und hängt nur das PDF an
   (SF-43); liegt sie in „Offen“, führt die Seite dorthin; im Papierkorb holt Spiegel sie zurück (nach 30 Tagen nicht
   mehr). Sonst fragt das Blatt „Neue Scheibe“ nach Disziplin (eingeordnete der eigenen Anlage) und Art, vorbelegt mit
   der Disziplin aus dem Kopf des Ausdrucks, wenn genau eine wählbare wörtlich so heißt, sonst mit der der jüngsten
   Scheibe. Ohne Bestätigung entsteht sofort eine Scheibe vom Ausdruck (Herkunft `pdf`, Beginn ist die Druckzeit) und
   öffnet sich: mit den Werten und Lagen vom Ausdruck und der Standnummer, wenn die Lesung stimmig ist und zum
   Scheibenbild der Disziplin passt („Scheibe mit den Werten vom Ausdruck angelegt.“), sonst ohne Werte („wartet auf
   die Anlage“). Mehrere Ausdrucke derselben Scheibe hängen alle an ihr; eine Scheibe vom Ausdruck ohne Brücke nimmt
   dabei die Werte des zuletzt gedruckten stimmigen.
   Ausdrückliches Holen hebt die eigene Löschsperre dieses Abends auf („Diese Scheibe hattest du gelöscht. Spiegel
   holt sie wieder.“); Grabsteine und Sperren anderer Konten bleiben („lässt sich nicht holen“).
4. **Auftrag und Prüfung:** An der Scheibe hängt ein Auftrag an die Brücke (`CardRequest.cardId`; ID als
   vorzeichenbehaftete 32-Bit-Zahl, `ff914420` → −7257056, und der Abend aus der Druckzeit). Beim Einlesen prüft
   Spiegel selbst, solange die Scheibe noch keine Rohdaten hat: gleicher Abend und ein Stand, der höchstens fünf
   Minuten nach der jüngsten Druckzeit begann (Druck und Stand an verschiedenen Rechnern, SF-29; verglichen wird die
   Wanduhr der Anlage, `wallTimeOfMs`). Hat die Scheibe Werte vom Ausdruck, prüft Spiegel zusätzlich Schuss für Schuss:
   Die Schüsse derselben Art (Probe oder Wertung, in Nummernfolge) müssen mit den Schüssen der Scheibe beginnen,
   Zehntel gleich, ohne Zehntel der Ring (`printedShotsFit`; ein Zwischenausdruck mit weniger Schüssen passt). Besteht
   kein Stand des Stapels beide Prüfungen, speichert Spiegel nichts von der Brücke und der Auftrag endet mit „passt
   nicht zum Ausdruck“ (`printMismatch`, SF-41: „Die Scheibe der Anlage begann nach dem Druck oder hat andere Werte.“);
   die Scheibe behält ihre Werte vom Ausdruck. Sonst füllt der jüngste
   Block, der vor dem Druck begann, genau diese Scheibe (neue Revision mit Lagen, Werten und Zeiten der Rohdaten,
   Herkunft dann gemessen); frühere Blöcke werden
   eigene Scheiben (SF-03, SF-72). Mit den Rohdaten gilt die Disziplin des Stands, die gewählte Art bleibt
   (`kindChoice`). Bei einem Zwischenausdruck hat die Scheibe danach mehr Schüsse (SF-42). Gehört die Scheibe laut
   SportpassID einem anderen Konto, geht die Zustimmung dieses Kontos vor.
5. **An der Scheibe:** Im Kasten „Diese Scheibe“ stehen die Zeilen „Ausdruck“ (ID, Druckzeit, PDF über
   `/api/printouts/<id>`, nur für den Besitzer) und „Von der Anlage“ (wartet, geholt und wird noch ergänzt, nicht
   gefunden, an diesem Tag nicht gefunden, passt nicht zum Ausdruck, lässt sich nicht holen, gehört zu einem anderen
   Konto, keine Antwort). „Nicht mehr holen“ und „Entfernen“ setzen den Auftrag auf zurückgezogen; Scheibe und PDF
   bleiben, die Scheibe heißt dann „ohne Werte“. Erneutes Holen legt einen neuen Auftrag an.
6. **Rückweg:** Eine falsche Scheibe löscht man (Papierkorb). Im Papierkorb bleibt ihr offener Auftrag (er zählt zur
   Grenze von zehn, die Brücke füllt die Scheibe weiter); holt man sie zurück und endete ihr Auftrag schon, wartet sie
   mit einem neuen wieder auf die Anlage. Eine Scheibe vom Ausdruck hinterlässt beim endgültigen Löschen keine Sperre;
   ihr offener Auftrag ist dann zurückgezogen.

Stand: gebaut (1b-1 Holen, Lesen, Speichern; 1b-2 die Seite, die Scheibe vom Ausdruck und die Prüfung beim Einlesen,
`apps/spiegel/src/lib/fetch-card/`; 1c Werte und Lagen vom Ausdruck, Vorbelegung der Disziplin, Prüfung Schuss für
Schuss, alte Ausdrucke einlesen). Keine neue Brücke.

**Ohne lesbare ID** oder ohne Druckzeit speichert Spiegel nichts. Eine Auswahl nach der Druckzeit ist verschoben;
bis dahin hilft die getippte ID oder später das Fundbüro.

**Bewusst offen:** Ein Ausdruck, an einem späteren Tag aus der Ablage gedruckt, endet mit „an diesem Tag nicht
gefunden“ (der Abend kommt aus der Druckzeit). Kommt zwischen Anlegen und erstem Stand über eine Zustimmung desselben
Kontos schon eine Scheibe der Brücke für denselben Block, füllt der Auftrag die Scheibe vom Ausdruck nicht; sie endet
nach 30 Tagen „ohne Antwort“.

**Brücke aus:** Anlage und Brücke werden nach dem Training ausgeschaltet. Scannst du den QR später, zum Beispiel zu
Hause, steht die Scheibe sofort mit ihrem PDF in Spiegel; die Rohdaten kommen beim nächsten Einschalten.

**Auswärts,** ohne Brücke, bleibt die Scheibe beim Ausdruck: mit seinen Werten und Lagen, wenn der Leser das Layout
kennt und die Selbstprüfung besteht; sonst bleibt das PDF ohne Werte angehängt, leise mit „Werte nicht lesbar“, und
ein späterer Leser liest es neu (SP-2.6). Passt eine stimmige Lesung nur nicht zur gewählten Disziplin, sagt die Zeile
„Werte passen nicht zur Disziplin“, und mit der passenden Disziplin übernimmt Spiegel sie. Fremde Anlagen sind an echten Ausdrucken noch nicht belegt.

## Getippte ID

Ein Weg der Seite „Scheibe holen“, ohne Scannen und ohne PDF (User, 24. Oktober 2026: „eine bekannte Scheiben-ID zu mir
importieren“; seit 1b-2 auf derselben Seite wie der QR):

1. **„ID eintippen“:** die ID wie im Fuß des Ausdrucks (`ID: ff914420`, acht Hex-Zeichen, `parseCardId`) und den Tag
   der Scheibe. Sie geht wie jeder Weg: Liegt die Scheibe schon da, öffnet sie sich; bei einem anderen Konto
   „gehört zu einem anderen Konto“; sonst entsteht nach der Wahl von Disziplin und Art eine Scheibe vom Ausdruck
   (Herkunft `pdf`, 12 Uhr des Tags, bis die Brücke den echten Beginn schreibt) mit Auftrag. Geprüft wird beim Einlesen
   nur der Abend. Höchstens zehn ungefüllte offene Aufträge je Konto; gefüllte warten nur noch auf „endgültig“. Ein
   Tippfehler ergibt eine Scheibe ohne Werte, die man löscht. Ältere Aufträge ohne Scheibe (vor 1b-2) stehen unter den
   Wegen, bis sie enden.
2. **Auftrag** (`CardRequest`): `GET /state` nennt ihn der Brücke (`requests`, ScheibenID und Abend). Die Brücke liest
   die ScheibenID beim nächsten Durchgang, auch während geschossen wird, und schickt sie ohne Zustimmung, wenn ihr
   Beginn auf den Abend fällt (vor 4 Uhr der Vortag, `filter.Evening`); sonst meldet sie „anderer Tag“ (`mismatch`).
   Verdeckte Wertung und gesperrte Scheiben bleiben im Schützenhaus ([[spiegel-bridge]]).
3. **Annehmen:** Spiegel prüft den Abend noch einmal und speichert sonst nichts; der Auftrag endet dann mit „an diesem
   Tag nicht gefunden“. Eine aktive oder wartende Zustimmung per Sportpass eines anderen Kontos geht vor („gehört zu
   einem anderen Konto“). Die Scheibe gehört dem Auftraggeber sofort, ohne „Offen“.
4. **Bis die Scheibe endgültig ist:** Der Auftrag bleibt offen („geholt, wird noch ergänzt“), damit weitere Schüsse
   und eine Korrektur am selben Abend nachkommen. Der Heartbeat schließt ihn, sobald die Scheibe gefüllt und endgültig
   ist (`finishRequests`); eine Scheibe vom Ausdruck ist von Anfang an endgültig, zählt aber erst mit Rohdaten.
5. **Ausgang** an der Scheibe (Zeile „Von der Anlage“, siehe oben): Den Ausgang meldet die Brücke im Heartbeat
   (`requestsDone`) oder das Einlesen; nach 30 Tagen ungefüllt `expired`, gefüllt erledigt. Die Liste der Aufträge im
   Profil ist entfallen.

„Nicht gefunden“ meldet die Brücke, sobald die ID in der ersten Runde nach dem Auftrag nicht in der Ablage steht oder
die Scheibe keine Treffer hat. Weil es zu jedem Ausdruck eine Scheibe in der Ablage gibt, heißt das in der Praxis: ein
Tippfehler, oder Meyton hat die Scheibe nicht mehr. Für eine Scheibe, die erst noch geschossen wird, taugt ein Auftrag
nicht (Ende zu Ende geprüft mit `pnpm --filter spiegel bridge-e2e`). Ein „nicht gefunden“ nach dem ersten Stand ändert
nichts mehr: Ein gefüllter Auftrag schließt nur, wenn die Scheibe endgültig ist.

Grenzen ([[spiegel-privacy]] „Restrisiko beim Holen per ID“): Ein Tippfehler in den mittleren Stellen der ID kann am
selben Abend die Scheibe eines anderen treffen; der Tag fängt das nicht. Dann hilft „Löschen“ (mit Sperre). Statt einer
Vorschau prüft der QR-Weg automatisch über die Druckzeit (SF-41, siehe „Der QR-Weg im Detail“). Ist die Scheibe endgültig, liest die Brücke sie nicht mehr von
selbst; eine spätere Korrektur der Standaufsicht kommt nur mit einer Zustimmung per Sportpass. Die Brücke braucht dafür die Version mit Aufträgen (vor Ort einspielen); eine ältere ignoriert
`requests`, und die Aufträge bleiben offen.

## Fundbüro: Scheiben ohne Besitzer

Scheiben ohne bekannten Besitzer bleiben im Schützenhaus, bis jemand sie abholt. Abgeholt wird später über das Fundbüro in Spiegel (SP-2.4, ein weiterer Weg auf der Seite „Scheibe holen“): Spiegel fragt die Brücke, die nur Vorschau-Angaben (Stand, Uhrzeit, Disziplin, Ergebnis, kleines Trefferbild, keine Namen) zurückgibt; die Schüsse kommen erst nach der Bestätigung. Das **braucht kein Display und kein Tablet** am Stand, geht aber nur, **solange die Brücke läuft**, also am Trainingsabend. Danach bleibt der QR-Weg.

Eine Fundbüro-Seite auf der Brücke selbst entfällt: Die Schützen sind im Gäste-LAN und erreichen das Gerätenetz mit Anlage und Brücke nicht (Stand 5. Oktober 2026, [[spiegel-bridge]]).

Den QR gibt es laut Verein immer, auch ohne Starter. Das Fundbüro ist deshalb nur ein seltener Rückfall (QR verloren, Link abgelaufen), ohne Tablet, Frist sieben Tage. Offen ist nur, ob Trainings ohne Starter überhaupt in der SSMDB2 landen (Phase 0); sonst gibt es für sie nur das Ergebnis aus dem PDF.

## Wann zugeordnet wird

| Zeitpunkt | Wie | Aufwand | Live möglich |
|---|---|---|---|
| Vorher | optional: Check-in per Stand-Aufkleber („ich schieße jetzt auf Stand 6“) oder Belegungsplan der Trainerin | ein Scan | ja |
| Während | Opt-in per Sportpass (SportpassID aus der Schützenliste) | keiner | ja |
| Danach | „Scheibe holen“ mit QR, Link, PDF oder ID (Rohdaten sofort oder beim nächsten Einschalten), später am Abend auch das Fundbüro, innerhalb der Frist | ein Scan, eine Wahl | nein |
| Später | SportpassID nachträglich verknüpft → Nachladen, soweit die SSMDB2 es hat (nach der Bestätigung, während geschossen wird in kleinen Portionen; „Offen“ zeigt dann die jüngste wartende Scheibe zur Kontrolle) | einmalig | nein |

Ein Check-in gilt, bis man sich abmeldet, jemand anderes am selben Stand eincheckt oder drei Stunden vorbei sind. Steht in Meyton ein Name, der zu einem anderen Konto gehört, gewinnt Meyton.

## Regeln

- Abholbar sind nur Scheiben ohne bekannten Besitzer; sonst „Das war ich“ als Anfrage an Besitzer oder Admin.
- Frist: sieben Tage nach dem letzten Schuss (einstellbar). Danach bleibt die Scheibe nur in der SSMDB2.
- Wer zuerst bestätigt, bekommt die Scheibe; ein zweiter Anspruch geht an den Admin.
- Abholen ist umkehrbar; jede Zuordnung wird protokolliert.
- Haben zwei Schützen nacheinander auf derselben Scheibe geschossen, lässt sie sich an einer Schussnummer teilen (SF-12).
- Wer den QR hat, kann die Scheibe holen, wie mit einem Papierausdruck. Dagegen helfen Protokoll, Umkehr und „Das war ich“ (SF-40).
- Bucht die Aufsicht eine Scheibe in Meyton auf einen anderen Schützen um, liest die Brücke sie neu (SF-80). Mit Zustimmung der neuen Nummer kommt sie an. Stand sie schon bei einem anderen Konto, hält Spiegel den neuen Stand zurück. Nach „Nicht meine“ sperrt der Grabstein die ganze ScheibenID. Beides ist offen ([[spiegel-roadmap]]).
