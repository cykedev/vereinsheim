import type { Metadata } from "next"

import { ProfileScreen } from "@/components/profile/ProfileScreen"
import { isAdmin, requireSession } from "@/lib/auth-helpers"
import { deviceScoring } from "@/lib/device"

export const metadata: Metadata = { title: "Profil" }

export default async function ProfileRoute() {
  const session = await requireSession()
  return (
    <ProfileScreen
      name={session.user.name ?? null}
      email={session.user.email ?? ""}
      isAdmin={isAdmin(session.user.role)}
      scoring={await deviceScoring()}
    />
  )
}
