// Die Ansichtstypen der Rate-Limit-Verwaltung sind zwischen den Apps geteilt
// (die Oberfläche liegt in @vereinsheim/ui/admin/*).
export type {
  AdminLoginRateLimitBucket,
  AdminLoginRateLimitInsights,
} from "@vereinsheim/lib/auth/rate-limit/adminTypes"
