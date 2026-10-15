"use client"

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  type AnchorHTMLAttributes,
  type ElementType,
  type MouseEvent,
  type ReactNode,
} from "react"

import { urlFromRoute, type Route } from "./routes"

/**
 * Wie Links Adressen bilden und ob ein Klick abgefangen wird. Ohne Provider: `<a>` mit der Adresse
 * aus `urlFromRoute`, der Browser folgt ihm. Ein Provider kann jeden Klick abfangen (`navigate`);
 * die App setzt `next/link` als Komponente.
 */
export interface RouteLinkContextValue {
  href?: (route: Route) => string
  navigate?: (route: Route) => void
  component?: ElementType
}

const RouteLinkContext = createContext<RouteLinkContextValue>({})

export function RouteLinkProvider({
  value,
  children,
}: {
  value: RouteLinkContextValue
  children?: ReactNode
}) {
  return <RouteLinkContext.Provider value={value}>{children}</RouteLinkContext.Provider>
}

/** ein einfacher Klick mit der linken Taste; mit Strg, Cmd, Shift, Alt oder einer anderen Taste entscheidet der Browser */
export function shouldIntercept(event: {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

export type RouteLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  route: Route
  children?: ReactNode
  /** Kennzeichen für Prüfung und Stil wie `data-area` */
  [data: `data-${string}`]: string | number | boolean | undefined
}

/** ein Link auf eine Seite von Spiegel; Wege zwischen Seiten laufen über ihn, nicht über Rückrufe */
export function RouteLink({ route, children, onClick, ...rest }: RouteLinkProps) {
  const { href = urlFromRoute, navigate, component = "a" } = useContext(RouteLinkContext)
  return createElement(
    component,
    {
      href: href(route),
      ...rest,
      onClick: (event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event)
        // ein eigenes Ziel (neuer Tab, Download) bleibt beim Browser, wie bei next/link
        const ownTarget = rest.target !== undefined && rest.target !== "_self"
        if (event.defaultPrevented || !navigate || ownTarget || !shouldIntercept(event)) return
        event.preventDefault()
        navigate(route)
      },
    },
    children
  )
}

/** zu einer Seite gehen, wo kein Link sein kann (die ganze Zeile einer Tabelle): wie ein Klick auf `RouteLink` */
export function useRouteNavigate(): (route: Route) => void {
  const { href = urlFromRoute, navigate } = useContext(RouteLinkContext)
  return useCallback(
    (route: Route) => (navigate ? navigate(route) : window.location.assign(href(route))),
    [href, navigate]
  )
}
