import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getAuditLogs } from "@/lib/auditLog/queries"
import { AuditLogList } from "@/components/app/auditLog/AuditLogList"
import { Button } from "@/components/ui/button"

export default async function AdminAuditLogPage() {
  const entries = await getAuditLogs()

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link href="/admin/users">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Verwaltung
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Protokoll</h1>
          <p className="mt-1 text-sm text-muted-foreground">Alle administrativen Aktionen</p>
        </div>
      </div>

      <AuditLogList entries={entries} showLeagueName />
    </div>
  )
}
