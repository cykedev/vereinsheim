---
id: spiegel-assignment
type: concept
title: "Spiegel — Zuordnung von Scheiben zu Schützen"
aliases: [zuordnung, claim, scheibe-holen, fundbüro]
keywords: [zuordnung, claim, besitzer, meyton-qr, qr-code, ausdruck, pdf, scheibenid, sportpass, schützenliste, frei getippte namen, fundbüro, scheibe holen, check-in, stand-aufkleber, admin, konflikt, das war ich, frist, auswärts, erste scheibe bestätigen, nicht meine, mehrdeutige sportpassid, überlauf, zwischenstand, gäste-lan]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-028]]"]
relates_to: ["[[meyton-printout]]", "[[spiegel-bridge]]", "[[spiegel-privacy]]", "[[spiegel-edge-cases]]"]
---

**TL;DR** Meyton kennt Schützen über Namen, SportpassID und Startnummer, Spiegel kennt Konten. Standard ist das **Opt-in per Sportpass**: Wer seine Sportpassnummer einmal verknüpft und zustimmt, dessen Scheiben lädt die Brücke noch am Trainingsabend automatisch hoch. Für alles andere gibt es den **QR-Code des Meyton-Ausdrucks** (ID im PDF → genau diese Scheibe) und **„Scheibe holen“**. Hochgeladen wird erst, wenn ein Besitzer feststeht. An jeder Scheibe steht, auf welchem Weg sie zum Konto kam.

## Wege

| Weg | Wann | Ablauf | Sicherheit |
|---|---|---|---|
| Opt-in per Sportpass (Standard) | Starter aus der Schützenliste mit SportpassID (nicht bei allen gepflegt; für Interessierte pflegt der Admin sie in der Meyton-Schützenverwaltung nach) | einmal im Profil eintragen und zustimmen, Admin bestätigt; die Brücke lädt jede passende Scheibe live am Abend hoch, auch rückwirkend | hoch |
| Meyton-QR | ohne Sportpass, Training ohne Starter, auswärts; bis eine Woche danach. Den QR gibt es zu jedem Ausdruck | Meyton zeigt den QR am Stand; in Spiegel scannen oder Link einfügen; Spiegel lädt und speichert das PDF, liest die ID, die Brücke holt die Scheibe; Vorschau, bestätigen. Bei einer schon vorhandenen Scheibe hängt der Scan nur das PDF an | hoch |
| „Scheibe holen“ (Fundbüro) | QR verloren oder Link abgelaufen (selten) | Stand und Zeitraum wählen; Spiegel fragt die Brücke nach Scheiben ohne Besitzer; Vorschau, bestätigen | mittel, mit Protokoll |
| Admin | Korrekturen, Sammelzuweisung nach dem Training | zuweisen und umhängen, mit Protokoll | hoch |

Frei getippte Namen (bei euch neben der Schützenliste üblich) ergeben nur **Vorschläge**, nie eine automatische Zuordnung. LANA mit Starterkarten nutzt ihr nicht; käme es dazu, wäre es ein weiterer automatischer Weg.

## Opt-in per Sportpass

- Der Schütze trägt im Profil seine Sportpassnummer ein und stimmt dem automatischen Hochladen zu; ein Admin bestätigt die Verknüpfung einmal. Dabei sieht er, unter welchem Namen die SportpassID in der SSMDB2 vorkommt; eine Nummer von einem liegengelassenen Ausdruck reicht damit nicht (SF-34).
- Spiegel gibt der Brücke eine Liste gehashter SportpassIDs der Zustimmenden. Jede Scheibe mit passender SportpassID lädt die Brücke **während des Abends** hoch, Probe eingeschlossen, ohne dass jemand etwas tun muss.
- Rückwirkend (SP-2.5): Nach der Verknüpfung lädt die Brücke ältere Scheiben mit dieser SportpassID nach, nach einer Vorschau. Meyton kopiert die SportpassID beim Schießen in die Scheibe; eine später nachgepflegte Nummer steht deshalb nicht in alten Scheiben. Die schlägt Spiegel über den Namen vor, und der Schütze bestätigt (SF-36).
- Voraussetzung ist, dass der Name am Stand aus der Schützenliste gewählt wird. Frei getippte Namen tragen keine SportpassID; dann hilft der QR.
- Das Original-PDF fehlt auf diesem Weg, solange es nicht auch auf der Meyton-Freigabe liegt (Phase 0). Wer es haben will, scannt den QR; Spiegel hängt es an die vorhandene Scheibe.
- **Erste Scheibe bestätigen:** Die erste automatisch zugeordnete Scheibe legt Spiegel dem Schützen vor („Dienstag, Stand 6, 19:12, deine?“). Erst danach läuft das Opt-in ohne Rückfrage. So fällt eine vertippte oder vertauschte SportpassID auf, bevor fremde Scheiben im Konto landen (SF-34).
- **Keine Automatik bei mehrdeutiger SportpassID:** Kommt eine SportpassID in der SSMDB2 mit verschiedenen Namen vor (Tippfehler in der Schützenverwaltung oder Überlauf langer Nummern im Feld `int(11)`), ordnet Spiegel sie nicht automatisch zu und meldet es dem Admin. Gesperrt sind außerdem 0, leer und 2147483647; vor dem Hashen wird die Nummer normalisiert (SF-35).
- **„Nicht meine“:** Wählt jemand am Stand den falschen Namen, landet seine Scheibe automatisch im fremden Konto. Ein Tipp auf „Nicht meine“ nimmt sie sofort heraus und legt sie dem Admin vor; findet sich kein Besitzer, wird sie gelöscht und bekommt einen Grabstein, den auch die Brücke kennt, damit der nächste Abgleich sie nicht wieder hochlädt (SF-28, SF-37).
- Ein Konto kann mehrere SportpassIDs haben, etwa nach einem neuen Ausweis (SF-39).

