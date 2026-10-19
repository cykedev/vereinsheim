import { Skeleton } from "@vereinsheim/ui/skeleton"

// Die Statistik liest die Einheiten und rechnet auf dem Server; ohne Platzhalter bliebe die Seite bis dahin leer.
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  )
}
