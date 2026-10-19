import type { Metadata } from "next"
import { LoginForm } from "@/components/app/auth/LoginForm"

export const metadata: Metadata = { title: "Anmelden" }

// Anmeldung ohne Rahmen der App. Kein Self-Service: Konten legt der Admin an.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordChanged?: string }>
}) {
  const params = await searchParams
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <p className="font-display text-3xl font-bold tracking-tight">Ringwerk</p>
          <p className="text-sm text-muted-foreground">Zugang nur für registrierte Nutzer.</p>
        </div>
        <LoginForm passwordChanged={params.passwordChanged === "1"} />
      </div>
    </main>
  )
}
