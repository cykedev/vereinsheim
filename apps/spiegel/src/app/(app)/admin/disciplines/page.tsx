import type { Metadata } from "next"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { AdminHelp } from "@/components/admin/AdminHelp"
import { AdminTabs } from "@/components/admin/AdminTabs"
import { DisciplineList } from "@/components/admin/DisciplineList"
import { FamilyForms } from "@/components/admin/FamilyForms"
import { Page } from "@vereinsheim/ui/design2/page"
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
      <section className="grid max-w-3xl gap-4">
        <div className="grid gap-3">
          <AdminTabs current="disciplines" />
          <h1 className="flex items-center gap-1 font-display text-[1.7rem] leading-tight font-bold tracking-tight">
            Disziplinen <AdminHelp id="discipline" />
          </h1>
          <p className="text-foreground-2">
            Meyton nennt jede Disziplin mit Nummer und Namen. Hier legst du fest, wie Spiegel ihre
            Scheiben zeigt und zählt. Neue Disziplinen legt Spiegel selbst an, sobald die erste
            Scheibe kommt.
          </p>
        </div>
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
