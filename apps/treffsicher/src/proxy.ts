import { NextResponse } from "next/server"
import { withAuth } from "next-auth/middleware"

import { isAdminPath } from "@/lib/admin-path"

// Next.js 16 nutzt die Datei-Konvention "proxy.ts" statt "middleware.ts".
// Alle geschützten Routen erfordern Login; /admin nur für Admins, ein anderes Konto geht zum Start.
export const proxy = withAuth(
  (req) => {
    if (isAdminPath(req.nextUrl.pathname) && req.nextauth.token?.role !== "ADMIN")
      return NextResponse.redirect(new URL("/", req.url))
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
  }
)

export default proxy

// Alle Routen unter /(app)/ sind geschützt.
// Nicht eingeloggte Nutzer werden automatisch zur Login-Seite weitergeleitet.
// Die Route-Group-Klammern (app) erscheinen nicht in der URL,
// aber der Matcher muss das Dateisystem-Muster verwenden.
export const config = {
  matcher: [
    // Schützt alle Routen die im (app)-Ordner liegen
    "/dashboard/:path*",
    "/sessions/:path*",
    "/disciplines/:path*",
    "/statistics/:path*",
    "/shot-routines/:path*",
    "/goals/:path*",
    "/profile/:path*",
    "/account/:path*",
    "/admin/:path*",
  ],
}
