import type { Metadata } from "next"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { AdminHeader } from "@/components/admin/AdminHeader"
import { DisciplineList } from "@/components/admin/DisciplineList"
import { FamilyForms } from "@/components/admin/FamilyForms"
import { Page } from "@vereinsheim/ui/design2/page"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { cn } from "@vereinsheim/lib/utils"
import { disciplineOverview } from "@/lib/admin/disciplines"
import { requireAdmin } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Disziplinen" }

// Disziplinen (Admin): neue zuerst, dann je Familie, ignorierte eingeklappt; darunter die Familien. Jede Änderung mit
// Folgen fragt (`DecisionDialog`)
export default async function AdminDisciplinesRoute() {
  await requireAdmin()
  const { rows, families } = await disciplineOverview(getDisplayTimeZone())
  return (
    <Page>
      <section className={cn("grid gap-4", PAGE_SINGLE)}>
        <AdminHeader current="disciplines" title="Disziplinen" help="discipline">
          Meyton nennt jede Disziplin mit Nummer und Namen. Hier legst du fest, wie Spiegel ihre
          Scheiben zeigt und zählt. Neue Disziplinen legt Spiegel selbst an, sobald die erste
          Scheibe kommt.
        </AdminHeader>
        {rows.length ? (
          <DisciplineList rows={rows} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Die Disziplinen erscheinen hier, sobald die ersten Scheiben da sind.
          </p>
        )}
        <FamilyForms families={families} />
      </section>
    </Page>
  )
}
