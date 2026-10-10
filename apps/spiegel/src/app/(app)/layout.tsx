import { AppShell } from "@/components/shell/AppShell"
import { isAdmin, requireSession } from "@/lib/auth-helpers"

// Alles hier braucht eine gültige Sitzung (zweite Schicht hinter proxy.ts, gegen die Datenbank geprüft).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  return <AppShell isAdmin={isAdmin(session.user.role)}>{children}</AppShell>
}
