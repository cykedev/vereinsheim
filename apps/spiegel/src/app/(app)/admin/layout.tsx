import { redirect } from "next/navigation"

import { isAdmin, requireSession } from "@/lib/auth-helpers"

// Admin nur für Admins (zweite Schicht hinter proxy.ts, mit der Rolle aus der Datenbank)
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  if (!isAdmin(session.user.role)) redirect("/")
  return children
}
