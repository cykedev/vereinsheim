---
id: caddy-x-real-ip-passthrough
type: incident
title: "Caddy reicht ein gefälschtes X-Real-IP durch"
keywords: [caddy, x-real-ip, x-forwarded-for, header_up, remote_host, reverse_proxy, proxy-header, client-ip, auth_trust_proxy_headers, ratenbegrenzung, rate limit, anmeldung, kopplung, spoofing, gefälschte adresse]
tags: [incident, security, operations]
relates_to: ["[[adr-004]]", "[[spiegel-ingest-pipeline]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 14. Oktober 2026: Caddy (`reverse_proxy`) setzt `X-Forwarded-For` selbst, reicht ein vom Client
mitgeschicktes `X-Real-IP` aber **unverändert** durch. `@vereinsheim/lib/auth/client-ip` liest `x-real-ip` vor
`x-forwarded-for`, und Ringwerk und Treffsicher liefen mit `AUTH_TRUST_PROXY_HEADERS=true`: Wer bei jedem Versuch eine
andere Adresse in den Header schrieb, umging die Ratenbegrenzung der Anmeldung. Behoben mit dem Snippet
`(proxy_real_ip)` im `Caddyfile` (`header_up X-Real-IP {remote_host}`), importiert in jedem `reverse_proxy`.

## Belegt

An einem Wegwerf-Caddy 2.11.7 mit einem Echo hinter dem Proxy, Anfrage mit `X-Real-IP: 1.2.3.4` und
`X-Forwarded-For: 5.6.7.8`: ohne `header_up` kam `real=1.2.3.4`, `X-Forwarded-For` schon richtig; mit dem Snippet die
echte Adresse in beiden.

## Regel

- Jeder neue Host im `Caddyfile` importiert `proxy_real_ip`, bevor seine App `AUTH_TRUST_PROXY_HEADERS=true` bekommt
  (bei Spiegel hängt zusätzlich die Ratenbegrenzung der Kopplung daran).
- Ein Header, den die App als vertrauenswürdig liest, muss der Proxy **setzen**, nicht nur ergänzen. Die Abwehr von
  Caddy gegen gefälschte Adressen gilt nur für die `X-Forwarded-*`-Header.
- Das Caddyfile ist als einzelne Datei eingehängt: Nach `git pull` auf dem VPS `docker compose up -d --force-recreate
  caddy`, sonst sieht der Container die alte Datei.
