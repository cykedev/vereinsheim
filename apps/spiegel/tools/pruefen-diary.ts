// Skriptprüfung des Tagebuchs ([[spiegel-diary]]), Abschnitt „Tagebuch“ in `pruefen.ts`: mit dem Demo-Konto am
// Telefon einschalten, Hinweis, ein Eintrag aus dem ersten Vorschlag, Texte, Befinden, Satzanfänge, ein zweiter Eintrag
// mit der Frage des ersten, Faden, die Zeilen an Scheibe und Start, Scheibe lösen, Löschen mit Rückgängig, Papierkorb,
// Export und der Dialog „Konto löschen“ mit falschem Passwort. Am Ende sind alle Einträge des Demo-Kontos endgültig
// gelöscht und das Tagebuch ist aus, auch nach einem Abbruch.

import type { Page } from "@vereinsheim/pruefen/browser"
import { type Check, noSideScroll } from "@vereinsheim/pruefen/common"

interface Context {
  base: string
  check: (name: string, ok: boolean, detail?: unknown) => void
  record: (checks: Check[]) => void
}

const DIALOG = `$('[role="alertdialog"]')`
const ENTRY_PATH = String.raw`/^\/diary\/(?!new$|thread$)[^/]+$/`

/** in ein Feld tippen: hineinklicken, ans Ende, tippen */
async function typeInto(page: Page, selector: string, text: string) {
  await page.click(`$(${JSON.stringify(selector)})`)
  await page.key("End")
  await page.type(text)
}

/** einen gesteuerten Wert setzen, wie ihn der Browser bei einer Wahl setzt (Datum, Auswahl) */
const setValue = (selector: string, value: string) =>
  `(() => { const el = $(${JSON.stringify(selector)})
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
    return el.value })()`

/** einen Text im Eintrag schreiben und speichern; true, wenn „Speichern“ danach weg ist */
async function saveText(page: Page, name: string, text: string): Promise<boolean> {
  const box = `[data-entry-text="${name}"]`
  await typeInto(page, `${box} textarea`, text)
  await page.click(`button("Speichern", $(${JSON.stringify(box)}))`)
  return page.waitFor(`!button("Speichern", $(${JSON.stringify(box)}))`, 10_000)
}

/** im offenen Dialog bestätigen */
async function confirm(page: Page, label: string) {
  await page.waitFor(`!!${DIALOG}`)
  await page.click(`button(${JSON.stringify(label)}, ${DIALOG})`)
  await page.waitFor(`!${DIALOG}`)
}

/** das Tagebuch im Profil umschalten, wenn es nicht schon so steht; true, wenn es danach so steht */
async function setDiary(page: Page, base: string, on: boolean): Promise<boolean> {
  await page.goto(`${base}/profile`)
  const label = on ? "Einschalten" : "Ausschalten"
  if (await page.ev<boolean>(`!!button(${JSON.stringify(label)}, $("[data-diary-profile]"))`)) {
    await page.click(`button(${JSON.stringify(label)}, $("[data-diary-profile]"))`)
    await confirm(page, label)
  }
  return page.waitFor(
    `!!button(${JSON.stringify(on ? "Ausschalten" : "Einschalten")}, $("[data-diary-profile]"))`,
    10_000
  )
}

/** alle Einträge in den Papierkorb, dann den Teil des Tagebuchs im Papierkorb leeren, dann aus */
async function cleanUp(page: Page, base: string) {
  await page.goto(`${base}/diary`)
  if (await page.ev<boolean>(`location.pathname === "/diary"`)) {
    const ids = await page.ev<string[]>(
      `$$("[data-diary-entry]").map((a) => a.getAttribute("data-diary-entry"))`
    )
    for (const id of ids) {
      await page.goto(`${base}/diary/${id}`)
      await page.click(`button("Eintrag löschen")`)
      await confirm(page, "Löschen")
      await page.waitFor(`location.pathname === "/diary"`, 10_000)
    }
    await page.goto(`${base}/profile/trash`)
    for (let left = 0; left < 50; left++) {
      const count = await page.ev<number>(`$$("[data-diary-trash] [data-trash-entry]").length`)
      if (!count) break
      await page.click(`button("Endgültig löschen", $("[data-diary-trash] [data-trash-entry]"))`)
      await confirm(page, "Endgültig löschen")
      await page.waitFor(`$$("[data-diary-trash] [data-trash-entry]").length < ${count}`, 10_000)
    }
  }
  await setDiary(page, base, false)
}

