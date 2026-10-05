---
id: src-meyton-live-display
type: source
title: "Meral-IT: Meyton-Live-Display, technische Referenz"
url: https://github.com/Meral-IT/Meyton-Live-Display
retrieved: 2026-10-05
keywords: [meral-it, meyton-live-display, technical reference, sdf, lana, apache-2.0]
---

**TL;DR** Open-Source-Live-Anzeige für Meyton-Stände (Python, SQLite, SSE, Caddy, Docker; Apache-2.0; Branch `develop`, zuletzt geändert am 4. Oktober 2026). Die technische Referenz (`docs/technical-reference.md`) und `backend/app/sources.py` dokumentieren SSMDB2-, SDF- und LANA-Details aus echter Inbetriebnahme.

Provenienz-Note; Auszug in [[meyton-ssmdb2]], [[meyton-interfaces]] und [[spiegel-target-library]]. Kernpunkte:

- SDF-`TargetID` (hexadezimal) ist die vorzeichenbehaftete 32-Bit-`ScheibenID` der DB.
- DB-Koordinaten in 0,01 mm; Ring-Werte unterschiedlich skaliert (Serien in ganzen Ringen, Gesamt- und Zehntelwerte ×10).
- DB-Zeiten sind Ortszeit (Europe/Berlin); ShootMaster 6.0 schreibt im XML ein „Z“, obwohl die Zeit lokal ist.
- SDF kennt keine Serie je Treffer und keine Verdeckung; DB-Korrekturen und -Löschungen sind maßgeblich; unbekannte Verdeckung bleibt verborgen (Modi 0, 5, 10 und unbekannt).
- Probe in der DB unter `Stellung = 0`; SSMDB2 ist ein Archiv, keine Belegungstabelle; Belegung über LANA (WebSocket 53088, `GetLaneInfo`).
- Regelkatalog mit Kalibern und Geometrien je DSB- und Meyton-Regelnummer, Geometrie je Stellung (25-m-Pistole); Werte immer von Meyton übernommen.
- Änderungserkennung über `Scheiben.Zeitstempel` und `MAX(Treffer.Zeitstempel + Millisekunden)`; Abgleich einmal pro Sekunde.
