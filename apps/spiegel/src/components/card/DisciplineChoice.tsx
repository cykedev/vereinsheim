"use client"

import { Check } from "lucide-react"

/**
 * eine Wahl: ein Knopf je Disziplin, die aktuelle im Akzent wie der gewählte Knopf eines Umschalters (`Segmented`) und
 * mit Häkchen rechts, damit sie sich vom Überfahren unterscheidet. Knöpfe statt Radios: Pfeiltasten in einer
 * Radiogruppe wählten sofort und öffneten die Rückfrage, die Liste ließe sich mit der Tastatur nicht durchgehen
 */
const OPTION =
  "group flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-[14px] hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground aria-[current=true]:hover:bg-primary"

export interface ChoiceOption {
  id: number
  name: string
  /** Anzeige der Familie; null ohne */
  family: string | null
  /** leise unter dem Namen, etwa „am Stand gewählt“ */
  note?: string
  /** die gerade gewählte */
  current: boolean
}

/** die Möglichkeiten nach Familie, in der Reihenfolge der Eingabe */
function byFamily<T extends ChoiceOption>(options: readonly T[]) {
  const groups = new Map<string, T[]>()
  for (const option of options) {
    const key = option.family ?? "Ohne Familie"
    groups.set(key, [...(groups.get(key) ?? []), option])
  }
  return [...groups]
}

/**
 * Disziplinen zur Wahl, nach Familie gruppiert, die aktuelle mit `aria-current`. Eine Stelle für „Disziplin ändern“ an
 * der Scheibe und das Blatt „Neue Scheibe“.
 */
export function DisciplineChoice<T extends ChoiceOption>({
  options,
  onChoose,
}: {
  options: readonly T[]
  onChoose: (option: T) => void
}) {
  return (
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
              onClick={() => onChoose(option)}
              className={OPTION}
            >
              <span className="grid justify-items-start">
                <span>{option.name}</span>
                {option.note && (
                  <span className="text-[12.5px] text-muted-foreground group-aria-[current=true]:text-primary-foreground">
                    {option.note}
                  </span>
                )}
              </span>
              {option.current && (
                <Check aria-hidden data-option-check className="size-4 shrink-0" />
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
