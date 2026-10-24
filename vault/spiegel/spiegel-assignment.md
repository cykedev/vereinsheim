---
id: spiegel-assignment
type: concept
title: "Spiegel — Zuordnung von Scheiben zu Schützen"
aliases: [zuordnung, claim, scheibe-holen, fundbüro]
keywords: [zuordnung, claim, kamera-scan, teilen, druckzeit, metadaten, layout-unabhängig, besitzer, meyton-qr, qr-code, ausdruck, pdf, scheibenid, sportpass, schützenliste, frei getippte namen, fundbüro, scheibe holen, check-in, stand-aufkleber, admin, konflikt, das war ich, frist, auswärts, erste scheibe bestätigen, nicht meine, mehrdeutige sportpassid, überlauf, zwischenstand, gäste-lan]
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
| ID vom Ausdruck (gebaut, 24. Oktober 2026) | ohne Sportpass, wenn der QR nicht zur Hand ist, aber der Ausdruck | im Profil die ID aus dem Fuß und den Tag eintippen; die Brücke holt genau diese Scheibe, Spiegel nimmt sie nur an, wenn ihr Beginn auf den Tag fällt | mittel bis hoch (siehe unten) |
| „Scheibe holen“ (Fundbüro) | QR verloren oder Link abgelaufen (selten) | Stand und Zeitraum wählen; Spiegel fragt die Brücke nach Scheiben ohne Besitzer; Vorschau, bestätigen | mittel, mit Protokoll |
| Admin | Korrekturen, Sammelzuweisung nach dem Training | zuweisen und umhängen, mit Protokoll | hoch |

Frei getippte Namen (bei euch neben der Schützenliste üblich) ergeben nur **Vorschläge**, nie eine automatische Zuordnung. LANA mit Starterkarten nutzt ihr nicht; käme es dazu, wäre es ein weiterer automatischer Weg.

## Opt-in per Sportpass

- Der Schütze trägt im Profil seine Sportpassnummer ein, liest den Hinweistext und stimmt mit einem Haken zu; ein Admin bestätigt die Verknüpfung einmal. Eintragen kann nur der Schütze, der Admin bestätigt, lehnt ab oder entfernt; ein Admin bestätigt auch eine eigene Zustimmung (Admins gelten als vertrauenswürdig). Den Namen aus der SSMDB2 sieht Spiegel vor der ersten Scheibe nicht (Datensparsamkeit); der Admin prüft die Nummer deshalb in der Meyton-Schützenverwaltung, und die Bestätigung der ersten Scheibe fängt den Rest (SF-34).
- **Zustände** (`consentStatus`): wartet auf den Admin, aktiv (bestätigt), abgelehnt, zurück beim Admin (nach „Nicht meine“ bei der ersten Scheibe). Nur aktive gehen an die Brücke und ins Einlesen; eine Ablehnung geht allem vor. Gespeichert werden Zeitpunkt und Version des Hinweistexts (der Wortlaut steht unveränderlich im Code, [[spiegel-privacy]]). Eine Sportpassnummer je Konto; Konten, die schon mehrere haben, behalten sie.
- **Widerruf** im Profil, jederzeit: Danach lädt die Brücke nichts mehr (SF-38); hochgeladene Scheiben bleiben beim Schützen, er löscht sie selbst.
- Spiegel gibt der Brücke eine Liste gehashter SportpassIDs der Zustimmenden. Jede Scheibe mit passender SportpassID lädt die Brücke **während des Abends** hoch, ohne dass jemand etwas tun muss; in Spiegel steht sie wie am Ausdruck (bei Wertung ohne Probe, [[adr-027]]).
- Rückwirkend: Nach der Bestätigung lädt die Brücke ältere Scheiben mit dieser SportpassID nach, nur wenn niemand schießt; eine Vorschau davor ist offen (SP-2.5). Meyton kopiert die SportpassID beim Schießen in die Scheibe; eine später nachgepflegte Nummer steht deshalb nicht in alten Scheiben. Die schlägt Spiegel über den Namen vor, und der Schütze bestätigt (SF-36).
- Voraussetzung ist, dass der Name am Stand aus der Schützenliste gewählt wird. Frei getippte Namen tragen keine SportpassID; dann hilft der QR.
- Das Original-PDF fehlt auf diesem Weg, solange es nicht auch auf der Meyton-Freigabe liegt (offen, SP-0.1). Wer es haben will, scannt den QR; Spiegel hängt es an die vorhandene Scheibe.
- **Erste Scheibe bestätigen:** Die erste automatisch zugeordnete Scheibe legt Spiegel dem Schützen vor („Dienstag, Stand 6, 19:12, deine?“). Erst danach läuft das Opt-in ohne Rückfrage. So fällt eine vertippte oder vertauschte SportpassID auf, bevor fremde Scheiben im Konto landen (SF-34). „Nicht meine“ dabei gibt der Scheibe einen Grabstein, und die Zustimmung geht zurück an den Admin. Bis zur Bestätigung legt das Einlesen jede neue Scheibe als wartend an (`Card.ownerPending`); sie steht nur in „Offen“, je SportpassID die älteste mit „und n weitere“. „Ja, meine“ macht alle Wartenden der Nummer sichtbar und setzt `firstCardConfirmedAt`. „Nicht meine“ entfernt alle Wartenden der Nummer samt Rohdaten (`purgeCards`), setzt Grabsteine und gibt die Zustimmung zurück (`returnedAt`); bis der Admin erneut bestätigt, lädt die Brücke unter dieser Nummer nichts. Kommt in derselben Sekunde ein Stapel, kann eine Scheibe noch einmal in „Offen“ stehen; ein zweites „Ja, meine“ löst sie. Ebenso bewusst offen: Ein Stapel, der beim „Nicht meine“ schon läuft, hat die Zustimmung zu seinem Beginn gelesen und kann noch eine *neue* wartende Scheibe derselben Nummer anlegen; sie steht dann in „Offen“, ein weiteres „Nicht meine“ entfernt sie. Was gerade entfernt wurde, kommt dagegen nie zurück: Die Ablage prüft Grabsteine unter derselben Sperre wie das Entfernen. Gruppiert wird je Anlage und SportpassID.
- **Keine Automatik bei mehrdeutiger SportpassID:** Kommt eine SportpassID in der SSMDB2 mit verschiedenen Namen vor (Tippfehler in der Schützenverwaltung oder Überlauf langer Nummern im Feld `int(11)`), ordnet Spiegel sie nicht automatisch zu und meldet es dem Admin. Gesperrt sind außerdem 0, leer und 2147483647; vor dem Hashen wird die Nummer normalisiert (SF-35).
- **„Nicht meine“:** Wählt jemand am Stand den falschen Namen, landet seine Scheibe automatisch im fremden Konto. Ein Tipp auf „Nicht meine“ nimmt sie sofort heraus und legt sie dem Admin vor; findet sich kein Besitzer, wird sie gelöscht und bekommt einen Grabstein, den auch die Brücke kennt, damit der nächste Abgleich sie nicht wieder hochlädt (SF-28, SF-37).
- Ein Konto hat eine Sportpassnummer. Nach einem neuen Ausweis (SF-39) widerruft der Schütze die alte Nummer und
  trägt die neue ein; die Scheiben bleiben beim Widerruf.

