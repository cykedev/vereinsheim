import Link from "next/link"

type AdminTab = "overview" | "users" | "disciplines" | "site"

/** Bereiche des Admins: Übersicht, Konten, Disziplinen, Anlage und Brücke */
export function AdminTabs({ current }: { current: AdminTab }) {
  const tab = (key: AdminTab, href: string, label: string) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-foreground-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
    >
      {label}
    </Link>
  )
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-1">
      {tab("overview", "/admin", "Übersicht")}
      {tab("users", "/admin/users", "Konten")}
      {tab("disciplines", "/admin/disciplines", "Disziplinen")}
      {tab("site", "/admin/site", "Anlage und Brücke")}
    </nav>
  )
}
