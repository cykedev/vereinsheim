---
id: spiegel-data-model
type: concept
title: "Spiegel — Kanonisches Datenmodell"
aliases: [datenmodell, spiegel-schema, kanonisches-modell]
keywords: [datenmodell, schema, entitäten, prisma, anlage, quelle, epoche, brücke, stand, schützen-identität, konto, zuordnung, rohdatensatz, scheibe, stellung, serie, schuss, disziplin, scheibenbild, kennzahlwert, notiz, tag, ausrüstung, mikrometer, einheiten, revision, merkmale, zustand, disziplin-familie, ereignis, nur pdf, serien-summe, gesamtergebnis, trefferlage, ort, herkunft]
part_of: ["[[spiegel]]"]
relates_to: ["[[spiegel-ingest-pipeline]]", "[[spiegel-target-library]]", "[[spiegel-metrics]]", "[[spiegel-edge-cases]]", "[[spiegel-db-schema]]"]
---

**TL;DR** Ein quellen-neutrales Modell: Rohdatensätze bleiben unverändert, daraus entsteht die kanonische Scheibe mit Stellungen, Serien und Schüssen; Kennzahlwerte sind eine neu berechenbare Projektion. Koordinaten in Mikrometern, amtliche Werte so wie die Quelle sie liefert, Zeit in UTC mit Millisekunden.

## Entitäten

| Entität | Wozu | Schlüssel |
|---|---|---|
| Anlage | Schießstand eines Vereins mit Zeitzone | id |
| Quelle | eine SSMDB2-Instanz mit Epoche | Anlage + Epoche |
| Brücke | gekoppeltes Gerät mit Token, Version, letztem Kontakt | id |
| Stand | StandNr oder StandNrText (zum Beispiel „H“ im Finale) | Anlage + Nr |
| Schützen-Identität | wie Meyton den Schützen kennt | SportpassID, sonst Name + Verein |
| Konto, Zuordnung | Spiegel-Nutzer und sein Weg zu Identität oder Scheibe, mit Status und Protokoll | id |
| Rohdatensatz | Snapshot als Liste von Zeilenversionen, mit Folgenummer der Brücke ([[spiegel-ingest-pipeline]]) | Quelle + ScheibenID + Prüfsumme |
| Grabstein | abgelehnte oder fremde Scheibe, die nicht wiederkommen darf; auch die Brücke kennt sie | Quelle + Epoche + ScheibenID + Zyklus + Block (jeder Neustart der Probe und der Übergang zur Wertung beginnt einen neuen, SF-03, SF-72) |
| Löschsperre | eigene, endgültig gelöschte Scheibe (nach 30 Tagen Papierkorb): nicht von selbst wieder annehmen, ausdrückliches Holen hebt sie auf; auch die Brücke kennt sie ([[spiegel-navigation]]) | Konto + Quelle + Epoche + ScheibenID |
| Scheibe | ein Durchgang: Disziplin, Stand, Beginn, Ende, Status, Zustand (offen, ruhend, endgültig), Merkmale, Revision, Herkunft (Brücke, Ausdruck, von Hand, aus Treffsicher, [[adr-033]]), Ort als Freitext für Scheiben ohne Brücke, bei Eingaben von Hand ohne Uhrzeit nur der Tag | Quelle + Epoche + ScheibenID + Zyklus + Block (jeder Neustart der Probe und der Übergang zur Wertung beginnt einen neuen, SF-03, SF-72); ohne Brücke nur die Kennung, aus Treffsicher dazu der Schlüssel der Übernahme |
| Stellung, Serie | Gliederung mit amtlichen Summen | Scheibe + Stellung + Serie |
| Serien-Summe | Summe einer Serie ohne Einzelschüsse oder neben ihnen (vom Ausdruck), in ganzen Ringen und in Zehnteln getrennt, mit ihrer Schusszahl; an der Revision | Revision + Serie |
| Angaben der Revision | Gesamtergebnis (Ringe und Zehntel getrennt, mit Schusszahl) und Trefferlage als Summe (Mitte der Schüsse, mit Schusszahl; nur für Versatz und Richtung) | Revision |
| Schuss | Lage, amtliche Werte, Zeit | Scheibe + Stellung + Treffer je Revision; über Revisionen hinweg ein Fingerabdruck aus Zeit, Millisekunden und Lage |
| Ausdruck | gespeichertes Meyton-PDF mit gelesenen Kopf- und Fußdaten | Scheibe + Datei |
| Belege | bis zu 10 Fotos oder PDFs je eigener Scheibe mit Originalnamen, nur zum Nachsehen, in keiner Zahl ([[adr-033]], 1d und 1f) | Scheibe |
| Disziplin | Meyton-Disziplin oder vom Admin ohne Meyton angelegt: DisziplinID (optional) und Name, Regelnummer, Schusszahl (`000` vermutlich offen; der Admin kann sie überschreiben), Serienlänge (vom Admin, 0 heißt ohne Serien; ohne Angabe 10 bei einer Schusszahl aus Zehnern), Stellungen, Familie, Scheibenbild, amtliche Wertung, eingeordnet oder ignoriert (Admin → Disziplinen) | Anlage + DisziplinID + Name (Vereinsvarianten können dieselbe ID tragen) |
| Disziplin-Familie | was in Verläufen zusammen zählt, zum Beispiel LP Freihand (LP 40, LP 40 alt, LP Training); Auflage getrennt; vier aus dem Fachkern, weitere legt der Admin an | id |
| Scheibenbild | Geometrie je Stellung, versioniert ([[spiegel-target-library]]) | id + Version |
| Kennzahlwert | berechneter Wert je Ebene ([[spiegel-metrics]]); gespeichert als Projektion je Scheibe: alle Kennzahlen der Ebene Scheibe in beiden Wertungen und die Rekord-Kandidaten ([[adr-031]], [[spiegel-db-schema]]) | Scheibe (mit Revision und Version der Projektion) |
| Einheit | ein Schütze an einem Tag mit seinen zusammenhängenden Scheiben (Aufwärmen, Abbruch, Disziplinwechsel) | Konto + Tag |
| Eintrag im Tagebuch | ein Abend und eine Disziplin (oder Trocken-, Mentaltraining) mit Vorhaben, Notiz, Satzanfängen, Werten 0 bis 100 in fünf Stufen; Scheiben über die schmale Schnittstelle, ohne Fremdschlüssel ([[spiegel-diary]], [[adr-033]]) | Konto + id; Schlüssel der Übernahme |
| Notiz, Tag, Ausrüstung, Ereignis | Kontext für Vergleiche (Munitionslos, Griff, Brille); ein Ereignis „Visier verstellt“ gibt es nicht | id; an Schüssen über die Schusszeit verankert |