## Der QR-Weg im Detail

Spiegel hängt dabei nicht vom Layout des Meyton-PDFs ab ([[adr-028]], Änderung vom 6. Oktober 2026).

1. **QR erfassen:** Kamera-Scan in Spiegel (Browser-Kamera auf iPhone und Android, auch als installierte App), Link einfügen oder auf Android „Teilen → Spiegel“. Erlaubt sind nur die in der Konfiguration hinterlegten Meyton-Adressen (heute `qrcode.meyton.eu` und eine feste IP), nie private Netze, nur PDF, ohne Weiterleitungen (SF-47). Die Größengrenze ist eng: Ein Ausdruck hat rund 40 KB, und in Treffsicher hat ein 3,2-MB-PDF schon 665 MB Speicher belegt (SF-48). Das Format beschreibt [[meyton-printout]].
2. **Speichern und zwei Dinge lesen:** Spiegel speichert das PDF sofort als Original (Meyton hält es nur eine Woche). Daraus liest es nur die ID im Fuß (`ID:` und acht Hex-Zeichen, auf jeder Seite) und die Erstellzeit aus den Metadaten. Ändert Meyton das Layout, ändert sich daran nichts (SF-46).
3. **Vorschau:** Die ID wird als vorzeichenbehaftete 32-Bit-Zahl dekodiert (`ff914420` → −7257056) und als Auftrag an die Brücke gegeben ([[spiegel-bridge]]). Die Brücke liefert eine Vorschau ohne Namen und ohne Lage: Stand, Beginn, Disziplin, Schusszahl, Ergebnis, kleines Trefferbild.
4. **Plausibilität:** Die Scheibe muss zur Druckzeit passen: gleicher Abend, ihr erster Schuss vor dem Druck. Bei einem Zwischenausdruck hat die Scheibe danach mehr Schüsse; die Vorschau zeigt beides (SF-42). Passt sie nicht, holt Spiegel nichts, sondern fragt nach (SF-41).
5. **Bestätigen:** Erst danach holt Spiegel die ganze Scheibe. Werte und Identität kommen aus der SSMDB2; gehört die Scheibe laut SportpassID einem anderen Konto, geht die Anfrage an den Admin. Mehrere Ausdrucke derselben Scheibe hängen alle an ihr (SF-43).

