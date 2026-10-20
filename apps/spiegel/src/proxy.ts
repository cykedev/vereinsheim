import { NextResponse } from "next/server"
import { withAuth } from "next-auth/middleware"

import { isAdminPath } from "@/lib/admin-path"
import { AUTH_SECRET } from "@/lib/auth-secret"

// Next.js 16: Datei-Konvention „proxy.ts“ statt „middleware.ts“. Alles braucht eine Anmeldung außer der Seite
// selbst, einer geteilten Scheibe (`/share/<uuid>`, die Seite prüft den Link), NextAuth, der Ingest-API (Geräte-Token) und
// statischen Dateien; /admin nur für Admins, ein anderes Konto geht
// zum Start. Seiten prüfen die Sitzung zusätzlich gegen die Datenbank (`requireSession`), weil das JWT ein deaktiviertes
// Konto nicht kennt.
export const proxy = withAuth(
  (req) => {
    // ein Konto ohne Admin-Rolle geht zum Start, wie `requireAdmin` auf jeder Admin-Seite
    if (isAdminPath(req.nextUrl.pathname) && req.nextauth.token?.role !== "ADMIN")
      return NextResponse.redirect(new URL("/", req.url))
  },
  {
    secret: AUTH_SECRET,
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
  }
)

export default proxy

export const config = {
  // alles unter _next (Dateien, Bilder, die Verbindung des Dev-Servers für Neuladen) bleibt frei
  // die Ingest-API meldet Brücken über ihren Geräte-Token an, nicht über eine Sitzung
  matcher: [
    "/((?!login(?:/|$)|share(?:/|$)|api/auth(?:/|$)|api/ingest(?:/|$)|_next/|favicon.ico$|icon.svg$).*)",
  ],
}
