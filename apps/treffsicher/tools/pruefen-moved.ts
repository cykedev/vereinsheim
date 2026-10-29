// Abschnitt „Nur lesend“ der Skriptprüfung: ein Konto, das nach Spiegel umgezogen ist ([[adr-033]], Stufe 3). Das
// Mitglied sieht auf Start den vollen Hinweis, auf allen anderen Seiten die Zeile, keine Knöpfe zum Ändern und auf den
// alten Adressen zum Anlegen und Bearbeiten die Seite „Das geht jetzt in Spiegel.“; der umgezogene Admin bedient Admin
// und legt Disziplinen der Anlage an. Am Ende sind beide Prüfkonten wieder nicht umgezogen, auch wenn etwas abbricht.

import type { Page } from "@vereinsheim/pruefen/browser"
import { noSideScroll, type Check } from "@vereinsheim/pruefen/common"

import { setMovedByEmail } from "./moved"
import { PRUEFEN_ADMIN_EMAIL, PRUEFEN_EMAIL, testDb } from "./pruefen-account"

type CheckFn = (name: string, ok: boolean, detail?: unknown) => void

export interface MovedFlow {
  page: Page
  base: string
  check: CheckFn
  record: (checks: Check[]) => void
  login: (page: Page, role?: "member" | "admin") => Promise<void>
  newestSessionId: string
}

export async function movedFlow({ page, base, check, record, login, newestSessionId }: MovedFlow) {
  const session = `/sessions/${newestSessionId}`
  try {
    await setMovedByEmail(testDb(), PRUEFEN_EMAIL, true)
    await login(page)

    await page.goto(`${base}/dashboard`)
    const start = await page.ev<{ full: boolean; link: string | null; actions: string[] }>(`({
      full: !!$('[data-moved-banner="full"]') && txt($('[data-moved-banner="full"]')).includes("Dein Tagebuch ist jetzt in Spiegel."),
      link: $("a[data-moved-link]")?.getAttribute("href") ?? null,
      actions: $$('[data-app-sidebar] [data-area="new"], [data-app-bar] [data-area="new"]').map((a) => a.getAttribute("href")) })`)
    check(
      "Nur lesend: Start zeigt den vollen Hinweis mit „Zu Spiegel“",
      start.full && /^https?:\/\//.test(start.link ?? ""),
      start
    )
    check(
      "Nur lesend: die Aktion in Leiste und Seitenleiste führt nicht zu Neue Einheit",
      start.actions.length === 2 && start.actions.every((href) => href !== "/sessions/new"),
      start.actions
    )

    for (const path of [
      "/sessions",
      session,
      "/goals",
      "/shot-routines",
      "/disciplines",
      "/statistics",
      "/profile",
    ]) {
      await page.goto(`${base}${path}`)
      check(
        `Nur lesend: ${path} zeigt die Zeile des Hinweises`,
        await page.ev<boolean>(`!!$('[data-moved-banner="short"]')`)
      )
    }

    await page.goto(`${base}${session}`)
    const detail = await page.ev<{ edit: number; file: number; change: string[]; pdf: boolean }>(`({
      edit: $$('a[href$="/edit"]').length,
      file: $$("input[type=file]").length,
      change: $$("button, a").map((el) => txt(el) + " " + (el.getAttribute("aria-label") ?? ""))
        .filter((text) => /Bearbeiten|erfassen/.test(text)),
      pdf: !!$('a[href$="/export/pdf"]') })`)
    check(
      "Nur lesend: die Einheit ohne Bearbeiten, Hochladen und Erfassen, mit PDF",
      detail.edit === 0 && detail.file === 0 && detail.change.length === 0 && detail.pdf,
      detail
    )
    await page.goto(`${base}/profile`)
    check(
      "Nur lesend: Profil ohne Formular für das Passwort",
      await page.ev<boolean>(`!$("input[name=currentPassword]")`)
    )

    for (const path of ["/sessions/new", `${session}/edit`, "/goals/new", "/shot-routines/new"]) {
      await page.goto(`${base}${path}`)
      const shown = await page.ev<{ kind: string | null; forms: number }>(`({
        kind: $("[data-moved-page]")?.dataset.movedPage ?? null, forms: $$("[data-app-content] form").length })`)
      check(
        `Nur lesend: ${path} zeigt „Das geht jetzt in Spiegel.“ statt des Formulars`,
        shown.kind !== null && shown.forms === 0,
        shown
      )
    }

    record(await noSideScroll(page, { base, paths: ["/dashboard", session], widths: [390, 360] }))

    await setMovedByEmail(testDb(), PRUEFEN_ADMIN_EMAIL, true)
    await login(page, "admin")
    await page.goto(`${base}/admin`)
    const admin = await page.ev<{ rows: number; create: boolean }>(`({
      rows: $$("tr").filter(visible).length,
      create: $$("a").filter(visible).some((a) => txt(a) === "Neuer Nutzer") })`)
    check(
      "Nur lesend: ein umgezogener Admin sieht die Konten und „Neuer Nutzer“",
      admin.rows > 1 && admin.create,
      admin
    )
    await page.goto(`${base}/admin/users/new`)
    check(
      "Nur lesend: „Neuer Nutzer“ bleibt ein Formular",
      await page.ev<boolean>(`!!$("[data-app-content] form")`)
    )
    await page.goto(`${base}/disciplines/new`)
    const discipline = await page.ev<{ system: boolean; choice: boolean }>(`({
      system: !!$('input[name=isSystem][value="true"]'),
      choice: document.querySelector("[data-app-content]").textContent.includes("Sichtbarkeit") })`)
    check(
      "Nur lesend: ein umgezogener Admin legt nur Disziplinen der Anlage an",
      discipline.system && !discipline.choice,
      discipline
    )
  } finally {
    const db = testDb()
    const reset = [
      await setMovedByEmail(db, PRUEFEN_EMAIL, false),
      await setMovedByEmail(db, PRUEFEN_ADMIN_EMAIL, false),
    ]
    check(
      "Nur lesend: beide Prüfkonten sind danach wieder nicht umgezogen",
      reset.every((change) => change === "cleared" || change === "unchanged"),
      reset
    )
  }
}
