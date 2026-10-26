/**
 * nur gegen die lokale Dev-Datenbank: tsx setzt kein NODE_ENV, und eine fremde DATABASE_URL bekäme sonst eigene Scheiben
 * und ein Demo-Konto mit einem Passwort aus dem Repo; `--force` für eine andere lokale Datenbank
 */
export function assertDevDatabase(url: string, force: boolean) {
  const { hostname, pathname } = new URL(url)
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)
  if (!local || (pathname !== "/spiegel" && !force))
    throw new Error(
      `seed:own nur gegen die lokale Dev-Datenbank spiegel (nicht ${hostname}${pathname})`
    )
}
