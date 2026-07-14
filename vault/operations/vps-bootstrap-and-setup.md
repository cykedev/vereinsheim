---
id: vps-bootstrap-and-setup
type: operation
title: "vps-bootstrap-and-setup"
keywords: [VPS-Einrichtung, Bootstrap, Server-Setup, Provisionierung, Erstinstallation, vps setup, bootstrap, DNS, SSH, Inbetriebnahme]
tags: [operation]
operation_of: ["[[overview]]"]
informed_by: ["[[adr-013]]", "[[adr-012]]", "[[adr-014]]"]
documented_in: ["[[operations#Initial-Bootstrap eines neuen VPS]]"]
---

**TL;DR** bootstrap-vps.sh (root) → setup-Wizard → cron → DNS → release; SSH-Lockdown manuell (ADR-013); .vereinsheim.local lokal (ADR-012).
