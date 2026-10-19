---
id: treffsicher-backlog
type: guide
title: "Treffsicher — Backlog"
aliases: ["Backlog — Treffsicher"]
keywords: [treffsicher, backlog, offene Punkte, Duplikation, PWA, Offline, maxLength, Props-Budget, Umlaute, Trockentraining, Trainer-Zugang]
part_of: ["[[treffsicher]]"]
---

**TL;DR** Offene Punkte der Treffsicher-App, nach Priorität; dazu fachliche Erweiterungen und bewusst nicht empfohlene Themen.

# Backlog — Treffsicher

Offene Punkte, nach Priorität.

---

## Priorität 1 — Wartbarkeit

### T-02: Mental-Actions — Dimensions-Parsing zusammenführen

**Problem:** `savePrognosisAction` und `saveFeedbackAction` listen die 7 Dimensionen (fitness, nutrition, technique, tactics, mentalStrength, environment, equipment) im Schema und beim Lesen aus `FormData` je einzeln auf. `DimensionSchema` liegt bereits gemeinsam in `mentalShared.ts`; `saveWellbeingAction` nutzt es noch nicht.
**Fix:** `parseDimensionsFromFormData()` und ein gemeinsames Dimensions-Teilschema in `mentalShared.ts`; beide Actions nutzen sie.
**Aufwand:** Klein (~30 min)
**Dateien:** `src/lib/sessions/actions/scoringMentalActions.ts`, `src/lib/sessions/actions/mentalShared.ts`, `src/lib/sessions/actions/mentalActions.ts`
**Spec:** [[treffsicher-technical-constraints#Modularität & Wartbarkeit (verbindlich)]] (Duplikationsregel §5)

---

## Priorität 2 — Optional / Später

### T-06: PWA / Offline-Unterstützung (Phase 5.2)

**Problem:** Kein Service Worker, kein Manifest.
**Scope:** `next-pwa`, App-Manifest, Offline-Fallback-Seite, IndexedDB-Sync
**Aufwand:** Groß (~1 Tag)
**Spec:** [[treffsicher-requirements#Offene Punkte (spätere Phasen)]]

### T-07: `trainingGoal`-Textarea — `maxLength`-Attribut im UI

**Problem:** Die Textarea hat kein `maxLength`; das Limit (500 Zeichen, `CreateSessionSchema` in `sessionSchemas.ts`) prüft nur der Server.
**Fix:** `maxLength={500}` + optionaler Zeichen-Zähler
**Aufwand:** Sehr klein (~15 min)
**Datei:** `src/components/app/session-form/SessionMainFields.tsx`
**Spec:** [[treffsicher-requirements#Die Einheit — Herzstück des Systems]]

### T-09: `GoalAssignmentsForm` — Props auf ≤6 reduzieren

**Problem:** 8 Top-Level-Props (Limit: 6). Callbacks könnten als `handlers`-Objekt gruppiert werden.
**Aufwand:** Sehr klein (~15 min)
**Datei:** `src/components/app/goals/goal-card-section/GoalAssignmentsForm.tsx`

### T-10: Tippfehler in UI-Texten beheben

**Problem:** Umschreibungen statt Umlauten in Meldungen, die im UI erscheinen: `"waehlen"`, `"auswaehlen"`, `"ungueltig"`, `"gueltig"`, `"groesser"`, `"Anhaenge"`, `"verfuegbar"`, `"unveraendert"`, `"aufgeloest"`.
**Dateien:**

- `src/lib/sessions/actions/sessionSchemas.ts`
- `src/lib/sessions/actions/meytonActions.ts` (+ `meytonActions.test.ts`)
- `src/lib/sessions/actions/meytonPdfLoaders.ts`
- `src/lib/sessions/actions/attachmentActions.ts`
- `src/lib/sessions/importGuards.ts` (+ `importGuards.test.ts`)
- `src/components/app/admin/AdminEditUserForm.tsx`
  **Aufwand:** Minimal (~10 min)

### T-11: Meyton-Import einmal in der Oberfläche durchspielen

Dialog → Action → Formular wurde mit dem Text-Layer (pdf.js) nie durchgeklickt; belegt ist der Kern über die
Fixture-Tests. Einmal mit je einem PDF beider Druckwege durchspielen.

### T-12: Kleinigkeiten in der Oberfläche

- Admin auf dem Telefon: Nutzer- und Sperren-Tabelle rendern unter `md` je Zeile eine `Card` in der Abschnitts-Card.
- Die Navigation sagt „Ablauf“, die Seite heißt „Schuss-Abläufe“.
- „ss“ statt „ß“: sichtbar ist noch „Datei zu gross“ in `upload.ts` (gehört zu T-10).

### Fachliche Erweiterungen

- Trockentraining als eigener Einheitentyp mit eigenen Feldern.
- Auswertungen über Zusammenhänge, etwa wie die Ergebnisse nach schlechtem Schlaf ausfallen.
- Zugang für Trainer: nur lesend und auf freigegebene Einheiten beschränkt.

---

## Nicht empfohlen

| Thema                             | Grund                                                        |
| --------------------------------- | ------------------------------------------------------------ |
| CSV-Export                        | Feature gestrichen                                           |
| Vollständiges Accessibility-Audit | Internes Tool, kein öffentlicher Dienst                      |
| Strukturiertes Logging            | `console.warn/-error` ausreichend für Container-Logs         |
| E2E-Tests                         | Kein CI/CD-Setup vorhanden                                   |
| `hasRun` Race-Condition fix       | Kein echtes Problem: Node.js single-threaded, Guard synchron |
