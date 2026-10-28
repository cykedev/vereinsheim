import type { Metadata } from "next"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { ProfileScreen } from "@/components/profile/ProfileScreen"
import { consentRows } from "@/lib/consent/queries"
import { db } from "@/lib/db"
import { trashCount } from "@/lib/db/reads"
import { isAdmin, requireSession } from "@/lib/auth-helpers"
import { profileParts } from "@/parts/profile"

export const metadata: Metadata = { title: "Profil" }

export default async function ProfileRoute() {
  const session = await requireSession()
  const timeZone = getDisplayTimeZone()
  const parts = await profileParts(db, session.user.id)
  const admin = isAdmin(session.user.role)
  const otherAdmins = admin
    ? await db.user.count({
        where: { role: "ADMIN", isActive: true, NOT: { id: session.user.id } },
      })
    : 0
  return (
    <ProfileScreen
      name={session.user.name ?? null}
      email={session.user.email ?? ""}
      isAdmin={admin}
      sportpass={await consentRows(session.user.id, timeZone)}
      trashCount={await trashCount(db, session.user.id)}
      diary={parts.diary}
      lastAdmin={admin && otherAdmins === 0}
    />
  )
}
