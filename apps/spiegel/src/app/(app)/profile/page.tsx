import type { Metadata } from "next"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { ProfileScreen } from "@/components/profile/ProfileScreen"
import { consentRows } from "@/lib/admin/site"
import { isAdmin, requireSession } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Profil" }

export default async function ProfileRoute() {
  const session = await requireSession()
  return (
    <ProfileScreen
      name={session.user.name ?? null}
      email={session.user.email ?? ""}
      isAdmin={isAdmin(session.user.role)}
      sportpass={(await consentRows(session.user.id, getDisplayTimeZone())).filter(
        (entry) => entry.confirmedAt !== null
      )}
    />
  )
}
