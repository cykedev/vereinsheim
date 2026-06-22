import Link from "next/link"
import { Plus, ScrollText } from "lucide-react"
import { getUsers } from "@/lib/users/queries"
import { getAdminLoginRateLimitInsights } from "@/lib/admin/actions"
import { Button } from "@vereinsheim/ui/button"
import { Badge } from "@vereinsheim/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@vereinsheim/ui/card"
import { UserRowActions } from "@/components/app/users/UserRowActions"
import { AdminLoginRateLimitTable } from "@/components/app/admin/AdminLoginRateLimitTable"
import { AdminLoginRateLimitInsightsPanel } from "@/components/app/admin/AdminLoginRateLimitInsights"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"

export default async function AdminUsersPage() {
  const [users, rateLimitInsights] = await Promise.all([
    getUsers(),
    getAdminLoginRateLimitInsights(),
  ])

  const active = users.filter((u) => u.isActive)
  const inactive = users.filter((u) => !u.isActive)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <PageHeader
        title="Nutzerverwaltung"
        description="App-Zugänge verwalten"
        action={
          <div className="flex gap-2 self-start">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/audit-log">
                <ScrollText className="mr-1 h-4 w-4" />
                Protokoll
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/users/new">
                <Plus className="mr-1 h-4 w-4" />
                Neuer Nutzer
              </Link>
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border bg-card">
        {active.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Keine Nutzer vorhanden.
          </p>
        ) : (
          <div className="divide-y">
            {active.map((user) => (
              <div key={user.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {user.name ?? <span className="text-muted-foreground italic">Kein Name</span>}
                    </span>
                    <Badge
                      variant={user.role === "ADMIN" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {user.role === "ADMIN"
                        ? "Admin"
                        : user.role === "MANAGER"
                          ? "Manager"
                          : "Benutzer"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <UserRowActions userId={user.id} userName={user.name} isActive={user.isActive} />
              </div>
            ))}
          </div>
        )}
      </div>

      {inactive.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-muted-foreground">Inaktiv ({inactive.length})</p>
          <div className="rounded-lg border bg-card opacity-60">
            <div className="divide-y">
              {inactive.map((user) => (
                <div key={user.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm line-through text-muted-foreground">
                        {user.name ?? <span className="italic">Kein Name</span>}
                      </span>
                      <Badge
                        variant={user.role === "ADMIN" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {user.role === "ADMIN"
                          ? "Admin"
                          : user.role === "MANAGER"
                            ? "Manager"
                            : "Benutzer"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <UserRowActions userId={user.id} userName={user.name} isActive={user.isActive} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Aktive Login-Sperren ({rateLimitInsights.activeBlockedBuckets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AdminLoginRateLimitTable buckets={rateLimitInsights.activeBlockedBuckets} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Login-Rate-Limit Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminLoginRateLimitInsightsPanel insights={rateLimitInsights} />
        </CardContent>
      </Card>
    </div>
  )
}
