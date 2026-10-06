---
id: src-meyton-disziplin-erstellen
type: source
title: "Meyton: ShootMaster II – Disziplin erstellen (Anleitung, Stand 06.12.2017)"
url: https://software.meyton.info/wp-content/uploads/Upload/Manuals/DE/ShootMaster/ShootMasterII_-_Disziplin_erstellen.pdf
retrieved: 2026-10-05
keywords: [meyton, shootmaster, disziplin erstellen, disziplinid, regelnummer, wettbewerbsliste, scheibenmaße, kaliber, training spiegel, liga, issf finale, schusscode]
---

**TL;DR** Meytons Anleitung zum Anlegen von Disziplinen (151 Seiten). Sie erklärt den Aufbau der achtstelligen DisziplinID und listet in Kapitel 19 die Standard-Wettbewerbe mit Distanz, Kaliber und ID, nach Waffe, Verband, Land und Distanz sortiert.

Provenienz-Note. Das Original liegt bewusst **nicht** im Repo: Es ist ein urheberrechtlich geschütztes Herstellerdokument und öffentlich unter der URL abrufbar. Spiegel übernimmt daraus nur Fakten als Regeln ([[spiegel-target-library]]), keine Abschrift der Listen.

## Was daraus folgt

- **Aufbau der DisziplinID (19.1):** 1. Ziffer Entfernung, Ziffern 2–5 Regelnummer (rechtsbündig, mit 0 aufgefüllt), Ziffern 6–8 Schüsse im Modus Wertung. Beispiele im Text: `10110020` „LG 20“ und `40180060` „KK 60 liegend“.
- **Standardlisten (19.3 ff.):** Für Luftgewehr und Luftpistole 10 m gibt es neben den DSB-Regeln 01.10, 01.11 (Auflage), 01.20, 02.10, 02.11 (Auflage) und 02.16 Meyton-eigene Nummern für Liga (05xx, 06xx), Training (1009–1018, 1109–1117) und „alt“ (9110, 9210). „LP 40 alt“ ist `19210040`, also eine Meyton-Standarddisziplin.
- **Offenes Training:** „LG Training Spiegel“ `19110000` und „LP Training Spiegel“ `19210000` haben den Schusscode 000 (SF-09).
- **Schusscodes über 100 sind Varianten,** keine Schusszahlen: 220 bei Finale, 240 bei „Liga Bayern“, 130 bei „LP5 30 (S)“, 200 bei „LG Auflage Finale“.
- **Regelnummern kollidieren (SF-70):** `10610040` ist „LP Liga“, `10610220` „ISSF AR Men Final“; die ISSF-Finale nutzen 0610–0617 mit 220, Luftgewehr gerade, Luftpistole ungerade. `10100040` ist die französische „Pistolet air“, obwohl DSB-Regeln 01.xx Gewehre sind. Ein Rückfall über die Regelnummer allein wählt deshalb das falsche Scheibenbild.
- **Sonderwertungen** wie Teiler, verdeckt („V“), Blattl oder „AR Adv.“ mit Abzug haben eigene Nummern; Spiegel nimmt sie nicht in den Katalog auf, sie laufen über Name oder Admin.
