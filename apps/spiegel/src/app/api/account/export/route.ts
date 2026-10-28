import { formatIsoDate } from "@vereinsheim/lib/format"
import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { getAuthSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { accountExport } from "@/parts/account"

export const dynamic = "force-dynamic"

// Export der eigenen Daten als eine JSON-Datei (Profil → Deine Daten): nur mit eigener Sitzung, nie im Cache
export async function GET(): Promise<Response> {
  const session = await getAuthSession()
  if (!session || session.user.mustChangePassword) return new Response(null, { status: 401 })
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, createdAt: true },
  })
  if (!user) return new Response(null, { status: 401 })
  const day = formatIsoDate(new Date(), getDisplayTimeZone())
  return new Response(accountExport(db, user), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="spiegel-${day}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
