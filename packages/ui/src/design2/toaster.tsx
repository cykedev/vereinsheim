"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { useTheme } from "./theme/ThemeProvider"

/**
 * Rückmeldungen nach einer Aktion (sonner) in Design 2: Kartenfläche, kräftige Linie, große Radien; hell oder dunkel
 * wie die Darstellung der App (aufgelöst, „System“ folgt dem Gerät).
 */
export function Toaster(props: ToasterProps) {
  const { resolved } = useTheme()
  return (
    <Sonner
      theme={resolved}
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
