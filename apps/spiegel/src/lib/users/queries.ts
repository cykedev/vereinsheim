import { requireAdmin } from "@/lib/auth-helpers"
import { consentStatus, sportpassSummary } from "@/lib/consent/status"
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

/** ein Konto in der Liste, dazu der Stand seines Sportpasses in einem Wort (P2c, D5) */
export interface UserListItem extends UserSummary {
  sportpass: string
}

/** alle Konten, aktive zuerst, nach Name und E-Mail (nur für Admins, prüft selbst) */
export async function getUsers(): Promise<UserListItem[]> {
  await requireAdmin()
  const users = await db.user.findMany({
    select: {
      ...SELECT,
      consents: { select: { confirmedAt: true, rejectedAt: true, returnedAt: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }, { email: "asc" }],
  })
  return users.map(({ consents, ...user }) => {
    const sportpass = sportpassSummary(consents.map(consentStatus))
    // ein deaktiviertes Konto bekommt nichts, auch mit aktiver Zustimmung (Review)
    return {
      ...user,
      sportpass:
        user.isActive || sportpass === "kein Sportpass" ? sportpass : `${sportpass} · ruht`,
    }
  })
}

export async function getUser(id: string): Promise<UserSummary | null> {
  await requireAdmin()
  return db.user.findUnique({ where: { id }, select: SELECT })
}
