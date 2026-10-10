"use client"

import { Button } from "@vereinsheim/ui/button"

// Fehler beim Rendern in Design 2 (etwa die Datenbank nicht erreichbar); „Nochmal“ rendert die Seite neu
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto grid max-w-2xl gap-3 px-4 py-12">
      <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
        Etwas ist schiefgegangen
      </h1>
      <p className="text-foreground-2">
        Die Seite ließ sich nicht laden. Versuch es gleich noch einmal.
      </p>
      <Button className="h-10 justify-self-start" onClick={reset}>
        Nochmal
      </Button>
    </main>
  )
}
