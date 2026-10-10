import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  // Seiten setzen nur ihren eigenen Titel; das Template hängt den App-Namen an.
  title: { default: "Spiegel", template: "%s · Spiegel" },
  description: "Schussdaten der Vereinsanlage: jede Scheibe, jeder Schuss, der eigene Verlauf",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  )
}
