"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@vereinsheim/ui/button"

// Fehler beim Laden einer Einheit, im Stil der übrigen Fehlerseiten; „Nochmal“ rendert die Seite neu, der zweite Knopf
// führt zurück ins Tagebuch
export default function SessionDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto grid max-w-2xl gap-3 px-4 py-12">
      <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
        Die Einheit ließ sich nicht laden
      </h1>
      <p className="text-foreground-2">Versuch es gleich noch einmal.</p>
      <div className="flex flex-wrap gap-2">
        <Button className="h-10" onClick={reset}>
          Nochmal
        </Button>
        <Button className="h-10" variant="outline" asChild>
          <Link href="/sessions">Zum Tagebuch</Link>
        </Button>
      </div>
    </div>
  )
}
