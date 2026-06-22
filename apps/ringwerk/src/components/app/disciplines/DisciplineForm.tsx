"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@vereinsheim/ui/button"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vereinsheim/ui/select"
import type { SerializableDiscipline } from "@/lib/disciplines/types"
import type { ActionResult } from "@/lib/types"
import { getFieldError, getGeneralError } from "@vereinsheim/lib/forms/fieldErrors"
import { FieldError } from "@vereinsheim/ui/field-error"

interface Props {
  discipline?: SerializableDiscipline
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>
}

export function DisciplineForm({ discipline, action }: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(action, null)
  const [name, setName] = useState<string>(discipline?.name ?? "")
  const [scoringType, setScoringType] = useState<string>(discipline?.scoringType ?? "WHOLE")
  const [teilerFaktor, setTeilerFaktor] = useState<string>(
    discipline?.teilerFaktor?.toString() ?? "1.0"
  )

  useEffect(() => {
    if (state && "success" in state && state.success) {
      toast.success("Disziplin gespeichert.")
      router.push("/disciplines")
    } else if (state && "error" in state && typeof state.error === "string") {
      toast.error(state.error)
    }
  }, [state, router])

  const nameError = getFieldError(state, "name")
  const scoringTypeError = getFieldError(state, "scoringType")
  const teilerFaktorError = getFieldError(state, "teilerFaktor")
  const generalError = getGeneralError(state)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Luftpistole"
          disabled={isPending}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "name-error" : undefined}
        />
        <FieldError id="name-error" message={nameError} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="scoringType">Wertungsart</Label>
        <Select
          name="scoringType"
          value={scoringType}
          onValueChange={setScoringType}
          disabled={isPending}
        >
          <SelectTrigger id="scoringType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="WHOLE">Ganzringe (max. 100/Serie)</SelectItem>
            <SelectItem value="DECIMAL">Zehntelringe (max. 109/Serie)</SelectItem>
          </SelectContent>
        </Select>
        <FieldError id="scoringType-error" message={scoringTypeError} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="teilerFaktor">Teiler-Faktor</Label>
        <Input
          id="teilerFaktor"
          name="teilerFaktor"
          type="number"
          step="0.001"
          min="0.001"
          max="9.999"
          value={teilerFaktor}
          onChange={(e) => setTeilerFaktor(e.target.value)}
          placeholder="z.B. 0.333"
          disabled={isPending}
          aria-invalid={teilerFaktorError ? true : undefined}
          aria-describedby={teilerFaktorError ? "teilerFaktor-error" : undefined}
        />
        <p className="text-xs text-muted-foreground">
          Korrekturfaktor für gemischte Wertungen. Teiler wird mit diesem Faktor multipliziert.
        </p>
        <FieldError id="teilerFaktor-error" message={teilerFaktorError} />
      </div>

      {generalError && <p className="text-sm text-destructive">{generalError}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Speichern…" : "Speichern"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isPending}>
          Abbrechen
        </Button>
      </div>
    </form>
  )
}