**Ohne lesbare ID** zeigt Spiegel die Scheiben, die zur Druckzeit auf der Anlage liefen, und du wählst. Fehlen auch die Metadaten, hilft die Auswahl über Stand und Zeitraum wie im Fundbüro.

**Brücke aus:** Anlage und Brücke werden nach dem Training ausgeschaltet. Scannst du den QR später, zum Beispiel zu Hause, liegt das PDF sofort in Spiegel und lässt sich ansehen; Vorschau und Bestätigung folgen beim nächsten Einschalten, und Spiegel meldet sich dann.

**Auswärts,** ohne Brücke, liest Spiegel das ganze PDF, soweit der vollständige Parser das Layout kennt, und legt ein **Ergebnis ohne Rohdaten** an (Serien, Schusswerte, Teiler, Trefferlage). Klappt das nicht, bleibt das PDF ohne Werte angehängt (SP-2.6).

## Scheibe per ID (gebaut)

Der Kern des QR-Wegs ohne Scannen und ohne PDF (User, 24. Oktober 2026: „eine bekannte Scheiben-ID zu mir
importieren“):

1. **Profil → „Scheibe per ID holen“:** die ID wie im Fuß des Ausdrucks (`ID: ff914420`, acht Hex-Zeichen, `parseCardId`)
   und den Tag der Scheibe. Die Rückfrage sagt, was passiert (`cardRequest`). Liegt die Scheibe dieses Abends schon in
   Spiegel, gibt es keinen Auftrag: beim Schützen der Weg zu ihr, bei einem anderen Konto nur „gehört zu einem anderen
   Konto“. Höchstens zehn offene Aufträge je Konto; ein wartender lässt sich zurückziehen.
2. **Auftrag** (`CardRequest`): `GET /state` nennt ihn der Brücke (`requests`). Die Brücke liest die ScheibenID beim
   nächsten Durchgang, auch während geschossen wird, und schickt sie ohne Zustimmung; verdeckte Wertung und gesperrte
   Scheiben bleiben im Schützenhaus ([[spiegel-bridge]]).
3. **Annehmen:** Spiegel nimmt den Stand nur an, wenn der Beginn der Scheibe auf den genannten Abend fällt (vor 4 Uhr
   der Vortag). Sonst wird nichts gespeichert, und der Auftrag endet mit „an diesem Tag nicht gefunden“. Eine aktive
   Zustimmung per Sportpass eines anderen Kontos geht vor („gehört zu einem anderen Konto“). Die Scheibe gehört dem
   Auftraggeber sofort, ohne „Offen“.
4. **Ausgang** im Profil: wartet auf die Anlage, geholt (mit Link), nicht gefunden (nicht in der Ablage oder nach 30
   Tagen), an diesem Tag nicht gefunden, lässt sich nicht holen (verdeckt oder gesperrt), gehört zu einem anderen Konto,
   zurückgezogen. Den Ausgang meldet die Brücke im Heartbeat (`requestsDone`) oder das Einlesen.

Grenzen: Ein Tippfehler in den mittleren Stellen der ID kann am selben Abend die Scheibe eines anderen treffen; der Tag
fängt das nicht. Dann hilft „Löschen“ (mit Sperre). Die Vorschau vor dem Holen (SF-41) kommt mit dem QR-Weg. Nach dem
Holen liest die Brücke die Scheibe nicht mehr von selbst; eine spätere Korrektur der Standaufsicht kommt nur mit einer
Zustimmung per Sportpass. Die Brücke braucht dafür die Version mit Aufträgen (vor Ort einspielen); eine ältere ignoriert
`requests`, und die Aufträge bleiben offen.

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
| Später | SportpassID nachträglich verknüpft → Nachladen, soweit die SSMDB2 es hat (nach der Bestätigung, nur wenn niemand schießt; „Offen“ zeigt dann die jüngste wartende Scheibe zur Kontrolle) | einmalig | nein |

Ein Check-in gilt, bis man sich abmeldet, jemand anderes am selben Stand eincheckt oder drei Stunden vorbei sind. Steht in Meyton ein Name, der zu einem anderen Konto gehört, gewinnt Meyton.

## Regeln

- Abholbar sind nur Scheiben ohne bekannten Besitzer; sonst „Das war ich“ als Anfrage an Besitzer oder Admin.
- Frist: sieben Tage nach dem letzten Schuss (einstellbar). Danach bleibt die Scheibe nur in der SSMDB2.
- Wer zuerst bestätigt, bekommt die Scheibe; ein zweiter Anspruch geht an den Admin.
- Abholen ist umkehrbar; jede Zuordnung wird protokolliert.
- Haben zwei Schützen nacheinander auf derselben Scheibe geschossen, lässt sie sich an einer Schussnummer teilen (SF-12).
- Wer den QR hat, kann die Scheibe holen, wie mit einem Papierausdruck. Dagegen helfen Protokoll, Umkehr und „Das war ich“ (SF-40).
