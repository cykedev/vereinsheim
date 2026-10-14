import Link from "next/link"

import type { OpenConsentRow } from "@/lib/consent/queries"

/** offene Zustimmungen über allen Konten (SP-1.7 a, D5): wartende und zurückgegebene, je mit Link aufs Konto */
export function OpenConsents({ consents }: { consents: OpenConsentRow[] }) {
  return (
    <section
      data-open-consents
      className="grid max-w-3xl gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <h2 className="text-[15px] font-semibold">Offene Zustimmungen ({consents.length})</h2>
      {consents.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {consents.map((consent) => (
            <li key={consent.id}>
              <Link
                href={`/admin/users/${consent.userId}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="grid min-w-0">
                  <span className="truncate text-[15px] font-semibold">{consent.userLabel}</span>
                  <span className="text-[13px] text-muted-foreground">
                    SportpassID{" "}
                    <span className="font-mono tabular-nums">{consent.sportpassId}</span> ·
                    zugestimmt {consent.consentedAt}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] text-muted-foreground">
                  {consent.status === "returned" ? "zurück beim Admin" : "wartet"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground-2">Keine offenen Zustimmungen.</p>
      )}
    </section>
  )
}
