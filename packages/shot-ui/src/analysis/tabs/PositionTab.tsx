"use client"

import { drift, mpiConfidence, mpiPath, ringLossSplit } from "@vereinsheim/shot-core/analysis"
import { ToggleChip } from "@vereinsheim/ui/design2/toggle-chip"

import { directionWords, formatValue, ringsText } from "../../format"
import { NO_CENTER, NO_FULL_POSITION } from "../../reasons"
import { ChartSlot } from "../charts/frame"
import { PathChart } from "../charts/PathChart"
import { AnalysisCard, KeyValues, Muted, Note, Verdict } from "../parts"
import { shownRingLoss } from "../ringLoss"
import { ClockCard } from "./ClockCard"
import type { CardContext, CardSpec } from "./index"

/** Ellipse als Symbol des Schalters */
const EllipseIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <ellipse cx={8} cy={8} rx={6.5} ry={4} transform="rotate(-30 8 8)" />
  </svg>
)

/** Lage: Ist die Lage versetzt?, Ringverlust nach Ursache, Richtungsuhr, Drift und Wanderung, über die Grundlage */
export function positionCards({
  input,
  explain,
  layers,
  onToggleLayer,
  onHelp,
}: CardContext): CardSpec[] {
  const { base, card, scoring, target } = input
  const confidence = mpiConfidence(base)
  const split = ringLossSplit(base, target)
  const wander = drift(base, card)
  const digits = scoring === "rings" ? 0 : 1
  const rings = (v: number) => formatValue(v, digits)
  const key = scoring === "rings" ? "rings" : "decimal"

  return [
    {
      key: "lage-echt",
      element: (
        <AnalysisCard help="lage-echt" explain={explain} onHelp={onHelp}>
          {confidence ? (
            <>
              <KeyValues
                rows={[
                  ["Schwerpunkt", directionWords(confidence.center)],
                  [
                    "Abstand zur Mitte",
                    `${formatValue(Math.hypot(confidence.center.xUm, confidence.center.yUm) / 1000, 2)} mm`,
                  ],
                  [
                    "Hotelling-T²",
                    <>
                      {formatValue(confidence.t2, 1)}
                      <Muted>{` gegen ${formatValue(confidence.critical, 1)} (95 %)`}</Muted>
                    </>,
                  ],
                ]}
              />
              <div className="flex flex-wrap items-center gap-2">
                {confidence.real ? (
                  <Verdict tone="warn">sicher versetzt</Verdict>
                ) : (
                  <Verdict tone="none">kann Zufall sein</Verdict>
                )}
                <ToggleChip
                  pressed={layers.ellipse}
                  onPressedChange={() => onToggleLayer("ellipse")}
                  icon={<EllipseIcon />}
                >
                  Vertrauensellipse auf der Scheibe
                </ToggleChip>
              </div>
              <Note>
                Die Ellipse umschließt mit 95 % den wahren Schwerpunkt. Liegt die Mitte darin, ist
                ein Versatz nicht belegt. Auf der Scheibe gilt die Ellipse für die Auswahl dort;
                dieses Urteil für alle Wertungsschüsse.
              </Note>
            </>
          ) : (
            <Note>{NO_CENTER}</Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "ringverlust-nach-ursache",
      element: (
        <AnalysisCard help="ringverlust-nach-ursache" explain={explain} onHelp={onHelp}>
          {split ? (
            <RingLoss split={split} keyName={key} rings={rings} />
          ) : (
            <Note>ab 2 Schuss mit Lage</Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "richtungsuhr",
      element: <ClockCard shots={base} explain={explain} onHelp={onHelp} />,
    },
    {
      key: "drift-und-wanderung",
      element: (
        <AnalysisCard help="drift-und-wanderung" explain={explain} onHelp={onHelp}>
          {wander ? (
            <>
              <div className="grid gap-1.5">
                <div
                  role="img"
                  aria-label={`von-Neumann-Verhältnis ${formatValue(wander.vonNeumann, 2)}`}
                  className="relative h-3"
                >
                  <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-2" />
                  <span className="absolute top-0 left-1/2 h-3 w-px bg-line-strong" />
                  <span
                    data-dot="true"
                    className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
                    style={{ left: `${(Math.min(4, wander.vonNeumann) / 4) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between gap-2 font-mono text-xs text-muted-foreground">
                  <span>0 wandert</span>
                  <span>2 unabhängig</span>
                  <span>4</span>
                </div>
              </div>
              <KeyValues rows={[["von-Neumann-Verhältnis", formatValue(wander.vonNeumann, 2)]]} />
              {mpiPath(base).length > 1 && (
                <>
                  <ChartSlot height={220}>
                    {(width) => <PathChart width={width} shots={base} />}
                  </ChartSlot>
                  <Note>
                    Schwerpunkt je Serie gegen den Schwerpunkt der Scheibe (Mitte des Feldes). Auch
                    ohne Wandern liegt der Schwerpunkt einer Zehnerserie im Mittel etwa ein Drittel
                    σ neben dem der Scheibe.
                  </Note>
                </>
              )}
              <Note>
                Um 2 sind die Schüsse unabhängig. Deutlich darunter liegen aufeinanderfolgende
                Treffer näher beieinander, als die Gruppe breit ist: Die Gruppe wandert langsam,
                oder mehrere Ausreißer folgen direkt aufeinander. Über 2 springen
                aufeinanderfolgende Treffer eher hin und her.
              </Note>
            </>
          ) : (
            <Note>ab 3 Schuss</Note>
          )}
        </AnalysisCard>
      ),
    },
  ]
}

type Split = NonNullable<ReturnType<typeof ringLossSplit>>

function RingLoss({
  split,
  keyName,
  rings,
}: {
  split: Split
  keyName: "rings" | "decimal"
  rings: (v: number) => string
}) {
  // Lage und Streuung, die zusammen den Ringverlust ergeben: kostet die Lage nichts, trägt die
  // Streuung alles; die Rohzahl steht mit ihrem Grund im Satz darunter
  const shown = shownRingLoss(split, keyName)
  const pos = Math.max(0, shown.position ?? 0)
  const spr = Math.max(0, shown.spread)
  const sum = pos + spr || 1
  const digits = keyName === "rings" ? 0 : 1
  // ohne Ringverlust rechnen Ist und Mitte über weniger Schüsse: das steht dabei
  const over = split.total ? "" : ` (${split.n} Schuss mit Lage)`
  // ein Lage-Anteil bis null kostet nichts: die Mitte ohne den Schuss selbst ist etwas weiter, ein
  // Ausreißer zieht den Schwerpunkt
  const positionText =
    shown.position === null ? "Lage kostet nichts" : `Lage ${rings(shown.position)}`
  return (
    <>
      <div
        role="img"
        // die Werte, nicht die Breiten; ein negativer Lage-Anteil heißt „kostet nichts“, die Zahl im Satz darunter
        aria-label={`${positionText}, Streuung ${rings(shown.spread)} Ringe`}
        className="flex h-3 gap-0.5 overflow-hidden rounded-md bg-surface-2"
      >
        <span
          data-split="position"
          className="block h-full min-w-0 bg-warning"
          style={{ width: `${(pos / sum) * 100}%` }}
        />
        <span
          data-split="spread"
          className="block h-full min-w-0 bg-primary"
          style={{ width: `${(spr / sum) * 100}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1.5 text-[13px] text-muted-foreground">
        <span className="inline-flex items-center gap-[7px]">
          <i className="size-2.5 rounded-sm bg-warning" />
          {positionText}
        </span>
        <span className="inline-flex items-center gap-[7px]">
          <i className="size-2.5 rounded-sm bg-primary" />
          {`Streuung ${rings(shown.spread)}`}
        </span>
      </div>
      <KeyValues
        rows={[
          [
            "Ringverlust",
            split.total ? (
              <>
                {ringsText(split.total[keyName], digits)}
                <Muted> zum Höchstwert</Muted>
              </>
            ) : (
              <>
                –<Muted>{` ${NO_FULL_POSITION}`}</Muted>
              </>
            ),
          ],
          [`Ist${over}`, ringsText(split.actual[keyName], digits)],
          [
            `Gruppe in der Mitte${over}`,
            <>
              {ringsText(split.centered[keyName], digits)}
              <Muted> (geschätzt)</Muted>
            </>,
          ],
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        {split.reliable ? (
          <Verdict tone="ok">belastbar</Verdict>
        ) : (
          <Verdict tone="none">unsicher</Verdict>
        )}
      </div>
      {shown.negative !== null && (
        <Note>{`Deine Gruppe sitzt schon gut; in die Mitte geschoben brächte sie rechnerisch nichts (Lage ${ringsText(shown.negative, digits)}).`}</Note>
      )}
      <Note>
        Jeder Treffer um den Schwerpunkt der übrigen verschoben und neu gewertet: So schätzt
        Spiegel, was dieselben Schüsse mit der Gruppe in der Mitte brächten. Belastbar erst ab 10
        Schuss, wenn die Lage sicher versetzt ist und die Mitte Ringe bringt; nie amtlich.
      </Note>
    </>
  )
}
