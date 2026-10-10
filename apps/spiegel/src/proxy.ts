import { withAuth } from "next-auth/middleware"

import { AUTH_SECRET } from "@/lib/auth-secret"

// Next.js 16: Datei-Konvention „proxy.ts“ statt „middleware.ts“. Alles braucht eine Anmeldung außer der Seite
// selbst, NextAuth und statischen Dateien; /admin nur für Admins. Seiten prüfen die Sitzung zusätzlich gegen die
// Datenbank (`requireSession`), weil das JWT ein deaktiviertes Konto nicht kennt.
export const proxy = withAuth({
  secret: AUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized: ({ req, token }) => {
      if (!token) return false
      if (req.nextUrl.pathname.startsWith("/admin")) return token.role === "ADMIN"
      return true
    },
  },
})

export default proxy

export const config = {
  // alles unter _next (Dateien, Bilder, die Verbindung des Dev-Servers für Neuladen) bleibt frei
  matcher: ["/((?!login|api/auth|_next/|favicon.ico|icon.svg).*)"],
}
