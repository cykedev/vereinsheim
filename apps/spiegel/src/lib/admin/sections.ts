/** die Bereiche des Admins; Reiter und Profil lesen beide diese Liste */
export type AdminSection = "overview" | "users" | "disciplines" | "lists" | "site"

export const ADMIN_SECTIONS: readonly { key: AdminSection; href: string; label: string }[] = [
  { key: "overview", href: "/admin", label: "Übersicht" },
  { key: "users", href: "/admin/users", label: "Konten" },
  { key: "disciplines", href: "/admin/disciplines", label: "Disziplinen" },
  { key: "lists", href: "/admin/lists", label: "Listen" },
  { key: "site", href: "/admin/site", label: "Anlage und Brücke" },
]
