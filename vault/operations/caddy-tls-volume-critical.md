---
id: caddy-tls-volume-critical
type: concept
title: "caddy-tls-volume-critical"
keywords: [TLS-Zertifikate, Caddy, Let's Encrypt, Zertifikat-Volume, HTTPS, caddy_data, certificate, ACME-Rate-Limit, Verschlüsselung]
tags: [ops-constraint]
relates_to: ["[[overview]]"]
informed_by: ["[[adr-004]]"]
part_of: ["[[operations]]"]
documented_in: ["[[overview#Zielarchitektur]]"]
---

**TL;DR** caddy_data hält LE-Zertifikate — Verlust = kein Zugang bis Neu-Ausstellung (ACME-Rate-Limit); bei VPS-Neuaufbau Volume kopieren.
