---
id: spiegel-architecture
type: subsystem
title: "Spiegel — Architektur"
aliases: [spiegel-systemarchitektur, spiegel-komponenten]
keywords: [architektur, komponenten, datenfluss, systemkontext, monorepo-layout, packages, shot-core, shot-ui, meyton-pdf, ingest-contract, deploy, compose, caddy, subdomain, selbst hosten, api, treffsicher-anbindung]
subsystem_of: ["[[spiegel]]"]
governed_by: ["[[adr-026]]", "[[adr-029]]"]
relates_to: ["[[target-architecture]]", "[[db-isolation-model]]", "[[build-deploy-pipeline]]"]
---

**TL;DR** Zwischen Schützenhaus und Internet gibt es genau eine Verbindung: eine ausgehende HTTPS-Verbindung der Brücke zu Spiegel. Auf dem VPS ist Spiegel die einzige App mit Messdaten (eigene DB), Treffsicher und Ringwerk lesen über die API. Die Fachlogik liegt in geteilten Paketen.

## Komponenten

| Komponente | Ort | Aufgabe |
|---|---|---|
| Meyton-Server | Schützenhaus | ShootMaster, SSMDB2 (MySQL), SDF-Export, LANA ([[meyton-ssmdb2]], [[meyton-interfaces]]) |
| Brücke | Schützenhaus, Gerät im Meyton-Netz | liest SSMDB2, puffert, lädt hoch, holt Aufträge ab ([[spiegel-bridge]]) |
| Spiegel | VPS hinter Caddy | Konten, Ingest-API, Normalisierung, Kennzahlen, Oberfläche ([[spiegel-ingest-pipeline]]) |
| Postgres `spiegel` | VPS, Netz `data` | Rohdaten, kanonisches Modell, Kennzahlwerte ([[spiegel-data-model]]) |
| PDF-Speicher | VPS, Volume | Original-Ausdrucke aus dem QR-Weg ([[spiegel-assignment]]) |
| Treffsicher, Ringwerk | VPS | lesen Messdaten über Spiegels API, nie über die DB ([[db-isolation-model]]) |
| qrcode.meyton.eu | Meyton | hält den PDF-Ausdruck eine Woche bereit ([[meyton-printout]]) |

## Datenfluss

Rohdaten (Snapshot je Scheibe, unverändert) → Normalisierung (Adapter `meyton-ssmdb2@9`: Skalen, Zeitzone, Reihenfolge, Epochen) → kanonisches Modell (Scheibe, Stellung, Serie, Schuss) → Kennzahlen (Registry, versioniert) → Ansichten (Session, Verlauf, Vergleich, später Live). Alles rechts der Rohdaten lässt sich jederzeit neu berechnen.

## Monorepo-Layout

```
apps/spiegel/               Next.js-App: Konten, Ansichten, Ingest-API, Admin
apps/spiegel-bridge/        Brücke fürs Schützenhaus (Technik offen, siehe adr-027)
packages/shot-core/         Scheibenbilder, Wertung, Geometrie, Kennzahlen-Registry (isomorph, rein)
packages/shot-ui/           Scheibe (SVG), Overlays, Wiedergabe, Diagramme (React)
packages/meyton-pdf/        Meyton-Ausdruck lesen (heute in Treffsicher und Ringwerk)
packages/ingest-contract/   versionierter Vertrag Brücke ↔ Spiegel
```

## Leitplanken

- Rohdaten unverändert speichern; Meyton-Werte sind amtlich.
- Quellen-neutral: neue Systeme bekommen einen Adapter, kein neues Modell.
- Datensparsamkeit in der Brücke; verdeckte Wertung verlässt das Schützenhaus nicht.
- Zeit immer mit Zone: Meyton liefert Ortszeit ohne Zone, Spiegel rechnet mit der Zone der Anlage.
- Live ist nur eine schnellere Ansicht auf denselben Datenstrom.

## Einbindung ins Vereinsheim

- **Deploy-Vertrag:** `compose.yml` bekommt `app-spiegel` und `migrate-spiegel` (Muster [[build-deploy-pipeline]]), Caddy eine Subdomain und den Ingest-Endpunkt, `db-init` eine dritte DB samt idempotentem Anlage-Schritt für den laufenden VPS ([[adr-026]]).
- **Netze** wie in [[target-architecture]]: Spiegel in `web` und `data`, Postgres nur in `data`.
- **Backups und CLI** schließen die dritte DB und den PDF-Speicher ein.
- **VPS bleibt, wie er ist** (VPS S, 2 GB RAM, heute etwa 400 MB Puffer, [[vps-resource-sizing]]). Spiegel bekommt ein festes `mem_limit` (Ziel 256 MB), läuft ohne eigene Hintergrunddienste (Normalisierung im Request), und Deploys laufen nacheinander, damit nie zwei Migratoren gleichzeitig Speicher brauchen. Bei 10 bis 15 Nutzern ist die Last klein, der Grundbedarf eines Next.js-Servers ist der Engpass. Eine Swap-Datei wäre ein kostenloses Sicherheitsnetz, ist aber eine Änderung am VPS und nur eine Option. Gemessen wird in SP-1.9.

## Open-Source-Betrieb

Andere Vereine betreiben eine eigene Installation ([[adr-029]]): ein Compose-Beispiel mit Spiegel, Postgres und Brücke, Konfiguration über Umgebungsvariablen, keine Vereinsdaten im Code.

## Anbindung von Treffsicher und Ringwerk

- **Treffsicher:** Konto-Verknüpfung (OAuth-artig, Einwilligung), dann „Aus Spiegel übernehmen“ statt PDF-Import; eine Einheit verweist auf eine oder mehrere Spiegel-Scheiben und zeigt das Trefferbild mit `shot-ui`.
- **Ringwerk:** Liga-Ergebnisse (Serien, Teiler) aus Spiegel statt aus dem PDF; nur Summen, keine Trefferlage.
- Beides ist Phase 3 der [[spiegel-roadmap]].
