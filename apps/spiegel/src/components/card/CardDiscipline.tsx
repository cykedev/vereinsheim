"use client"

import { Target } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { Sheet } from "@vereinsheim/ui/design2/sheet"

import { cardDiscipline } from "@/lib/admin/consequences"
import { setCardDiscipline } from "@/lib/card-discipline-actions"
import type { DisciplineOption } from "@/lib/db/cards"

import { ActionRow } from "./ActionRow"
import { DisciplineChoice } from "./DisciplineChoice"

const BUTTON =
  "inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-foreground hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"

/**
 * Disziplin als Zeile im Kasten „Diese Scheibe“: der Name, nach einer eigenen Wahl leise die vom Stand. „Ändern“ öffnet
 * ein Blatt mit den Disziplinen derselben Scheibe; eine Wahl fragt mit Folgen und speichert, danach rechnet die Seite
 * neu. Ohne andere Möglichkeit nur der Name.
 */
export function CardDiscipline({
  cardId,
  when,
  current,
  family,
  scoring,
  stand,
  options,
}: {
  cardId: string
  /** Tag und Uhrzeit der Scheibe wie in Listen, für die Rückfrage */
  when: string
  /** die Disziplin, mit der die Scheibe zählt */
  current: string
  /** ihre Familie; null ohne */
  family: string | null
  /** die Wertung, in der die Scheibe gerade zählt */
  scoring: "decimal" | "rings"
  /** die Disziplin am Stand, wenn eine andere gewählt ist; null ohne eigene Wahl */
  stand: string | null
  options: readonly DisciplineOption[]
}) {
  const router = useRouter()
  const [sheet, setSheet] = useState(false)
  // die Wahl bleibt beim Schließen stehen, damit die Rückfrage nicht im Ausblenden den Text wechselt
  const [chosen, setChosen] = useState<DisciplineOption | null>(null)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const standName = stand ?? current

  return (
    <ActionRow
      data-card-discipline
      title="Disziplin"
      state={
        <>
          <span data-discipline-name className="font-semibold text-foreground">
            {current}
          </span>
          {stand && (
            <span data-stand-discipline className="block">
              Am Stand gewählt: {stand}
            </span>
          )}
        </>
      }
      action={
        options.length > 1 && (
          <button
            type="button"
            aria-label="Disziplin ändern"
            disabled={pending}
            onClick={() => {
              setError(null)
              setSheet(true)
            }}
            className={BUTTON}
          >
            <Target aria-hidden className="size-4" />
            {pending ? "Ändern…" : "Ändern"}
          </button>
        )
      }
    >
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Disziplin ändern">
        <p className="text-sm text-foreground-2">
          Zur Wahl stehen die Disziplinen mit derselben Scheibe. Die Werte der Schüsse bleiben, wie
          Meyton sie gemessen hat.
        </p>
        <DisciplineChoice
          options={options.map((option) => ({
            ...option,
            ...(option.stand ? { note: "am Stand gewählt" } : {}),
          }))}
          onChoose={(option) => {
            setSheet(false)
            if (option.current) return
            setChosen(option)
            setAsking(true)
          }}
        />
      </Sheet>
      {chosen && (
        <DecisionDialog
          decision={cardDiscipline({
            evening: when,
            from: current,
            to: chosen.name,
            stand: standName,
            back: chosen.stand,
            family: chosen.family !== family ? chosen.family : null,
            scoring: chosen.scoring !== scoring ? chosen.scoring : null,
          })}
          open={asking}
          onOpenChange={setAsking}
          onConfirm={() =>
            startTransition(async () => {
              setError(null)
              const result = await setCardDiscipline(cardId, chosen.id)
              if ("error" in result) {
                setError(getErrorMessage(result) ?? "Die Disziplin ließ sich nicht speichern.")
                return
              }
              router.refresh()
            })
          }
        />
      )}
    </ActionRow>
  )
}
