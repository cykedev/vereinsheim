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
- **Standardlisten (19.3 ff.):** Für Luftgewehr und Luftpistole 10 m gibt es neben den DSB-Regeln 01.10, 01.11 (Auflage), 01.20, 02.10, 02.11 (Auflage) und 02.16 (LP5, Fallscheibe) Meyton-eigene Nummern: Liga 0510, 0520, 0530, 0531, 0540, 0550 bzw. 0610, 0620, 0630, 0631, 0640, 0650, Training 1009–1018 bzw. 1109–1117 und „alt“ 9110 bzw. 9210. „LP 40 alt“ ist `19210040`, also eine Meyton-Standarddisziplin. Bereiche taugen nicht als Regel: Zwischen den Liga-Nummern liegt etwa `10516140` „Pistolet air 5 40“, eine französische Luftpistole.
- **Offenes Training:** „LG Training Spiegel“ `19110000` und „LP Training Spiegel“ `19210000` haben den Schusscode 000 (SF-09).
- **Schusscodes über 100 sind kein verlässlicher Hinweis:** Bei 10 m sind es Varianten (220 Finale, 240 „Liga Bayern“, 130 „LP5 30 (S)“, 200 „LG Auflage Finale“), anderswo auch echte Zahlen (`40740120` ISSF 3x40 Gewehr).
- **Regelnummern kollidieren (SF-70):** `10610040` ist „LP Liga“, `10610220` „ISSF AR Men Final“; die ISSF-Finale nutzen 0610–0617 mit 220, Luftgewehr gerade, Luftpistole ungerade. `10100040` ist die französische „Pistolet air“, obwohl DSB-Regeln 01.xx Gewehre sind. Ein Rückfall über die Regelnummer allein wählt deshalb das falsche Scheibenbild.
- **Sonderwertungen und eigene Scheiben:** Teiler- und verdeckte Varianten der Trainingsnummern (1014, 1015, 1017, 1114, 1115, 1117) nutzen die Standardscheibe und stehen im Katalog. Nicht aufgenommen sind 71xx/72xx, 23xx/24xx, Blattl (2110/2210) und „AR Adv.“ mit Abzug; sie laufen über Name oder Admin. Kyffhäuser (1062), 12-kreisig (1064) und die Löwenbräu-Finale (7401, 7402) haben eigene Scheiben in Meytons Scheibenliste (Kapitel 22), LP5 (0216) laut DSB-Sportordnung eine Fallscheibe. Sie stehen als Nullzeilen im Katalog, damit der Name sie nicht auf die Standardscheibe zieht.
