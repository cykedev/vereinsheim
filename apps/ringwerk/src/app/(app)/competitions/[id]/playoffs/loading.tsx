import { Skeleton } from "@vereinsheim/ui/skeleton"

export default function PlayoffsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-8">
        {Array.from({ length: 3 }).map((_, col) => (
          <div key={col} className="flex flex-col gap-6">
            {Array.from({ length: 4 }).map((_, row) => (
              <Skeleton key={row} className="h-20 w-44" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
