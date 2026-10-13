import Link from "next/link"

/** Bereiche des Admins: Konten und Anlage */
export function AdminTabs({ current }: { current: "users" | "site" }) {
  const tab = (key: "users" | "site", href: string, label: string) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-foreground-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
    >
      {label}
    </Link>
  )
  return (
    <nav aria-label="Admin" className="flex gap-1">
      {tab("users", "/admin/users", "Konten")}
      {tab("site", "/admin/site", "Anlage und Brücken")}
    </nav>
  )
}
