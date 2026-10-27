import type { Metadata, Viewport } from "next"
import { Archivo, Geist, Geist_Mono } from "next/font/google"

import { ThemeProvider, ThemeScript } from "@vereinsheim/ui/design2/theme"
import { Toaster } from "@vereinsheim/ui/design2/toaster"

import "./globals.css"

// Schriften von Design 2, beim Build geladen und selbst ausgeliefert (keine Anfrage an Google beim Aufruf)
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" })
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  // Seiten setzen nur ihren eigenen Titel; das Template hängt den App-Namen an.
  title: { default: "Spiegel", template: "%s · Spiegel" },
  description: "Schussdaten der Vereinsanlage: jede Scheibe, jeder Schuss, der eigene Verlauf",
}

export const viewport: Viewport = { viewportFit: "cover" }

/** Schlüssel der Darstellung in `localStorage`; eine schon getroffene Wahl bleibt unter ihm bestehen */
const THEME_KEY = "spiegel-theme"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${archivo.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <head>
        <ThemeScript storageKey={THEME_KEY} />
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        <ThemeProvider storageKey={THEME_KEY}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
