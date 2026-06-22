# Spec: Preserve Form Values on Validation Error

**Datum:** 2026-05-08
**Branch:** `fix/preserve-form-values-on-validation-error`
**Typ:** Bugfix

## Problem

Beim Erfassen von Werten in Forms (z.B. Kranzl-Serie: Ringwert + Teiler) wird bei einem Validierungsfehler der Server-Action der gesamte Form-Inhalt zurückgesetzt. Wenn der User die Ringe einträgt aber den Teiler vergisst, geht der Ringwert verloren — sehr ärgerlich.

## Root Cause

React 19 setzt bei `<form action={fn}>` mit Server-Action nach jedem Submit alle **uncontrolled** Form-Felder automatisch zurück. Das ist [dokumentiertes Verhalten](https://react.dev/reference/react-dom/components/form). Felder mit `defaultValue` (uncontrolled) springen nach dem Submit auf den ursprünglichen Wert zurück — auch wenn die Action einen Error retourniert.

Forms mit bereits controlled Inputs (`value`/`onChange` + lokalem State) sind nicht betroffen, weil React den State respektiert.

## Betroffene Forms

| Form                  | Pfad                                                  | Use-Case                           |
| --------------------- | ----------------------------------------------------- | ---------------------------------- |
| `EventSeriesDialog`   | `src/components/app/series/EventSeriesDialog.tsx`     | Kranzl-Serie eintragen/korrigieren |
| `SeasonSeriesDialog`  | `src/components/app/series/SeasonSeriesDialog.tsx`    | Saison-Serie eintragen/korrigieren |
| `ParticipantForm`     | `src/components/app/participants/ParticipantForm.tsx` | Teilnehmer anlegen/bearbeiten      |
| `DisciplineForm`      | `src/components/app/disciplines/DisciplineForm.tsx`   | Disziplin anlegen/bearbeiten       |
| `CompetitionForm`     | `src/components/app/competitions/CompetitionForm.tsx` | Wettbewerb anlegen/bearbeiten      |
| `UserCreateForm`      | `src/components/app/users/UserCreateForm.tsx`         | Nutzer anlegen                     |
| `UserEditForm`        | `src/components/app/users/UserEditForm.tsx`           | Nutzer bearbeiten                  |
| `AccountPasswordForm` | `src/components/app/account/AccountPasswordForm.tsx`  | Eigenes Passwort ändern            |

`ResultEntryDialog` (Liga-Ergebnis) ist **nicht** betroffen — der ist bereits controlled.

## Lösung

Alle uncontrolled Inputs (`defaultValue` + `name`) werden auf **controlled Inputs** umgestellt:

- Pro Form-Feld lokaler `useState`
- `value={state}` + `onChange={(e) => setState(e.target.value)}`
- Initial-State aus den existierenden `defaultValue`-Quellen (z.B. `participant?.firstName ?? ""`)
- Bei Server-Action: kein Reset mehr — React respektiert den State
- Nach `success`: Component wird unmounted (Dialog schließt) oder Page-Redirect (Form-Page) — kein expliziter Reset nötig

## Nicht-Ziele

- Kein neuer Helper-Hook bauen — YAGNI. Das Pattern ist 5–10 Zeilen pro Form, nach 8 Forms entscheiden ob Abstraktion lohnt.
- Keine Component-Tests einführen — keine RTL/jsdom-Infrastruktur im Projekt; das wäre eigene Initiative. Verification läuft über `/check` + manueller Browser-Test.
- Selects/Checkboxes die bereits controlled sind, bleiben unverändert (z.B. in `CompetitionForm`: `type`, `scoringMode`, `allowGuests`, `teamSize`, `finalePrimary`, etc.).

## Akzeptanzkriterien

- Bei jedem der 8 Forms: User trägt Werte ein, löst einen Validierungsfehler aus (z.B. Pflichtfeld leer), bekommt Fehlermeldung — alle bereits eingetragenen Werte bleiben sichtbar.
- `/check` ist grün (lint, format, typecheck, tests).
- Bestehende Server-Action-Tests bleiben grün.
