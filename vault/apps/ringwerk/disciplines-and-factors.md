---
id: disciplines-and-factors
type: subsystem
title: "disciplines-and-factors"
keywords: [Disziplinen, Schießdisziplinen, Luftpistole Luftgewehr, LP LG LPA LGA, teilerFaktor, WHOLE DECIMAL, disciplines, Archivierung]
tags: [feature]
feature_of: ["[[ringwerk]]"]
documented_in: ["[[ringwerk-data-model#Disziplin (Discipline)]]"]
---

**TL;DR** System-Disziplinen LP/LG/LPA/LGA mit teilerFaktor; WHOLE vs. DECIMAL; Archivierung statt Löschen bei vorhandenen Ergebnissen; Faktor gesperrt, sobald die Disziplin verwendet wird, bei Standarddisziplinen immer.

# Disziplinen und Faktoren

- **Faktor sperren (E3, 20. Oktober 2026):** `updateDiscipline` weist einen geänderten Faktor ab, sobald ein
  Wettbewerb, eine Einschreibung oder eine Serie die Disziplin verwendet („Für einen anderen Faktor eine neue Disziplin
  anlegen.“), bei Standarddisziplinen (`isSystem`) immer. Prüfung und Update laufen in einer serialisierbaren
  Transaktion, das Update trägt die Bedingung selbst (`updateMany` mit `none`-Filtern). Verglichen wird auf die sieben
  Stellen der Spalte. Name und Wertungsart bleiben änderbar (die Wertungsart nur ohne Wettbewerb).
- **Formular:** Das Feld „Teiler-Faktor“ bleibt sichtbar und wird mitgeschickt, ist aber `readOnly` (nicht `disabled`,
  [[conventions]] §9), darunter der Grund (`getDisciplineFactorLock`: „system“ oder „used“).
- **Standarddisziplinen:** `ensureSystemDisciplines` setzt den Faktor der vier Standarddisziplinen bei jedem Start auf
  den festen Wert. In der Oberfläche ist er nicht änderbar, eine Änderung kann also nicht verloren gehen.
