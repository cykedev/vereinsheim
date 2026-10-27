"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { EDGE_PX } from "./bar"
import { useTheme } from "./theme/ThemeProvider"

/**
 * sonners Abstand zum Fensterrand über 600 px Breite. Darunter steht hier `EDGE_PX`, derselbe Rand wie der Inhalt (so
 * groß wie sonners eigene Vorgabe dort)
 */
const SONNER_OFFSET_PX = 24
const ABOVE_BAR = "var(--app-bar, 0px) + env(safe-area-inset-bottom)"

/**
 * Rückmeldungen nach einer Aktion (sonner) in Design 2: Kartenfläche, kräftige Linie, große Radien; hell oder dunkel
 * wie die Darstellung der App (aufgelöst, „System“ folgt dem Gerät). Die Toasts stehen über der unteren Leiste des
 * Rahmens und der sicheren Fläche (`--app-bar` aus `design2.css`, auf Seiten ohne Rahmen 0) und neben der schmalen
 * Leiste (`--app-rail`), quer auch neben der Kerbe (`env(safe-area-inset-right)`). sonner wechselt erst unter 600 px
 * auf `mobileOffset`, die Leiste steht bis 1024 px, deshalb beide Abstände.
 */
export function Toaster(props: ToasterProps) {
  const { resolved } = useTheme()
  return (
    <Sonner
      theme={resolved}
      offset={{
        bottom: `calc(${ABOVE_BAR} + ${SONNER_OFFSET_PX}px)`,
        right: `calc(env(safe-area-inset-right) + ${SONNER_OFFSET_PX}px)`,
      }}
      mobileOffset={{
        bottom: `calc(${ABOVE_BAR} + ${EDGE_PX}px)`,
        left: `calc(var(--app-rail, 0px) + ${EDGE_PX}px)`,
      }}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-info" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--card-foreground)",
          "--normal-border": "var(--line-strong)",
          "--border-radius": "calc(var(--radius) + 4px)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
