---
id: ringwerk-auth-security
type: subsystem
title: "ringwerk-auth-security"
keywords: [Authentifizierung, Anmeldung, Login, Sicherheit, NextAuth, bcrypt, Rate-Limit, Brute-Force-Schutz, authentication, login, security, rate limiting, Passwort, Seed-Admin]
tags: [subsystem]
subsystem_of: ["[[ringwerk]]"]
relates_to: ["[[treffsicher-dos-protection]]"]
documented_in: ["[[ringwerk-technical#Authentifizierung & Sicherheit]]"]
---

**TL;DR** NextAuth v4 + bcrypt; Login-Rate-Limit 5/E-Mail, 30/IP, 15min; Seed-Admin via SEED_ADMIN_* (treffsicher: ADMIN_*, Angleichung offen).
