// Captured: Session-Provenance (incident/state) — steht in keiner Doc — Quelle für den Doku-Index-Builder (ADR-022).
// Von Hand bzw. via /sync-graph gepflegt; der Builder (.claude/build-graph.mjs)
// mergt sie mit den aus decisions.md geparsten ADRs zu knowledge-graph.json.
// Dieses Artefakt NICHT von Hand editieren.

export default {
  "entities": [
    {
      "name": "stechschuss-modell-flip",
      "entityType": "incident",
      "observations": [
        "2026-06-18 (ringwerk, Best-of-Liga): Das Stechschuss-Modell wurde von 'reiner Match-Entscheid, Satz bleibt 1:1' auf 'Stechschuss-Duell zählt mit, also 2:1' gekippt, nachdem der Domänen-Owner es am echten Datensatz als unintuitiv empfand. Spec-Entscheid, revidierbar. Die Auflösung ist zentral in bestOf.ts gekapselt (stechschussOutcome, eigenes Maß statt league-scoringMode), damit ein erneuter Wechsel nur eine Stelle berührt."
      ]
    },
    {
      "name": "ruleset-lock-granularity",
      "entityType": "incident",
      "observations": [
        "2026-06-18 (ringwerk): Das Liga-Regelset wurde komplett gesperrt, sobald Paarungen existierten (rulesetLocked = matchupCount>0) — inklusive der Playoff-Bracket-Wahl, was einen nicht mehr korrigierbaren Deadlock erzeugte. Lösung: Sperr-Granularität an den Wirk-Zeitpunkt koppeln (Gruppenphase/Format ab matchupCount>0; Playoff/Finale erst ab hasPlayoffsStarted)."
      ]
    },
    {
      "name": "treffsicher-actionresult-migration",
      "entityType": "state",
      "observations": [
        "Offen: Treffsichers Server-Action-Module sind noch nicht vollständig auf den ActionResult-Kanon migriert (diskriminierte Union, shared-conventions §6, Ringwerk-Muster). Geplanter Folgeschritt."
      ]
    },
    {
      "name": "seed-script-orphaned",
      "entityType": "state",
      "observations": [
        "2026-06-17 (ringwerk): prisma.config.ts referenziert 'tsx prisma/seed.ts', aber prisma/seed.ts existiert nicht (weder FS noch git) → /seed bzw. der /db-reset-Seed würde fehlschlagen. Dev-DB-Daten stammen aus manueller App-Eingabe, nicht aus einem Seed-Skript. Vor Verlassen auf /seed prüfen, ob prisma/seed.ts existiert; der Seed-Mechanismus ist aktuell verwaist."
      ]
    }
  ],
  "relations": [
    {
      "from": "stechschuss-modell-flip",
      "to": "ringwerk",
      "relationType": "occurred_in"
    },
    {
      "from": "ruleset-lock-granularity",
      "to": "ringwerk",
      "relationType": "occurred_in"
    },
    {
      "from": "treffsicher-actionresult-migration",
      "to": "treffsicher",
      "relationType": "applies_to"
    },
    {
      "from": "stechschuss-modell-flip",
      "to": "best-of-single",
      "relationType": "applies_to"
    },
    {
      "from": "ruleset-lock-granularity",
      "to": "phase-locking-and-editability",
      "relationType": "refined"
    },
    {
      "from": "treffsicher-actionresult-migration",
      "to": "action-result-convention",
      "relationType": "targets"
    },
    {
      "from": "seed-script-orphaned",
      "to": "ringwerk",
      "relationType": "applies_to"
    }
  ]
}
