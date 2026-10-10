import { requireAdmin } from "@/lib/auth-helpers"

// Admin nur für Admins: eine Schicht von mehreren (proxy.ts, jede Seite und Abfrage prüft selbst, `requireAdmin`)
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return children
}
