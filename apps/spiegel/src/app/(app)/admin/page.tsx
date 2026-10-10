import { redirect } from "next/navigation"

// Admin beginnt bei den Konten; Anlagen, Brücken und Zuordnungen kommen mit SP-1.5 und SP-1.7
export default function AdminRoute() {
  redirect("/admin/users")
}