export async function diary(page: Page, { base, check, record }: Context) {
  await page.viewport(390, 844)
  try {
    await run(page, { base, check, record })
  } finally {
    await page.viewport(390, 844)
    await cleanUp(page, base)
    await page.goto(`${base}/diary`, '$("[data-app-frame]")')
    check(
      "Tagebuch: am Ende aus, /diary führt ins Profil, keine Einträge im Papierkorb",
      (await page.waitFor(`location.pathname === "/profile"`)) &&
        (await page.ev<boolean>(`!$("[data-app-bar] a[href='/diary']")`)),
      await page.ev<string>(`location.pathname`)
    )
  }
}

async function run(page: Page, { base, check, record }: Context) {
  // ein abgebrochener Lauf davor hinterlässt vielleicht Einträge: erst aufräumen
  await cleanUp(page, base)

  // einschalten im Profil, mit Rückfrage
  await page.goto(`${base}/profile`)
  await page.click(`button("Einschalten", $("[data-diary-profile]"))`)
  await page.waitFor(`!!${DIALOG}`)
  const asked = await page.ev<string>(`txt(${DIALOG})`)
  await confirm(page, "Einschalten")
  check(
    "Tagebuch: Einschalten fragt mit Folgen, danach steht es in der Leiste",
    asked.includes("Tagebuch einschalten?") &&
      (await page.waitFor(`!!link("Tagebuch", $("[data-app-bar]"))`, 10_000)),
    asked.slice(0, 120)
  )
  check(
    "Tagebuch: im Profil am Telefon „Alle Scheiben“",
    await page.ev<boolean>(`!!link("Alle Scheiben", $("[data-all-cards]"))`)
  )

  // Hinweis beim ersten Öffnen, nach „Verstanden“ und Neuladen weg; ein früherer Lauf hat ihn beim Demo-Konto vielleicht
  // schon bestätigt (Ausschalten setzt das nicht zurück), dann bleibt er weg
  await page.click(`link("Tagebuch", $("[data-app-bar]"))`)
  await page.waitFor(`location.pathname === "/diary"`, 10_000)
  const notice = await page.waitFor(`!!$("[data-diary-notice]")`, 2_000)
  if (notice) {
    await page.click(`button("Verstanden", $("[data-diary-notice]"))`)
    await page.waitFor(`!$("[data-diary-notice]")`, 10_000)
  }
  await page.goto(`${base}/diary`)
  check(
    notice
      ? "Tagebuch: beim ersten Öffnen der Hinweis, nach „Verstanden“ und Neuladen weg"
      : "Tagebuch: der Hinweis ist schon bestätigt und bleibt weg",
    await page.ev<boolean>(`!$("[data-diary-notice]")`)
  )

  // ein Eintrag aus dem ersten Vorschlag
  await page.click(`link("Neuer Eintrag")`)
  await page.waitFor(`location.pathname === "/diary/new"`, 10_000)
  const proposal = await page.ev<string | null>(
    `$("[data-proposal]")?.getAttribute("data-proposal") ?? null`
  )
  if (!proposal)
    throw new Error("kein Vorschlag: das Demo-Konto hat in den letzten 30 Tagen keine Scheibe")
  const [day, familyId] = proposal.split("|")
  await page.click(`button("Anlegen", $("[data-proposal]"))`)
  check(
    "Tagebuch: „Anlegen“ am ersten Vorschlag öffnet den Eintrag mit seinen Scheiben",
    (await page.waitFor(`${ENTRY_PATH}.test(location.pathname)`, 10_000)) &&
      (await page.waitFor(`$$("[data-entry-card]").length > 0`)),
    proposal
  )
  const first = await page.ev<string>(`location.pathname.split("/")[2]`)
  const cardId = await page.ev<string>(`$("[data-entry-card]").getAttribute("data-entry-card")`)

  // Vorhaben und Notiz; mit Ungespeichertem fragt der Rückweg
  check(
    "Tagebuch: Vorhaben gespeichert",
    await saveText(page, "intention", "Abzug ruhig durchziehen")
  )
  await typeInto(page, `[data-entry-text="note"] textarea`, "Zweite Serie unruhig")
  await page.click(`link("Tagebuch", $("[data-entry-page]"))`)
  const discard = await page.waitFor(`txt(${DIALOG}).includes("Änderungen verwerfen?")`)
  await page.click(`button("Abbrechen", ${DIALOG})`)
  check(
    "Tagebuch: mit ungespeicherter Notiz fragt der Rückweg, „Abbrechen“ bleibt",
    discard && (await page.waitFor(`!${DIALOG} && location.pathname === "/diary/${first}"`))
  )
  await page.click(`button("Speichern", $('[data-entry-text="note"]'))`)
  check(
    "Tagebuch: Notiz gespeichert",
    await page.waitFor(`!button("Speichern", $('[data-entry-text="note"]'))`, 10_000)
  )

  // Befinden: „+“, vier Tipps, Neuladen zeigt sie, ein Tipp auf dieselbe Stufe nimmt sie weg
  const wellbeing = `$('[data-section="wellbeing"]')`
  await page.click(`button("Befinden eintragen")`)
  const rows = (i: number) => `$$("[data-stage-row]", ${wellbeing})[${i}]`
  for (let i = 0; i < 4; i++) {
    await page.click(`$('[data-stage="${(i % 5) + 1}"]', ${rows(i)})`)
    await page.waitFor(`$('[data-stage="${(i % 5) + 1}"]', ${rows(i)}).ariaPressed === "true"`)
    await page.wait(300)
  }
  const pressed = () =>
    page.ev<number>(`$$('[data-stage][aria-pressed="true"]', ${wellbeing}).length`)
  await page.goto(`${base}/diary/${first}`)
  const afterReload = await pressed()
  check(
    "Tagebuch: vier Stufen im Befinden, nach dem Neuladen noch da, der Abschnitt offen",
    afterReload === 4 && (await page.ev<boolean>(`!${wellbeing}.hasAttribute("data-empty")`)),
    afterReload
  )
  await page.click(`$('[data-stage="1"]', ${rows(0)})`)
  await page.waitFor(`$('[data-stage="1"]', ${rows(0)}).ariaPressed === "false"`)
  await page.wait(500)
  await page.goto(`${base}/diary/${first}`)
  check(
    "Tagebuch: ein Tipp auf die gezeigte Stufe nimmt sie weg, auch nach dem Neuladen",
    (await pressed()) === 3,
    await pressed()
  )

  // Satzanfänge unter Nachher
  const learned = await saveText(page, "learned", "ein ruhiger Start hilft")
  const question = await saveText(page, "question", "den Druckpunkt sauber zu nehmen?")
  check("Tagebuch: „Ich habe gelernt, dass …“ und die Frage gespeichert", learned && question)

  // ein zweiter Eintrag derselben Disziplin an einem späteren Tag zeigt die Frage
  const later = await page.ev<string>(
    `(() => { const d = new Date(${JSON.stringify(`${day}T12:00:00Z`)}); d.setUTCDate(d.getUTCDate() + 1)
      const today = new Date().toISOString().slice(0, 10); const next = d.toISOString().slice(0, 10)
      return next > today ? today : next })()`
  )
  await page.goto(`${base}/diary/new`)
  await page.click(`button("Trockentraining", $("[data-new-without]"))`)
  await page.ev(setValue(`[data-new-without] input[type="date"]`, later))
  await page.ev(setValue(`[data-new-without] select`, familyId))
  await page.click(`button("Anlegen", $("[data-new-without]"))`)
  await page.waitFor(
    `${ENTRY_PATH}.test(location.pathname) && location.pathname !== "/diary/${first}"`,
    10_000
  )
  const second = await page.ev<string>(`location.pathname.split("/")[2]`)
  const hint = await page.ev<string>(`txt($("[data-thread-hint]"))`)
  check(
    "Tagebuch: der zweite Eintrag zeigt die Frage des ersten",
    later > day && hint.includes("Wie schaffe ich es, den Druckpunkt sauber zu nehmen?"),
    `${day} → ${later}: ${hint}`
  )
  await page.click(`button("Als Vorhaben nehmen", $("[data-thread-hint]"))`)
  check(
    "Tagebuch: „Als Vorhaben nehmen“ macht die Frage zum Vorhaben",
    await page.waitFor(
      `$('[data-entry-text="intention"] textarea')?.value === "Wie schaffe ich es, den Druckpunkt sauber zu nehmen?"`,
      10_000
    )
  )
  await saveText(page, "question", "die Serie ruhig zu Ende zu schießen?")

  // Faden: beide Fragen, neueste oben
  await page.goto(`${base}/diary/thread`)
  const thread = await page.ev<string[]>(
    `$$("[data-thread-item]").map((li) => li.getAttribute("data-thread-item"))`
  )
  check(
    "Tagebuch: der Faden zeigt beide Fragen, neueste oben",
    thread[0] === second && thread[1] === first,
    thread.join(", ")
  )

  // kein seitliches Scrollen
  record(
    await noSideScroll(page, {
      base,
      paths: ["/diary", "/diary/thread", "/diary/new", `/diary/${first}`, `/diary/${second}`],
      widths: [390, 360],
    })
  )
  await page.viewport(390, 844)

  // Export mit beiden Teilen
  const exported = await page.ev<{
    status: number
    format: string
    cards: number
    entries: string[]
  }>(`(async () => {
    const r = await fetch("/api/account/export"); const data = await r.json()
    return { status: r.status, format: data.format, cards: data.results.cards.length,
      entries: data.diary.entries.map((e) => e.id) } })()`)
  check(
    "Export: eine Datei mit Scheiben und den Einträgen des Tagebuchs",
    exported.status === 200 &&
      exported.format === "spiegel-export" &&
      exported.cards > 0 &&
      exported.entries.includes(first) &&
      exported.entries.includes(second),
    `${exported.cards} Scheiben, ${exported.entries.length} Einträge`
  )

  // die Zeile „Tagebuch“ an der Scheibe und auf Start
  await page.goto(`${base}/cards/${cardId}`)
  check(
    "Tagebuch: an der Scheibe die Zeile mit „Eintrag öffnen“",
    await page.waitFor(
      `link("Eintrag öffnen", $("[data-card-actions]"))?.getAttribute("href") === "/diary/${first}"`
    )
  )
  await page.goto(`${base}/`)
  const start = await page.ev<string[]>(
    `$$("a").filter((a) => txt(a).startsWith("Tagebuch · Eintrag")).map((a) => txt(a) + " " + a.getAttribute("href"))`
  )
  check("Tagebuch: auf Start je Block eine Zeile zum Eintrag", start.length > 0, start.join(" | "))

  // Scheibe lösen: danach nur noch angeboten, die Zeile an der Scheibe führt in den Eintrag, der sie anbietet
  await page.goto(`${base}/diary/${first}`)
  await page.click(`button("Lösen", $('[data-entry-card="${cardId}"]'))`)
  await confirm(page, "Lösen")
  check(
    "Tagebuch: eine gelöste Scheibe steht nur noch unter „Vom selben Abend“",
    await page.waitFor(
      `!!$('[data-offered] [data-offered-card="${cardId}"]') && !$('[data-entry-card="${cardId}"]')`,
      10_000
    )
  )
  await page.goto(`${base}/cards/${cardId}`)
  check(
    "Tagebuch: an der gelösten Scheibe „bietet sie an“ mit „Eintrag öffnen“ in diesen Eintrag",
    await page.ev<boolean>(
      `txt($("[data-card-actions]")).includes("bietet sie an") && link("Eintrag öffnen", $("[data-card-actions]"))?.getAttribute("href") === "/diary/${first}"`
    )
  )

  // löschen, rückgängig, wieder löschen, im Papierkorb endgültig
  const removeFirst = async () => {
    await page.goto(`${base}/diary/${first}`)
    await page.click(`button("Eintrag löschen")`)
    await confirm(page, "Löschen")
    return page.waitFor(`location.pathname === "/diary" && !!$("[data-undo-bar]")`, 10_000)
  }
  check(
    "Tagebuch: Löschen geht zurück ins Tagebuch mit „Rückgängig“",
    (await removeFirst()) &&
      (await page.ev<boolean>(`txt($("[data-undo-bar]")).includes("Eintrag gelöscht")`))
  )
  await page.click(`button("Rückgängig", $("[data-undo-bar]"))`)
  check(
    "Tagebuch: Rückgängig bringt den Eintrag zurück in die Liste",
    await page.waitFor(`!!$('[data-diary-entry="${first}"]')`, 10_000)
  )
  await removeFirst()
  await page.goto(`${base}/profile/trash`)
  const trashed = await page.ev<number>(`$$("[data-diary-trash] [data-trash-entry]").length`)
  check("Tagebuch: der Eintrag liegt im Papierkorb", trashed === 1, trashed)
  await page.click(`button("Endgültig löschen", $("[data-diary-trash] [data-trash-entry]"))`)
  await confirm(page, "Endgültig löschen")
  check(
    "Tagebuch: endgültig gelöscht ist er aus dem Papierkorb weg",
    await page.waitFor(`!$("[data-diary-trash] [data-trash-entry]")`, 10_000)
  )

  // Konto löschen: nur der Dialog, mit falschem Passwort
  await page.goto(`${base}/profile`)
  await page.click(`button("Konto löschen", $("[data-own-data]"))`)
  if (await page.waitFor(`txt(${DIALOG}).includes("Konto löschen geht gerade nicht")`, 1_000)) {
    check("Konto löschen: das einzige Admin-Konto bekommt den Hinweis", true)
    await page.click(`button("Schließen", ${DIALOG})`)
  } else {
    const dialog = await page.ev<string>(`txt(${DIALOG})`)
    await typeInto(page, "#own-data-password", "kein-richtiges-passwort")
    await page.click(`button("Konto endgültig löschen", ${DIALOG})`)
    check(
      "Konto löschen: Rückfrage mit Folgen, ein falsches Passwort zeigt den Fehler am Feld",
      dialog.includes("Konto löschen?") &&
        (await page.waitFor(
          `txt(${DIALOG}).includes("Das Passwort stimmt nicht.") && $("#own-data-password").getAttribute("aria-invalid") === "true"`,
          10_000
        )),
      dialog.slice(0, 120)
    )
    await page.click(`button("Abbrechen", ${DIALOG})`)
    await page.waitFor(`!${DIALOG}`)
  }
}
