/** die Abfrage der Adresse als Text, wie `routeFromUrl` sie liest (aus den `searchParams` einer Seite) */
export function searchOf(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params))
    for (const one of Array.isArray(value) ? value : value === undefined ? [] : [value])
      search.append(key, one)
  // nicht `search.size`: fehlt in Safari vor 17 (Review)
  const text = search.toString()
  return text ? `?${text}` : ""
}
