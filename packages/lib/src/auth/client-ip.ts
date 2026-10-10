// Die IP des Clients für die Ratenbegrenzung der Anmeldung, aus den Headern eines Reverse-Proxys (wie Caddy). Proxy-
// Headern wird nur vertraut, wenn die Umgebung es ausdrücklich erlaubt (`AUTH_TRUST_PROXY_HEADERS=true`), sonst könnte
// ein Client eigene IPs schicken. Gemeinsam für Ringwerk, Treffsicher und Spiegel (vorher je App kopiert).

import { isIP } from "node:net"

const MAX_IP_HEADER_LENGTH = 512

function headerValue(headers: Record<string, unknown> | undefined, name: string): string | null {
  if (!headers) return null
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== name) continue
    if (typeof value === "string") return value
    if (Array.isArray(value))
      return value.find((entry): entry is string => typeof entry === "string") ?? null
  }
  return null
}

function parseCandidate(value: string): string | null {
  const candidate = value.trim()
  if (!candidate || candidate.length > MAX_IP_HEADER_LENGTH) return null
  if (isIP(candidate)) return candidate
  // IPv6 mit Port: „[2001:db8::1]:443“
  if (candidate.startsWith("[") && candidate.includes("]")) {
    const ipv6 = candidate.slice(1, candidate.indexOf("]"))
    if (isIP(ipv6) === 6) return ipv6
  }
  // IPv4 mit Port: „203.0.113.7:443“
  if (candidate.includes(".")) {
    const separator = candidate.lastIndexOf(":")
    if (separator > 0) {
      const ipv4 = candidate.slice(0, separator)
      if (isIP(ipv4) === 4) return ipv4
    }
  }
  return null
}

/** der erste lesbare Eintrag; x-forwarded-for kann eine Kette sein */
function fromHeader(raw: string | null): string | null {
  if (!raw || raw.length > MAX_IP_HEADER_LENGTH) return null
  for (const part of raw.split(",")) {
    const parsed = parseCandidate(part)
    if (parsed) return parsed
  }
  return null
}

/**
 * Die IP des Clients oder null. Nur mit `trustProxyHeaders`; dann `x-real-ip` (in vielen Proxys schon die eine IP) vor
 * dem ersten lesbaren Eintrag von `x-forwarded-for`.
 */
export function extractClientIp(
  headers: Record<string, unknown> | undefined,
  trustProxyHeaders: boolean
): string | null {
  if (!trustProxyHeaders) return null
  return (
    fromHeader(headerValue(headers, "x-real-ip")) ??
    fromHeader(headerValue(headers, "x-forwarded-for"))
  )
}
