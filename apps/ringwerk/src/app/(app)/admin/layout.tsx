import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-helpers"

// Rollen-Guard: nur ADMIN darf Admin-Seiten sehen.
// Zusätzlich zur Middleware-Absicherung in proxy.ts.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession()
  if (!session) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/")

  return <>{children}</>
}
