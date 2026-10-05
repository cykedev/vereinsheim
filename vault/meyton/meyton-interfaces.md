---
id: meyton-interfaces
type: concept
title: "Meyton — Schnittstellen und Fremdprojekte"
aliases: [meyton-schnittstellen, sdf, lana, m-qnect]
keywords: [sdf, shooting data feed, xml, smb, xml_result, lana, websocket, getlaneinfo, standbelegung, starterkarte, barcode, wm-shot, csv, qrcode.meyton.eu, auswertungii, m-qnect, disag, shotsapp, estanx, sius, shootingsportscloud, meyton-live-display, meyton-scheibenanzeige, shootingticker, sv-webapp, ip-plan, fernwartung]
part_of: ["[[meyton]]"]
documented_in: ["[[src-meyton-live-display]]", "[[src-meyton-recherche-2026-10]]"]
relates_to: ["[[meyton-ssmdb2]]", "[[spiegel-vision]]"]
---

**TL;DR** Neben der SSMDB2 gibt die Meyton-Anlage Ergebnisse als XML-Live-Export (SDF), als CSV je Scheibe (WM-Shot) und als PDF hinter einem QR-Code heraus; LANA liefert die Standbelegung. DISAG M-Qnect bringt die ShotsApp an Meyton-Anlagen. Eine REST-API oder Analyse-App von Meyton gibt es nicht.

## Schnittstellen der Anlage

| Schnittstelle | Was | Für Spiegel |
|---|---|---|
| SSMDB2 | MySQL-Ablage ([[meyton-ssmdb2]]) | Hauptquelle |
| SDF (Shooting Data Feed) | XML-Live-Export, im Kontrollzentrum aktiviert, auf der SMB-Freigabe `xml_result`; Version 0.2.2 | optional für Live; ohne Serie je Treffer und ohne Verdeckung, die DB ist maßgeblich |
| LANA | Standbelegung per WebSocket (Port 53088, Lesebefehl `GetLaneInfo`); Anmeldung per Sportpassnummer, Name oder Starterkarte mit Barcode | vom Verein nicht genutzt; käme als weiterer Zuordnungsweg in Frage |
| WM-Shot | CSV je Scheibe `<Starterliste>_<StartNr>_<ScheibenID>.csv` auf `\\192.168.10.200\ERGEBNIS\WM-Shot`, Koordinaten in 1/100 mm | Ausweichquelle |
| QR-Code | Ergebnisausdruck als PDF, eine Woche abrufbar ([[meyton-printout]]) | Zuordnung und Original-PDF |
| AuswertungII | Export als PDF, HTML, CSV, Excel, XML | manuell |

## Netz

- ShootMaster sperrt bei der Installation jeden Internetzugang; Internet gibt es nur über einen eigenen Router (für Fernwartung, die der Verein startet).
- IP-Plan (/16): Server 192.168.10.200, weitere Workstations .10.201–239, Steuer-PCs .10.1–159, Messrahmen 192.168.11.x, Drucker .240–250, Switches .251–254, Tablets 192.168.2.100–254 per DHCP.

## Produkte und Fremdprojekte

| Projekt | Was | Lizenz, Lehre |
|---|---|---|
| DISAG M-Qnect | Android-Tablet mit fester IP im Meyton-Netz, fragt die SSMDB2 alle 30 s ab, erzeugt QR-Codes für die DISAG ShotsApp; kostenlos | bestätigt das Brücken-Prinzip; Messlatte für Spiegel ([[spiegel-vision]]) |
| Meyton-Live-Display (Meral-IT) | Live-Anzeige und OBS-Quelle; SSMDB2, SDF und LANA, SQLite, SSE, Docker | Apache-2.0, Übernahme mit Namensnennung möglich |
| meyton-scheibenanzeige | Live-Board, Trefferprotokoll, Auswertung, Urkunden; TypeScript, Electron | keine Lizenz, nur Anregung |
| ShootingTicker | lokal lesen, in einen Online-Ticker hochladen (2016) | gleicher Aufbau wie die Brücke |
| SV-WebApp | Abgleich per VPN über die Fritzbox des Vereins | im Forum kritisiert, weil Mitglieder nicht zustimmen |

## Neue Meyton-Linie

ESTANX (mit SIUS, Ergebnisse über shootingsportscloud.com) löst langfristig die bisherigen Messrahmen ab; Meyton sagt für diese mindestens 15 Jahre Pflege zu (Stand 04/2025). Ob ESTANX eine SSMDB2 hat, ist offen; Spiegel bräuchte dann einen zweiten Adapter.
