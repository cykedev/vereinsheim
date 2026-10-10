import { db } from "@/lib/db"

/** ein Konto, wie die Verwaltung es zeigt (ohne Passwort) */
export interface UserSummary {
  id: string
  name: string | null
  email: string
  role: "ADMIN" | "USER"
  isActive: boolean
}

const SELECT = { id: true, name: true, email: true, role: true, isActive: true } as const

/** alle Konten, aktive zuerst, nach Name und E-Mail (nur für Admin-Seiten) */
export async function getUsers(): Promise<UserSummary[]> {
  return db.user.findMany({
    select: SELECT,
    orderBy: [{ isActive: "desc" }, { name: "asc" }, { email: "asc" }],
  })
}

export async function getUser(id: string): Promise<UserSummary | null> {
  return db.user.findUnique({ where: { id }, select: SELECT })
}
