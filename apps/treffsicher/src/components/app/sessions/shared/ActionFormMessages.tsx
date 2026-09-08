import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"

import type { ActionResult } from "@/lib/types"

interface Props {
  // Das rohe Action-Ergebnis; die Komponente leitet Fehler/Erfolg selbst ab.
  state: ActionResult | null
  showInlineSuccess: boolean
  successMessage: string
}

export function ActionFormMessages({ state, showInlineSuccess, successMessage }: Props) {
  const error = getErrorMessage(state)
  const success = state !== null && "success" in state

  return (
    <>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && showInlineSuccess && <p className="text-sm text-success">{successMessage}</p>}
    </>
  )
}
