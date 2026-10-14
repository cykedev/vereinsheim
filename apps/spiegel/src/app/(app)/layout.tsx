import { AppShell } from "@/components/shell/AppShell"
import { isAdmin, requireSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { pendingCount } from "@/lib/db/reads"

// Alles hier braucht eine gültige Sitzung (zweite Schicht hinter proxy.ts, gegen die Datenbank geprüft). Den Wechsel
// eines Passworts vom Admin erzwingt jede Seite selbst (`requireSession`); das Layout läuft auch für die Passwortseite
// und leitete sie sonst auf sich selbst um.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession({ passwordChange: true })
  // die Zahl am Start-Symbol: SportpassIDs mit einer wartenden ersten Scheibe (SP-1.7 a2); die Actions dort
  // erneuern das Layout (`revalidatePath("/", "layout")`)
  const openCount = await pendingCount(db, session.user.id)
  return (
    <AppShell isAdmin={isAdmin(session.user.role)} openCount={openCount}>
      {children}
    </AppShell>
  )
}
