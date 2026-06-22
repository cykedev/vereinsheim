"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function PublicError({ error, reset }: Props) {
  useEffect(() => {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler im Login-Bereich:", msg)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <h2 className="text-lg font-semibold">Etwas ist schiefgelaufen</h2>
      <p className="text-sm text-muted-foreground">Ein unerwarteter Fehler ist aufgetreten.</p>
      <Button onClick={reset} variant="outline">
        Seite neu laden
      </Button>
    </div>
  )
}
