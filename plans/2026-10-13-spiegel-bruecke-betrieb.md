# Spiegel-Brücke: Betrieb (SP-1.4 c, Teil)

## Kontext

Auftrag des Users (13. Oktober 2026, autonom): weitere offene Themen. Nach Teil a (Leser) und b (Upload) fehlt, was die
Brücke im Alltag braucht: Sie wird nach jedem Abend hart ausgeschaltet ([[spiegel-bridge]], „Betrieb“) und muss beim
nächsten Start nachholen; sie soll als Dienst laufen.

## Entscheidungen

- **D1 Nachholen ab dem Wasserstand** (SF-55): `GET /state` nennt die jüngste Beobachtung in Spiegel. Ab einem Tag davor
  (der ganze letzte Abend samt Korrekturen nach dem Ende des Lebenszeichens) liest die Brücke beim Start jede Scheibe
  einmal. Umgerechnet in Ortszeit der Anlage (`site.timeZone`), weil Meyton Ortszeit schreibt; Zonen im Binary.
- **D2 Nur wenn niemand schießt** (SF-52): Nachzuholende haben den niedrigsten Rang und kommen erst, wenn keine Scheibe
  sich bewegt oder aktiv ist (20 Minuten); bis dahin halten sie den Takt nicht hoch.
- **D3 Dienst für systemd**: Unit mit Härtung (kein Root, kein Schreiben, keine Fähigkeiten, 128 MB), kein Neustart bei
  fehlender Konfiguration oder widerrufenem Token; `install.sh` wiederholbar. `pair` fragt den Zugang zur SSMDB2 ab,
  statt ihn in der Befehlszeile zu verlangen.
- **D4 Admin sieht Zurückgehaltenes**: verdeckt und Anzeigeart 0 aus dem Heartbeat auf „Anlage und Brücken“.

## Nicht in diesem Plan

Selbst-Update (SF-54), Dienst unter Windows, Statusseite, neue Epoche bei einem Reset, Abgleich während eines langen
Laufs, Aufträge (SP-1.5).
