import type { Metadata } from "next"

import { LoginForm } from "@/components/auth/LoginForm"
import { safeCallback } from "@/lib/callback"

export const metadata: Metadata = { title: "Anmelden" }

// Anmeldung ohne Rahmen der App. Konten legt der Admin an, keine Selbstregistrierung.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; passwordChanged?: string }>
}) {
  const params = await searchParams
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <p className="font-display text-3xl font-bold tracking-tight">Spiegel</p>
          <p className="text-sm text-muted-foreground">Zugang nur für Mitglieder mit Konto.</p>
        </div>
        <LoginForm
          callbackUrl={safeCallback(params.callbackUrl, process.env.NEXTAUTH_URL)}
          passwordChanged={params.passwordChanged === "1"}
        />
      </div>
    </main>
  )
}
