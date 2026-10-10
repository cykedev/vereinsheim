"use client"

import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { MAX_USER_EMAIL_LENGTH } from "@vereinsheim/lib/auth/validation"
import { Button } from "@vereinsheim/ui/button"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"

// Gleiche Meldung für jeden Fehler (falsches Passwort, unbekannte E-Mail, Sperre): verrät nicht, ob es ein Konto gibt.
export function LoginForm({
  callbackUrl,
  passwordChanged,
}: {
  callbackUrl: string
  passwordChanged: boolean
}) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await signIn("credentials", { email, password, redirect: false })
    if (!result || result.error) {
      setError("E-Mail oder Passwort falsch.")
      setPending(false)
      return
    }
    router.replace(callbackUrl)
    router.refresh()
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
      aria-label="Anmelden"
    >
      {passwordChanged && (
        <p className="text-sm text-success">Passwort geändert. Bitte mit dem neuen anmelden.</p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          maxLength={MAX_USER_EMAIL_LENGTH}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Passwort</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>
      {error && (
        <p id="login-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Anmelden…" : "Anmelden"}
      </Button>
    </form>
  )
}
