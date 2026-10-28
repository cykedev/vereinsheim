"use client"

import { useState } from "react"

import { KIND_TEXT } from "@vereinsheim/shot-ui/list/KindMark"
import { Button } from "@vereinsheim/ui/button"
import { FieldError } from "@vereinsheim/ui/field-error"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { Sheet } from "@vereinsheim/ui/design2/sheet"

import type { CardKind } from "@/generated/prisma/enums"
import type { NewCardChoice, NewCardOption } from "@/lib/fetch-card/queries"
import { newCardIntro } from "@/lib/fetch-card/texts"

import { DisciplineChoice } from "../card/DisciplineChoice"

const KINDS = (["training", "competition"] as const).map((value) => ({
  value,
  label: KIND_TEXT[value],
}))

/**
 * Blatt „Neue Scheibe“: Die Scheibe liegt noch nicht in Spiegel. Der Schütze wählt Disziplin und Art, vorbelegt mit
 * seiner letzten Scheibe; ohne Disziplin sagt der Knopf „Wähle eine Disziplin.“ statt anzulegen. Ohne Rückfrage: Holen ist der ausdrückliche Wunsch,
 * der Rückweg ist Löschen.
 */
export function NewCardSheet({
  open,
  onClose,
  idLine,
  relifts,
  withValues = false,
  intro,
  confirmLabel,
  options,
  preset,
  pending,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  /** „ID ff914420 vom Di 27.10.2026“; fehlt beim Weg von Hand */
  idLine?: string
  /** der Schütze hatte die Scheibe gelöscht; Holen hebt die Sperre auf */
  relifts: boolean
  /** der Ausdruck ist stimmig gelesen: Spiegel legt die Scheibe mit seinen Werten an */
  withValues?: boolean
  /** ein eigener Satz oben (Weg von Hand); fehlt: der zum Ausdruck */
  intro?: string
  /** ein eigener Knopf (Weg von Hand: „Weiter“, ohne „läuft“); fehlt: „Scheibe anlegen“ */
  confirmLabel?: string
  options: readonly NewCardOption[]
  preset: { disciplineId: number | null; kind: CardKind }
  pending: boolean
  onCreate: (choice: NewCardChoice) => void
}) {
  const [disciplineId, setDisciplineId] = useState(preset.disciplineId)
  const [kind, setKind] = useState<CardKind>(preset.kind)
  const [missing, setMissing] = useState(false)

  return (
    <Sheet open={open} onClose={onClose} title="Neue Scheibe">
      <div data-new-card className="grid gap-4">
        <p data-new-card-intro className="text-sm text-foreground-2">
          {intro ?? newCardIntro(withValues)}
        </p>
        {idLine && (
          <p data-new-card-id className="text-sm font-semibold">
            {idLine}
          </p>
        )}
        {relifts && (
          <p data-new-card-relift className="text-sm text-foreground-2">
            Diese Scheibe hattest du gelöscht. Spiegel holt sie wieder.
          </p>
        )}
        <DisciplineChoice
          options={options.map((option) => ({ ...option, current: option.id === disciplineId }))}
          onChoose={(option) => {
            setDisciplineId(option.id)
            setMissing(false)
          }}
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
            disabled={pending}
            {...(missing ? { "aria-describedby": "new-card-missing" } : {})}
            onClick={() => {
              if (disciplineId === null) setMissing(true)
              else onCreate({ disciplineId, kind })
            }}
          >
            {confirmLabel ?? (pending ? "Anlegen…" : "Scheibe anlegen")}
          </Button>
          <FieldError
            id="new-card-missing"
            message={missing ? "Wähle eine Disziplin." : undefined}
          />
        </div>
      </div>
    </Sheet>
  )
}
