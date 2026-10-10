import bcrypt from "bcryptjs"
import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

import { authorizeCredentials } from "@vereinsheim/lib/auth/credentials"

import {
  checkLoginAllowed,
  clearSuccessfulLoginAttempts,
  registerFailedLoginAttempt,
} from "@/lib/auth-rate-limit"
import { AUTH_SECRET } from "@/lib/auth-secret"
import { db } from "@/lib/db"

// CSRF-Schutz: Next.js Server Actions sind durch den Same-Origin-Check des Browsers geschützt; NextAuth prüft zusätzlich
// den Origin-Header bei POST-Requests. Ein eigener CSRF-Token ist deshalb nicht nötig.

// NextAuth v4 Konfiguration, wie Ringwerk: ausschließlich E-Mail und Passwort, kein OAuth, kein Magic Link.
// Keine Selbstregistrierung; Konten legt der Admin an ([[spiegel-privacy]]). Der Ablauf der Anmeldung (Ratenbegrenzung,
// Zeitausgleich, IP aus Proxy-Headern) liegt in `@vereinsheim/lib/auth/credentials`, gemeinsam für alle Apps.

export const authOptions: NextAuthOptions = {
  secret: AUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials, req) {
        return authorizeCredentials(credentials, req?.headers, {
          rateLimit: {
            checkLoginAllowed,
            registerFailedLoginAttempt,
            clearSuccessfulLoginAttempts,
          },
          findUserByEmail: (email) =>
            db.user.findUnique({
              where: { email },
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                sessionVersion: true,
                isActive: true,
                passwordHash: true,
              },
            }),
          comparePassword: (password, hash) => bcrypt.compare(password, hash),
          // Proxy-Headern nur vertrauen, wenn die Umgebung es ausdrücklich erlaubt (sonst fälschbar)
          trustProxyHeaders: process.env.AUTH_TRUST_PROXY_HEADERS === "true",
        })
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    // JWT-Callback: Rolle und ID in den Token schreiben, damit sie in der Session verfügbar sind
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as {
          id: string
          role: string
          name?: string | null
          sessionVersion?: number
        }
        token.id = authUser.id
        token.role = authUser.role
        token.name = authUser.name ?? null
        token.sessionVersion = authUser.sessionVersion ?? 0
      }
      return token
    },

    // Session-Callback: id und role aus dem Token in die Session übertragen
    // Ohne das wären id und role nur im Token, nicht in session.user verfügbar
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.name = (token.name as string | null | undefined) ?? null
        session.user.sessionVersion =
          typeof token.sessionVersion === "number" ? token.sessionVersion : -1
      }
      return session
    },
  },

  pages: {
    // Eigene Login-Seite statt der Standard-NextAuth-Seite
    signIn: "/login",
  },
}
