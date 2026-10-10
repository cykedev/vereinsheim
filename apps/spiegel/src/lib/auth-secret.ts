// Secret für NextAuth (JWT, Cookies). Lokal ohne `.env` derselbe öffentliche Beispielwert wie in `.env.example`, damit
// Spiegel nach dem Klonen startet (wie die Dev-Datenbank in `test/dev-database.ts`). In Produktion nie: Dort fehlt
// der Rückfall, und NextAuth verweigert den Start ohne eigenen Wert.
const DEV_SECRET = "dev-secret-fuer-lokale-entwicklung-min32z"

export const AUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : DEV_SECRET)

// der öffentliche Beispielwert in Produktion (`.env.example` kopiert) hieße: jeder kann Sitzungen fälschen (Review)
if (process.env.NODE_ENV === "production" && process.env.NEXTAUTH_SECRET === DEV_SECRET)
  throw new Error(
    "NEXTAUTH_SECRET ist der Beispielwert aus .env.example: in Produktion einen eigenen setzen"
  )
