import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import type { ActionResult } from "@/lib/types"

interface Args {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>
}

export function useEnrollForm({ action }: Args) {
  const [isPending, startTransition] = useTransition()
  const [isGuest, setIsGuest] = useState(false)
  const [newTeam, setNewTeam] = useState(false)
  const [exemptFromMinSeries, setExemptFromMinSeries] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit() {
    if (!formRef.current) return
    // FormData vor dem State-Reset erfassen — hidden inputs haben noch ihre aktuellen Werte
    const formData = new FormData(formRef.current)
    const exempt = exemptFromMinSeries

    // Sofort zurücksetzen, nicht erst nach der Antwort: Die neu geladene Liste kann vor ihr ankommen, und ein Reset
    // danach löschte eine Auswahl, die schon für den nächsten Teilnehmer getroffen ist.
    setIsGuest(false)
    setNewTeam(false)
    setExemptFromMinSeries(false)
    setFormKey((k) => k + 1)

    startTransition(async () => {
      const result = await action(null, formData)
      if ("error" in result) {
        // Die Ausnahme gilt für den nächsten Versuch weiter: Sie ändert später die Rangliste
        setExemptFromMinSeries(exempt)
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Einschreiben.")
      }
    })
  }

  return {
    isPending,
    isGuest,
    setIsGuest,
    newTeam,
    setNewTeam,
    exemptFromMinSeries,
    setExemptFromMinSeries,
    formKey,
    formRef,
    handleSubmit,
  }
}

export type EnrollFormState = ReturnType<typeof useEnrollForm>
