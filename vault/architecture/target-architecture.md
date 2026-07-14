---
id: target-architecture
type: subsystem
title: "target-architecture"
keywords: [Zielarchitektur, Soll-Architektur, Container-Topologie, Volumes, Netze, target architecture, Prod-Aufbau, Deployment-Architektur, Infrastruktur]
tags: [subsystem]
subsystem_of: ["[[overview]]"]
relates_to: ["[[network-segmentation]]", "[[caddy-reverse-proxy]]", "[[db-isolation-model]]"]
documented_in: ["[[overview#Zielarchitektur]]"]
---

**TL;DR** Zielarchitektur: Container-Topologie, Netze, Volumes (caddy_data/postgres_data/uploads), Subdomain-Routing — das Soll-Bild des Prod-Deploys.
