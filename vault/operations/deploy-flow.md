---
id: deploy-flow
type: operation
title: "deploy-flow"
keywords: [Deployment, Bereitstellung, Deploy-Ablauf, Release, Ausrollen, deploy, deployment, ssh-deploy, Docker Hub, Auslieferung]
tags: [operation]
operation_of: ["[[overview]]"]
informed_by: ["[[adr-015]]"]
relates_to: ["[[build-deploy-pipeline]]"]
documented_in: ["[[operations#Standard-Flow]]"]
---

**TL;DR** release (lokal) → build-and-push (alle Apps, `APPS=…` für eine Auswahl) + ssh-deploy; deploy.sh = Vorprüfung (Rolle je App, sonst `db-ensure`) → Pre-Backup → pull → db/caddy → je App migrate-<app> dann app-<app> nacheinander → Historie → prune; Tags <sha>(+-migrator).
