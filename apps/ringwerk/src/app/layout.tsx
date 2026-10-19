import type { Metadata, Viewport } from "next"
import { Archivo, Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider, ThemeScript } from "@vereinsheim/ui/design2/theme"
import { Toaster } from "@vereinsheim/ui/design2/toaster"
import { Providers } from "@vereinsheim/ui/shell/Providers"
import { runStartup } from "@/lib/startup"

// Schriften von Design 2, beim Build geladen und selbst ausgeliefert (keine Anfrage an Google beim Aufruf)
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" })
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

/** Schlüssel der Darstellung in `localStorage` */
const THEME_KEY = "ringwerk-theme"

export const viewport: Viewport = { viewportFit: "cover" }

export const metadata: Metadata = {
  // Seiten setzen nur ihren eigenen Titel; das Template hängt den App-Namen an.
  title: { default: "Ringwerk", template: "%s · Ringwerk" },
  description: "Vereinsinterne Wettbewerbs-Plattform für Schützenvereine",
}

// Die App nutzt Session- und DB-abhängige Serverlogik.
// Kein statisches Prerendering im Build erzwingen, damit Build ohne Live-DB möglich ist.
export const dynamic = "force-dynamic"

// Root-Layout ist eine Server-Komponente und wird nur einmal pro Request ausgeführt.
// runStartup() prüft beim ersten App-Start ob ein Admin angelegt werden muss.
// Die Funktion bricht früh ab wenn bereits ein Admin existiert (hasRun-Flag).
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  await runStartup()

  return (
    <html
      lang="de"
      data-app="ringwerk"
      suppressHydrationWarning
      className={`${archivo.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <head>
        <ThemeScript storageKey={THEME_KEY} />
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        <ThemeProvider storageKey={THEME_KEY}>
          <Providers>{children}</Providers>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
