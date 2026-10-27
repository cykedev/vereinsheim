"use client"

import { useState } from "react"

import { KIND_TEXT } from "@vereinsheim/shot-ui/list/KindMark"
import { Button } from "@vereinsheim/ui/button"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { Sheet } from "@vereinsheim/ui/design2/sheet"

import type { CardKind } from "@/generated/prisma/enums"
import type { NewCardChoice, NewCardOption } from "@/lib/fetch-card/queries"

import { DisciplineChoice } from "../card/DisciplineChoice"

const KINDS = (["training", "competition"] as const).map((value) => ({
  value,
  label: KIND_TEXT[value],
}))

/**
 * Blatt „Neue Scheibe“: Die Scheibe liegt noch nicht in Spiegel. Der Schütze wählt Disziplin und Art, vorbelegt mit
 * seiner letzten Scheibe; ohne Disziplin bleibt der Knopf gesperrt. Ohne Rückfrage: Holen ist der ausdrückliche Wunsch,
 * der Rückweg ist Löschen.
 */
export function NewCardSheet({
  open,
  onClose,
  idLine,
  relifts,
  options,
  preset,
  pending,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  /** „ID ff914420 vom Di 27.10.2026“ */
  idLine: string
  /** der Schütze hatte die Scheibe gelöscht; Holen hebt die Sperre auf */
  relifts: boolean
  options: readonly NewCardOption[]
  preset: { disciplineId: number | null; kind: CardKind }
  pending: boolean
  onCreate: (choice: NewCardChoice) => void
}) {
  const [disciplineId, setDisciplineId] = useState(preset.disciplineId)
  const [kind, setKind] = useState<CardKind>(preset.kind)

  return (
    <Sheet open={open} onClose={onClose} title="Neue Scheibe">
      <div data-new-card className="grid gap-4">
        <p className="text-sm text-foreground-2">
          Diese Scheibe liegt noch nicht in Spiegel. Spiegel legt sie an und holt die Werte von der
          Anlage. Wähle Disziplin und Art. Liefert die Anlage die Scheibe, gilt ihre Disziplin.
        </p>
        <p data-new-card-id className="text-sm font-semibold">
          {idLine}
        </p>
        {relifts && (
          <p data-new-card-relift className="text-sm text-foreground-2">
            Diese Scheibe hattest du gelöscht. Spiegel holt sie wieder.
          </p>
        )}
        <DisciplineChoice
          options={options.map((option) => ({ ...option, current: option.id === disciplineId }))}
          onChoose={(option) => setDisciplineId(option.id)}
        />
        <div data-kind-option className="grid gap-2">
          <p className="text-[13px] font-semibold text-muted-foreground">Art</p>
          <Segmented label="Art" options={KINDS} value={kind} onChange={setKind} />
        </div>
        <div className="grid gap-2">
          <Button
            type="button"
            data-new-card-create
            className="h-10"
            disabled={pending || disciplineId === null}
            onClick={() => disciplineId !== null && onCreate({ disciplineId, kind })}
          >
            {pending ? "Anlegen…" : "Scheibe anlegen"}
          </Button>
          {disciplineId === null && (
            <p data-new-card-missing className="text-sm text-muted-foreground">
              Wähle eine Disziplin.
            </p>
          )}
        </div>
      </div>
    </Sheet>
  )
}
