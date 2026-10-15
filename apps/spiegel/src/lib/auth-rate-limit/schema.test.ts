import { describe, expectTypeOf, it } from "vitest"

import type {
  LOGIN_BUCKET_SELECT,
  LoginRateLimitBucketRow,
} from "@vereinsheim/lib/auth/rate-limit/stores"

import type { Prisma } from "@/generated/prisma/client"

// Die Bibliothek kennt die Tabelle nur als Schnittstelle. Liest oder schreibt sie eine Spalte, die das Schema dieser App
// nicht (mehr) hat, sähe der Typ der Tabelle das nicht; diese Prüfung schlägt dann in `tsc` fehl. Zur
// Laufzeit tut sie nichts.
describe("Tabelle LoginRateLimitBucket", () => {
  it("die Zeile der Bibliothek ist genau die Auswahl aus dem Schema", () => {
    expectTypeOf<
      Prisma.LoginRateLimitBucketGetPayload<{ select: typeof LOGIN_BUCKET_SELECT }>
    >().toEqualTypeOf<LoginRateLimitBucketRow>()
  })
})
