import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { ProfileScreen } from "@/components/app/profile/ProfileScreen"
import { getAuthSession } from "@/lib/auth-helpers"

export const metadata: Metadata = {
  title: "Profil",
}

export default async function ProfilePage() {
  const session = await getAuthSession()
  if (!session) redirect("/login")

  return (
    <ProfileScreen
      name={session.user.name ?? null}
      email={session.user.email ?? null}
      isAdmin={session.user.role === "ADMIN"}
    />
  )
}
