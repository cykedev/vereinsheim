/** gehört die Adresse zu Admin: `/admin` und alles darunter, nicht etwa `/administration` */
export const isAdminPath = (pathname: string) =>
  pathname === "/admin" || pathname.startsWith("/admin/")