## Schuss

```ts
type Shot = {
  seq: number                     // Abgabefolge: je Stellung nach Treffer, Probe/Wertung nach Zeit
  position: number                // Stellung, 0 = Probe
  series: number | null           // Serie laut Meyton
  xUm: number | null              // Mikrometer, x nach rechts; null bei Ergebnissen nur aus dem PDF
  yUm: number | null              // Mikrometer, y nach oben
  ring: number | null             // amtlich, ganze Ringe
  decimalTenths: number | null    // amtlich, 94 = 9,4
  teilerHundredths: number | null // amtlich; Einheit am echten Datensatz prüfen
  innerTen: boolean | null        // null: unbekannt (eingetragen ohne Lage)
  scoringMode: number             // Meyton-Wertungsmodus 0–12
  firedAt: string | null          // UTC mit ms, aus Ortszeit + Zone der Anlage; null nur aus dem PDF
  flags: string[]                 // zum Beispiel fehlschuss, verdaechtig
  source: { sourceId: string; scheibenId: number; stellung: number; treffer: number }
}
```

## Einheiten und Regeln

- **Koordinaten** intern in Mikrometern als Ganzzahl. Aus der SSMDB2 (1/100 mm) mal 10. Achsen: x rechts, y oben (in Phase 0 zu bestätigen).
- **Amtliche Werte** (Ring, Zehntel, Teiler, Innenzehner) so, wie die Quelle sie liefert; die Skala je Quellfeld steht im Adapter ([[spiegel-ingest-pipeline]]).
- **Wertung der Disziplin** setzt der Admin; sie ist die Vorgabe jeder Scheibe, im Wettkampf die amtliche (so druckt Meyton), nie aus `Treffer.Wertung`: Das ist die Anzeigeart am Monitor, die der Schütze umschalten kann; gedruckt wird nach der Disziplin (SF-74, Abend-Mitschnitt vom 9. Oktober 2026; bis dahin stand hier der Wertungsmodus der Wertungsschüsse). Der Admin setzt sie unter Admin → Disziplinen und sieht dabei, was am Stand meist angezeigt wurde; ohne Einstellung gilt wie am Stand. Im Fachkern `PeriodCard.official`; die Scheiben-Liste zeigt sie vorn ([[spiegel-navigation]]). Training nur aus Probe hat keine.
- **Zeit** in UTC mit Millisekunden; der Rohwert (Ortszeit ohne Zone) bleibt im Rohdatensatz.
- **Revisionen:** Korrekturen der Wertung erzeugen eine neue Revision; die vorige bleibt nachvollziehbar. Neue Schüsse ändern die aktuelle Revision (SF-67, [[adr-031]]). Löscht Meyton die Probe (SF-03) oder beginnt sie neu (SF-72), endet der Block, und der nächste Stand ist eine neue Scheibe ([[adr-027]]).
- **Herkunft:** Eine Scheibe kann zuerst nur aus dem PDF bestehen (QR-Scan, Brücke gerade aus oder fremde Anlage) und später um Rohdaten ergänzt werden.
- **Nur aus dem PDF:** Solche Ergebnisse haben Werte je Schuss, aber keine Lage und keine Zeit; Kennzahlen, die eine Lage brauchen, entfallen dort.
- **Merkmale und Zustand** einer Scheibe sowie die Regeln für Probe, Reihenfolge und Löschungen stehen in [[spiegel-edge-cases]].
- **Keine Mandanten:** eine Installation je Verein ([[adr-029]]); eine Anlage reicht im Normalfall, mehrere sind möglich (zum Beispiel 10 m und 50 m mit getrennten Servern).
