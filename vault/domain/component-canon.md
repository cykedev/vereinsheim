---
id: component-canon
type: concept
title: "component-canon"
keywords: [Komponenten-Kanon, UI-Komponenten, PageHeader EmptyState DecisionDialog NoticeDialog, component canon, gemeinsame Komponenten, Standardkomponenten, shared UI, Hilfe, Fragezeichen, HelpSheet, Erklärung, Strich mit Grund, fehlender Wert]
tags: [domain-rule]
relates_to: ["[[overview]]"]
part_of: ["[[domain]]"]
documented_in: ["[[conventions#2. Komponenten-Kanon]]"]
---

**TL;DR** Komponenten-Kanon aller Apps: PageHeader/DetailActionBar (keine Dropdown-Objektaktionen), EmptyState, DecisionDialog mit den Folgen aus `lib/consequences.ts` (nie native confirm, `NoticeDialog`, wo eine Aktion nicht geht), „?“ mit der Erklärung als Blatt (`HelpSheet`, Texte in `lib/help/topics.ts` bzw. `shot-help`), „–“ mit Grund statt 0 oder leer, FieldError, sonner-Toasts, Unsaved-Changes-Guard.
