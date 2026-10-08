---
id: src-ssmdb2-zugang-recherche
type: source
title: "Recherche: Zugang, Netz und Version der SSMDB2 (8. Oktober 2026)"
retrieved: 2026-10-08
keywords: [ssmdb2, zugang, benutzer meyton, port 3306, mariadb, opensuse leap, ip-plan, netzmaske, samba, ergebnis, qr-code, qrcode.meyton.eu, community-projekte, handbuch v5 v7 v9]
---

**TL;DR** Web-Recherche zu Zugang, Netz, Datenbank und Freigaben der SSMDB2 für ShootMaster 6.0.2, getrennt nach Herstellerquelle, Community und eigener Ableitung. Ergebnisse stehen in [[meyton-ssmdb2]]; das Standard-Passwort steht bewusst nur im Handbuch, nicht im Repo.

Provenienz-Note, ohne Kopie der Originale (Herstellerdokumente und fremder Code).

**Hersteller (Meyton):**

- Handbuch SSMDB2 V9, Seite 3: Server, Datenbank, Benutzer, Passwort; inhaltsgleich in V5 (16.08.2023) und V7 (07.03.2024): https://software.meyton.info/wp-content/uploads/Upload/Manuals/DE/SSMDB2/Scheibenablage_SSMDB2_V9_de.pdf
- Online-Hilfe zur SSMDB2 (ODBC, Connector 3.5.1): https://support.meyton.info/files/de-DE/309777931355639051.html
- IP-Plan: https://support.meyton.info/files/de-DE/43185163357127179.html ; Rolle per IP: https://support.meyton.info/files/de-DE/55162635355519627.html
- Kontrollzentrum SSMDB2 (Echtzeit, Löschen): https://support.meyton.info/files/de-DE/55218443355627915.html
- Freigabe ERGEBNIS/WM-Shot: https://support.meyton.info/files/de-DE/355415435355659787.html ; SDF: https://support.meyton.info/files/de-DE/308159627355653899.html
- Release-Notizen 5.4 (Probe bis zum ersten Wertungsschuss gespeichert), 6.0 (`BesterTeiler001`), Systemvoraussetzungen 6.0 (openSUSE Leap 15.3–15.6): https://software.meyton.info/shootmaster-5-4/ , https://software.meyton.info/shootmaster-6-0/ , https://software.meyton.info/en/shootmaster-6-0-2/
- Forum: kein Zugriff auf die Haupt-DB seit 5.3 (https://forum.meyton.info/viewtopic.php?t=1946), MariaDB (https://forum.meyton.info/viewtopic.php?t=383), Samba als Gast (https://forum.meyton.info/viewtopic.php?t=2006), QR braucht Router mit DHCP (https://forum.meyton.info/viewtopic.php?t=1913)

**Community:** Port 3306 und Benutzer `meyton` in ferdifighter/meyton-scheibenanzeige, SvenFinn/displaycontroller, Meral-IT/Meyton-Live-Display ([[src-meyton-live-display]]), jrobijn/meyton-to-html-exporter; ODBC aus dem Meyton-Netz ohne Server-Einstellung (meisterschuetzen.org, Thread 11845).

**Abgeleitet, nicht belegt:** MariaDB 10.11 (Paket von openSUSE Leap 15.6); Remote-Zugriff für `meyton` ab Werk offen; der QR-Code zeigt auf `qrcode.meyton.eu` (HTTP, lighttpd), nicht auf einen Server im Vereinsnetz.
