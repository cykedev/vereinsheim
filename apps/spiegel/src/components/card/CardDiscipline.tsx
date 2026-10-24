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

const BUTTON =
  "inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-foreground hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"

/**
 * eine Wahl im Blatt: ein Knopf je Disziplin, die aktuelle getönt. Knöpfe statt Radios: Pfeiltasten in einer Radiogruppe
 * wählten sofort und öffneten die Rückfrage, die Liste ließe sich mit der Tastatur nicht durchgehen
 */
const OPTION =
  "grid w-full cursor-pointer justify-items-start rounded-lg px-2 py-1.5 text-left text-[14px] hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring aria-[current=true]:bg-accent-wash"

/** die Möglichkeiten nach Familie, in der Reihenfolge von `disciplineOptions` */
function byFamily(options: readonly DisciplineOption[]) {
  const groups = new Map<string, DisciplineOption[]>()
  for (const option of options) {
    const key = option.family ?? "Ohne Familie"
    groups.set(key, [...(groups.get(key) ?? []), option])
  }
  return [...groups]
}

/**
 * Disziplin am Ende der Seite einer Scheibe, über dem Teilen: der Name, nach einer eigenen Wahl leise die vom Stand.
 * „Disziplin ändern“ öffnet ein Blatt mit den Disziplinen derselben Scheibe; eine Wahl fragt mit Folgen und speichert,
 * danach rechnet die Seite neu. Ohne andere Möglichkeit nur der Name.
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
    <section
      data-card-discipline
      aria-label="Disziplin"
      className="grid justify-items-start gap-1 pt-2"
    >
      <p className="px-3.5 text-sm">
        <span className="text-muted-foreground">Disziplin </span>
        <span data-discipline-name className="font-semibold">
          {current}
        </span>
      </p>
      {stand && (
        <p data-stand-discipline className="px-3.5 text-sm text-muted-foreground">
          Am Stand gewählt: {stand}
        </p>
      )}
      {options.length > 1 && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null)
            setSheet(true)
          }}
          className={BUTTON}
        >
          <Target aria-hidden className="size-4" />
          {pending ? "Ändern…" : "Disziplin ändern"}
        </button>
      )}
      {error && (
        <p role="alert" className="px-3.5 text-sm text-destructive">
          {error}
        </p>
      )}
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Disziplin ändern">
        <p className="text-sm text-foreground-2">
          Zur Wahl stehen die Disziplinen mit derselben Scheibe. Die Werte der Schüsse bleiben, wie
          Meyton sie gemessen hat.
        </p>
        <div data-discipline-options className="grid gap-3">
          {byFamily(options).map(([name, group]) => (
            <div key={name} role="group" aria-label={name} className="grid gap-1">
              <p className="mb-1 text-[13px] font-semibold text-muted-foreground">{name}</p>
              {group.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  data-discipline-option
                  aria-current={option.current}
                  onClick={() => {
                    setSheet(false)
                    if (option.current) return
                    setChosen(option)
                    setAsking(true)
                  }}
                  className={OPTION}
                >
                  <span>{option.name}</span>
                  {option.stand && (
                    <span className="text-[12.5px] text-muted-foreground">am Stand gewählt</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
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
    </section>
  )
}