## Der QR-Weg im Detail

1. Scan in Spiegel (Kamera) oder Link einfügen. Erlaubt sind nur die in der Konfiguration hinterlegten Meyton-Adressen (heute `qrcode.meyton.eu` und eine feste IP), nie private Netze, nur PDF, ohne Weiterleitungen (SF-47). Die Größengrenze ist eng: Ein Ausdruck hat rund 40 KB, und in Treffsicher hat ein 3,2-MB-PDF schon 665 MB Speicher belegt (SF-48). Das Format beschreibt [[meyton-printout]].
2. Spiegel speichert das PDF sofort (Meyton hält es nur eine Woche) und liest Kopf und Fuß: ID, Stand, Zeiten, Werte, #Nummer.
3. Die ID im Fuß wird als vorzeichenbehaftete 32-Bit-Zahl dekodiert (`ff914420` → −7257056) und als Auftrag an die Brücke gegeben ([[spiegel-bridge]]). Die Brücke liefert zuerst nur eine Vorschau: Stand, Beginn, Disziplin, Schusszahl und Zehntelwerte, ohne Namen und ohne Lage.
4. Gegenprobe: Werte im PDF gegen die Vorschau. Erst wenn sie passen, holt Spiegel die ganze Scheibe; so verlassen bei einer falschen ID oder alten Epoche keine fremden Rohdaten das Schützenhaus (SF-41). Der Link ist nur HTTP, deshalb ist das Pflicht. Ein Ausdruck kann ein Zwischenstand sein; dann müssen die PDF-Werte den Anfang der Scheibe treffen, nicht die ganze (SF-42). Mehrere Ausdrucke derselben Scheibe hängen alle an ihr (SF-43).
5. Vorschau mit PDF, Bestätigen. Steht im PDF eine #Nummer, die zu einem anderen Konto gehört, geht die Anfrage an den Admin.

Ohne bestätigte ID (offen bis SP-0.2) sucht die Brücke über Uhrzeit, Stand und Schussfolge; das ist praktisch ebenso eindeutig.

**Brücke aus:** Anlage und Brücke werden nach dem Training ausgeschaltet. Scannst du den QR später, zum Beispiel zu Hause, legt Spiegel sofort ein Ergebnis aus dem PDF an und stellt den Auftrag zurück; beim nächsten Einschalten holt die Brücke die Rohdaten nach, und die Scheibe wird vollständig.

Auswärts, ohne Brücke, legt derselbe Scan ein **Ergebnis ohne Rohdaten** aus dem PDF an (Serien, Schusswerte, Teiler, Trefferlage); das PDF bleibt dabei.

## Fundbüro: Scheiben ohne Besitzer

Scheiben ohne bekannten Besitzer bleiben im Schützenhaus, bis jemand sie abholt. Abgeholt wird über „Scheibe holen“ in Spiegel: Spiegel fragt die Brücke, die nur Vorschau-Angaben (Stand, Uhrzeit, Disziplin, Ergebnis, kleines Trefferbild, keine Namen) zurückgibt; die Schüsse kommen erst nach der Bestätigung. Das **braucht kein Display und kein Tablet** am Stand, geht aber nur, **solange die Brücke läuft**, also am Trainingsabend. Danach bleibt der QR-Weg.

Eine Fundbüro-Seite auf der Brücke selbst entfällt: Die Schützen sind im Gäste-LAN und erreichen das Gerätenetz mit Anlage und Brücke nicht (Stand 5. Oktober 2026, [[spiegel-bridge]]).

Den QR gibt es laut Verein immer, auch ohne Starter. Das Fundbüro ist deshalb nur ein seltener Rückfall (QR verloren, Link abgelaufen), ohne Tablet, Frist sieben Tage. Offen ist nur, ob Trainings ohne Starter überhaupt in der SSMDB2 landen (Phase 0); sonst gibt es für sie nur das Ergebnis aus dem PDF.

## Wann zugeordnet wird

| Zeitpunkt | Wie | Aufwand | Live möglich |
|---|---|---|---|
| Vorher | optional: Check-in per Stand-Aufkleber („ich schieße jetzt auf Stand 6“) oder Belegungsplan der Trainerin | ein Scan | ja |
| Während | Opt-in per Sportpass (SportpassID aus der Schützenliste) | keiner | ja |
| Danach | Meyton-QR (Rohdaten sofort oder beim nächsten Einschalten), am Abend auch „Scheibe holen“, innerhalb der Frist | ein Scan, eine Bestätigung | nein |
| Später | SportpassID nachträglich verknüpft → Nachladen, soweit die SSMDB2 es hat | einmalig | nein |

Ein Check-in gilt, bis man sich abmeldet, jemand anderes am selben Stand eincheckt oder drei Stunden vorbei sind. Steht in Meyton ein Name, der zu einem anderen Konto gehört, gewinnt Meyton.

## Regeln

- Abholbar sind nur Scheiben ohne bekannten Besitzer; sonst „Das war ich“ als Anfrage an Besitzer oder Admin.
- Frist: sieben Tage nach dem letzten Schuss (einstellbar). Danach bleibt die Scheibe nur in der SSMDB2.
- Wer zuerst bestätigt, bekommt die Scheibe; ein zweiter Anspruch geht an den Admin.
- Abholen ist umkehrbar; jede Zuordnung wird protokolliert.
- Haben zwei Schützen nacheinander auf derselben Scheibe geschossen, lässt sie sich an einer Schussnummer teilen (SF-12).
- Wer den QR hat, kann die Scheibe holen, wie mit einem Papierausdruck. Dagegen helfen Protokoll, Umkehr und „Das war ich“ (SF-40).
