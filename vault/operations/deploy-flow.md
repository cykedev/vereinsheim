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

**TL;DR** release (lokal) → build-and-push + ssh-deploy; deploy.sh = pre-backup→pull→up -d→prune; migrate-* one-shot VOR app-*; Tags <sha>(+-migrator).
