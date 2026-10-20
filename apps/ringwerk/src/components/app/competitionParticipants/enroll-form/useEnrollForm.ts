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
    const formData = new FormData(formRef.current)

    startTransition(async () => {
      const result = await action(null, formData)
      if ("error" in result) {
        // Eingaben bleiben stehen: nach dem Korrigieren geht nichts verloren, auch nicht die Ausnahme
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Einschreiben.")
        return
      }
      setIsGuest(false)
      setNewTeam(false)
      setExemptFromMinSeries(false)
      setFormKey((k) => k + 1)
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
