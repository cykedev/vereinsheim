---
id: meyton
type: guide
title: "Meyton — Wissen über die Schießstandanlage"
aliases: [Meyton, meyton-anlage, shootmaster]
keywords: [meyton, shootmaster, elektronische schießstände, messrahmen, kontrollzentrum, ssmdb2, sdf, lana, qr-code, ausdruck, schnittstellen, domänenwissen]
part_of: ["[[overview]]"]
relates_to: ["[[spiegel]]"]
---

**TL;DR** Wissen über die Meyton-Anlage des Vereins (ShootMaster 6.0.2) und ihre Schnittstellen: die MySQL-Ablage SSMDB2, weitere Exporte und Live-Schnittstellen, der Ergebnisausdruck mit QR-Code. Grundlage für Spiegel und für den PDF-Import in Treffsicher.

# Meyton — Wissen über die Schießstandanlage

## Notes

- [[meyton-ssmdb2]] — die Scheibenablage in MySQL: Tabellen, Felder, Skalen, Versionen, Stolperfallen, SQL-Checkliste für vor Ort.
- [[meyton-interfaces]] — SDF-Live-Export, LANA-Belegung, WM-Shot-CSV, QR-Code, DISAG M-Qnect, die neue Linie ESTANX und Community-Projekte.
- [[meyton-printout]] — der Ergebnisausdruck hinter dem QR-Code: Link-Format, Inhalt, ID im Fuß.
- [[ssmdb2-erkundung]] — das Werkzeug für den Erkundungsabend: Checkliste, Kopie und geführtes Schießprotokoll mit Mitschnitt.

## Quellen

- [[src-meyton-ssmdb2-handbuch]] — Meyton-Handbuch zur Scheibenablage, Datenbankversion 9.
- [[src-meyton-live-display]] — technische Referenz des Projekts Meyton-Live-Display (Apache-2.0).
- [[src-meyton-recherche-2026-10]] — Recherche in Meyton-Support, Forum, Release-Notizen, DSB-Sportordnung und ISSF-Regeln.
- [[src-meyton-disziplin-erstellen]] — Meyton-Anleitung „Disziplin erstellen“: Aufbau der DisziplinID, Standardlisten, Kollisionen der Regelnummern.
- [[src-ssmdb2-zugang-recherche]] — Recherche vom 8. Oktober 2026: Zugang, Port, MariaDB, IP-Plan, Freigaben, Community-Projekte.

## Wer das Wissen nutzt

- Spiegel ([[spiegel]]): Rohdaten über die Brücke, Zuordnung per QR.
- Treffsicher ([[treffsicher-meyton-import]]): PDF-Import; der Formatwechsel vom September steht in [[meyton-pdf-format-change]]. Ringwerk ([[meyton-import]]) hat den Import nur als Anforderung.
