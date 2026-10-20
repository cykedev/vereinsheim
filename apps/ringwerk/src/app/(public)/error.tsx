"use client"

import { useEffect } from "react"
import { Button } from "@vereinsheim/ui/button"

// Fehler im öffentlichen Bereich (Anmeldung), im Stil der übrigen Fehlerseiten; „Nochmal“ rendert die Seite neu
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler im Login-Bereich:", msg)
  }, [error])

  return (
    <div className="mx-auto grid max-w-2xl gap-3 px-4 py-12">
      <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
        Etwas ist schiefgegangen
      </h1>
      <p className="text-foreground-2">
        Die Seite ließ sich nicht laden. Versuch es gleich noch einmal.
      </p>
      <Button className="h-10 justify-self-start" onClick={reset}>
        Nochmal
      </Button>
    </div>
  )
}
