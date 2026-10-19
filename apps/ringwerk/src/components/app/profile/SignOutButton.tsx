"use client"

import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@vereinsheim/ui/button"

/** Abmelden ohne Umleitung durch NextAuth (die baut sie aus NEXTAUTH_URL); die Anmeldung liegt auf demselben Host */
export function SignOutButton() {
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)
  return (
    <Button
      variant="outline"
      className="h-10"
      disabled={leaving}
      onClick={async () => {
        setLeaving(true)
        await signOut({ redirect: false })
        router.replace("/login")
        router.refresh()
      }}
    >
      {leaving ? "Abmelden…" : "Abmelden"}
    </Button>
  )
}
