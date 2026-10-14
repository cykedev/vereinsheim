---
id: caddy-reverse-proxy
type: subsystem
title: "caddy-reverse-proxy"
keywords: [Caddy, Reverse Proxy, TLS-Terminierung, HTTPS, Subdomain-Routing, reverse proxy, Let's Encrypt, Proxy, Routing]
tags: [subsystem]
subsystem_of: ["[[overview]]"]
governed_by: ["[[adr-004]]"]
documented_in: ["[[overview#Zielarchitektur]]"]
---

**TL;DR** Caddy als Reverse Proxy, terminiert TLS (Let's Encrypt, Auto-Renew) und proxyt ringwerk.<domain>/treffsicher.<domain>/spiegel.<domain> auf die App-Container; jeder Host setzt `X-Real-IP` selbst (`proxy_real_ip`), Spiegel nimmt höchstens 5 MiB je Anfrage.
