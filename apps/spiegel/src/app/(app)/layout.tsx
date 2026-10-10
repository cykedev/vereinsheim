import { AppShell } from "@/components/shell/AppShell"
import { isAdmin, requireSession } from "@/lib/auth-helpers"

// Alles hier braucht eine gültige Sitzung (zweite Schicht hinter proxy.ts, gegen die Datenbank geprüft). Den Wechsel
// eines Passworts vom Admin erzwingt jede Seite selbst (`requireSession`); das Layout läuft auch für die Passwortseite
// und leitete sie sonst auf sich selbst um.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession({ passwordChange: true })
  return <AppShell isAdmin={isAdmin(session.user.role)}>{children}</AppShell>
}
