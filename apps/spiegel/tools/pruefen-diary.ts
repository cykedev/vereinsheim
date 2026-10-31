// Skriptprüfung des Tagebuchs ([[spiegel-diary]]), Abschnitt „Tagebuch“ in `pruefen.ts`: mit dem Demo-Konto am
// Telefon einschalten, Hinweis, ein Eintrag aus dem ersten Vorschlag, Texte, Befinden, Satzanfänge, ein zweiter Eintrag
// mit der Frage des ersten, Fragen (`/diary/thread`), der Reiter „Scheiben“ mit der Leiste, die Zeilen an Scheibe und Start, Scheibe lösen, Löschen mit Rückgängig, Papierkorb,
// Export und der Dialog „Konto löschen“ mit falschem Passwort; Ziele (anlegen mit Messung und Vorschau, Stand, Notiz,
// „Hat es geklappt?“, ändern, Zeile auf Start, Löschen mit Rückgängig) und Abläufe im eigenen Reiter (sechs Reiter in
// einer Zeile, anlegen als Text, Leseseite, bearbeiten, Wächter, Fragen ohne Abläufe, Löschen mit Rückgängig) und die
// Auswertung (Reiter, Leersätze, Befinden an einem Eintrag, Zeile „Energie“ und ihre Seite, Blatt der Hilfe). Am Ende sind alle Einträge, Ziele und Abläufe des
// Demo-Kontos endgültig gelöscht und das Tagebuch ist aus, auch nach einem Abbruch.

import type { Page } from "@vereinsheim/pruefen/browser"
import { type Check, noSideScroll } from "@vereinsheim/pruefen/common"

interface Context {
  base: string
  check: (name: string, ok: boolean, detail?: unknown) => void
  record: (checks: Check[]) => void
}

const DIALOG = `$('[role="alertdialog"]')`
const ENTRY_PATH = String.raw`/^\/diary\/(?!new$|thread$|goals$|routines$|analysis$)[^/]+$/`

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

/** den Text eines gesteuerten Textfelds setzen, wie ihn der Browser beim Einfügen setzt (Zeilenumbrüche) */
const setText = (selector: string, value: string) =>
  `(() => { const el = $(${JSON.stringify(selector)})
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event("input", { bubbles: true }))
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

/** alle Ziele und Abläufe des Kontos in den Papierkorb */
async function removeGoalsAndRoutines(page: Page, base: string) {
  await page.goto(`${base}/diary/goals`)
  const goals = await page.ev<string[]>(`$$("[data-goal]").map((a) => a.getAttribute("data-goal"))`)
  for (const id of goals) {
    await page.goto(`${base}/diary/goals/${id}`)
    await page.click(`button("Ziel löschen")`)
    await confirm(page, "Löschen")
    await page.waitFor(`location.pathname === "/diary/goals"`, 10_000)
  }
  await page.goto(`${base}/diary/routines`)
  const routines = await page.ev<string[]>(
    `$$("[data-routine]").map((a) => a.getAttribute("data-routine"))`
  )
  for (const id of routines) {
    await page.goto(`${base}/diary/routines/${id}`)
    await page.click(`button("Ablauf löschen")`)
    await confirm(page, "Löschen")
    await page.waitFor(`location.pathname === "/diary/routines"`, 10_000)
  }
}

/** alle Einträge, Ziele und Abläufe in den Papierkorb, dann den Teil des Tagebuchs im Papierkorb leeren, dann aus */
async function cleanUp(page: Page, base: string) {
  await page.goto(`${base}/diary`)
  if (await page.ev<boolean>(`location.pathname === "/diary"`)) {
    await removeGoalsAndRoutines(page, base)
    await page.goto(`${base}/diary`)
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
    "Tagebuch: im Profil kein Knopf „Alle Scheiben“",
    await page.ev<boolean>(`!$("[data-all-cards]") && !link("Alle Scheiben")`)
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

  // die Scheiben sind ein Reiter des Tagebuchs: Er führt zur Liste, dort ist er gewählt, die Leiste markiert das Tagebuch
  await page.click(`link("Scheiben", $("[data-diary-switch]"))`)
  check(
    "Tagebuch: der Reiter „Scheiben“ führt zur Liste, dort ist „Scheiben“ gewählt, unter dem Titel",
    (await page.waitFor(`location.pathname === "/cards"`, 10_000)) &&
      (await page.waitFor(
        `$('[data-diary-switch] a[aria-current="page"]')?.textContent === "Scheiben"`,
        10_000
      )) &&
      // wie im Tagebuch unter dem Titel: Titelblock, Reiter, dann die Filter
      (await page.ev<boolean>(
        `(() => { const tabs = $("[data-list-header] [data-diary-switch]"), title = $("[data-list-header] h1")
          const filter = $("[data-list-header] [data-list-controls]")
          return !!tabs && !!title && !!(title.compareDocumentPosition(tabs) & 4) && !!filter && !!(tabs.compareDocumentPosition(filter) & 4) })()`
      )),
    await page.ev<string>(`location.href`)
  )
  check(
    "Tagebuch: am Telefon markiert die Leiste auf der Liste „Tagebuch“",
    await page.ev<boolean>(
      `$('[data-app-bar] a[aria-current="page"]')?.getAttribute("data-area") === "diary"`
    ),
    await page.ev<string | null>(
      `$('[data-app-bar] a[aria-current="page"]')?.getAttribute("data-area") ?? null`
    )
  )
  // auf der Seite einer Scheibe keine Reiterzeile, die Leiste markiert weiter das Tagebuch
  const listed = await page.ev<string | null>(
    `$("[data-card-row]")?.getAttribute("data-card-row") ?? null`
  )
  if (listed) {
    await page.goto(`${base}/cards/${listed}`)
    check(
      "Tagebuch: die Seite einer Scheibe aus der Liste ohne Reiterzeile, in der Leiste „Tagebuch“",
      (await page.ev<boolean>(`!$("[data-diary-switch]")`)) &&
        (await page.ev<boolean>(
          `$('[data-app-bar] a[aria-current="page"]')?.getAttribute("data-area") === "diary"`
        ))
    )
  }
  await page.goto(`${base}/diary`)

  // ein Eintrag aus dem ersten Vorschlag
  await page.click(`link("Neuer Eintrag")`)
  await page.waitFor(`location.pathname === "/diary/new"`, 10_000)
  const proposal = await page.ev<string | null>(
    `$("[data-proposal]")?.getAttribute("data-proposal") ?? null`
  )
  if (!proposal)
    throw new Error("kein Vorschlag: das Demo-Konto hat keinen Abend mit Scheiben ohne Eintrag")
  const [day, familyId] = proposal.split("|")
  // oben „Heute“ mit genau einem Knopf, die Abende sind ganze Karten
  check(
    "Tagebuch: „Neuer Eintrag“ hat oben „Heute“ und genau ein „Anlegen“",
    await page.ev<boolean>(
      `txt($("[data-new-without]")).startsWith("Heute") && $$("button").filter((b) => txt(b) === "Anlegen").length === 1`
    )
  )
  await page.click(`$("[data-proposal]")`)
  check(
    "Tagebuch: ein Tipp auf die Karte des ersten Abends öffnet den Eintrag mit seinen Scheiben",
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
  check(
    "Tagebuch: mit übernommenem Vorhaben ist der Kasten mit der Frage weg",
    await page.waitFor(`!$("[data-thread-hint]")`, 10_000)
  )
  // leeren: tippen hängt nur an, deshalb den Wert setzen
  await page.ev(setText('[data-entry-text="intention"] textarea', ""))
  await page.click(`button("Speichern", $('[data-entry-text="intention"]'))`)
  const cleared = await page.waitFor(
    `!button("Speichern", $('[data-entry-text="intention"]'))`,
    10_000
  )
  const back = await page.waitFor(`!!$("[data-thread-hint]")`, 10_000)
  const own = await saveText(page, "intention", "Ruhig bleiben")
  check(
    "Tagebuch: ohne Vorhaben kommt die Frage wieder, mit eigenem Vorhaben ist sie weg",
    cleared && back && own && (await page.waitFor(`!$("[data-thread-hint]")`, 10_000))
  )
  await saveText(page, "question", "die Serie ruhig zu Ende zu schießen?")

  // Fragen: beide, neueste oben
  await page.goto(`${base}/diary/thread`)
  const thread = await page.ev<string[]>(
    `$$("[data-thread-item]").map((li) => li.getAttribute("data-thread-item"))`
  )
  check(
    "Tagebuch: „Fragen“ zeigt beide Fragen, neueste oben",
    thread[0] === second && thread[1] === first,
    thread.join(", ")
  )

  // kein seitliches Scrollen
  record(
    await noSideScroll(page, {
      minFieldPx: 16,
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
    `$$("a, button").filter((a) => txt(a).startsWith("Tagebuch · Eintrag")).map((a) => txt(a) + " " + (a.getAttribute("href") ?? "Knopf"))`
  )
  check("Tagebuch: auf Start je Block eine Zeile zum Eintrag", start.length > 0, start.join(" | "))

  // Scheiben ändern: im Blatt abhaken löst, danach nur noch angeboten (im Blatt ohne Haken)
  await page.goto(`${base}/diary/${first}`)
  check(
    "Tagebuch: Scheiben im Eintrag wie in der Liste, ohne „Lösen“ und Herkunft, die Zeile führt zur Scheibe",
    await page.ev<boolean>(
      `$('[data-entry-card="${cardId}"]')?.getAttribute("href") === "/cards/${cardId}" && !button("Lösen") && !/vom Ausdruck|eingetragen/.test(txt($("[data-entry-cards]")))`
    )
  )
  await page.click(`$("[data-change-cards]")`)
  await page.waitFor(`!!sheet() && !!$("[data-cards-sheet]", sheet())`)
  const box = `$('[data-sheet-card="${cardId}"] input', sheet())`
  const checkedBefore = await page.ev<boolean>(`${box}.checked`)
  await page.click(box)
  check(
    "Tagebuch: im Blatt „Scheiben ändern“ nimmt ein Haken weg die Scheibe aus dem Eintrag",
    checkedBefore &&
      (await page.waitFor(
        `!${box}.checked && !$('[data-entry-cards] [data-entry-card="${cardId}"]')`,
        10_000
      ))
  )
  await page.click(`button("Fertig", sheet())`)
  await page.waitFor(`!sheet()`)
  await page.goto(`${base}/cards/${cardId}`)
  check(
    "Tagebuch: an der herausgenommenen Scheibe „unter „Scheiben ändern“ anhaken“ mit „Eintrag öffnen“ in diesen Eintrag",
    await page.ev<boolean>(
      `txt($("[data-card-actions]")).includes("unter „Scheiben ändern“ anhaken") && link("Eintrag öffnen", $("[data-card-actions]"))?.getAttribute("href") === "/diary/${first}"`
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

  // im Papierkorb hält er keine Scheibe: an der Scheibe legt „Eintrag anlegen“ direkt an und öffnet ihn
  await page.goto(`${base}/cards/${cardId}`)
  await page.click(`button("Eintrag anlegen", $("[data-card-actions]"))`)
  check(
    "Tagebuch: „Eintrag anlegen“ an der Scheibe legt direkt an, ohne Zwischenseite",
    (await page.waitFor(
      `${ENTRY_PATH}.test(location.pathname) && location.pathname !== "/diary/${first}"`,
      10_000
    )) && (await page.waitFor(`!!$('[data-entry-card="${cardId}"]')`, 10_000)),
    await page.ev<string>(`location.pathname`)
  )
  await page.goto(`${base}/profile/trash`)
  await page.click(`button("Endgültig löschen", $("[data-diary-trash] [data-trash-entry]"))`)
  await confirm(page, "Endgültig löschen")
  check(
    "Tagebuch: endgültig gelöscht ist er aus dem Papierkorb weg",
    await page.waitFor(`!$("[data-diary-trash] [data-trash-entry]")`, 10_000)
  )

  await goals(page, { base, check, record })
  await routines(page, { base, check, record })
  await analysis(page, { base, check, record })

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

/** Ziele: anlegen mit Messung und Vorschau, Stand, Notiz, „Hat es geklappt?“, ändern, Zeile auf Start, Löschen */
async function goals(page: Page, { base, check, record }: Context) {
  await page.goto(`${base}/diary/goals`)
  check(
    "Ziele: Reiter Ziele, ohne Ziel der Leerzustand und „Neues Ziel“ oben",
    (await page.ev<boolean>(
      `$('[data-diary-switch] a[aria-current="page"]')?.textContent === "Ziele"`
    )) &&
      (await page.ev<boolean>(`txt(document.body).includes("Noch kein Ziel")`)) &&
      (await page.ev<boolean>(`!!link("Neues Ziel")`))
  )

  // Verlassen mit Ungespeichertem fragt
  await page.click(`link("Neues Ziel")`)
  await page.waitFor(`location.pathname === "/diary/goals/new"`, 10_000)
  await typeInto(page, "[data-goal-title]", "Ein Ziel zum Prüfen")
  await page.click(`link("Ziele")`)
  check(
    "Ziele: das Formular mit Ungespeichertem verlassen fragt",
    await page.waitFor(`txt(${DIALOG}).includes("Änderungen verwerfen?")`, 5_000)
  )
  await page.click(`button("Abbrechen", ${DIALOG})`)
  await page.waitFor(`!${DIALOG}`)

  // Messung „Scheibe ab 1“ über alles bis heute, damit die Demo-Scheiben zählen
  check(
    "Ziele: neu mit Saison, Disziplin und „Spiegel misst mit“ vorbelegt",
    await page.ev<boolean>(
      `$('[role="switch"]')?.getAttribute("aria-checked") === "true" && !!$('[role="group"][aria-label="Disziplin"] [aria-pressed="true"]') && /Saison \\d\\d\\/\\d\\d/.test(txt($("[data-goal-form]")))`
    )
  )
  await page.click(`button("Frei")`)
  await page.ev(setValue('[data-goal-form] input[type="date"]', "2000-01-01"))
  await typeInto(page, "[data-goal-threshold]", "1")
  const preview = await page.waitFor(
    `/^Bisher in diesem Zeitraum: \\d+ von [1-9]\\d* Scheiben? ab 1\\.$/.test(txt($("[data-goal-preview]")))`,
    10_000
  )
  check(
    "Ziele: die Vorschau zählt die Scheiben im Zeitraum",
    preview,
    await page.ev<string>(`txt($("[data-goal-preview]"))`)
  )
  await page.click(`$("[data-goal-save]")`)
  const created = await page.waitFor(
    String.raw`/^\/diary\/goals\/(?!new$)[^/]+$/.test(location.pathname)`,
    10_000
  )
  const goalPath = await page.ev<string>(`location.pathname`)
  check(
    "Ziele: anlegen öffnet das Ziel mit Stand, großer Zahl, Verlauf und Weg in den Fortschritt",
    created &&
      (await page.waitFor(`!!$("[data-goal-big]") && !!$("[data-goal-chart]")`, 10_000)) &&
      (await page.ev<boolean>(
        `(link("Im Fortschritt ansehen ›")?.getAttribute("href") ?? "").startsWith("/progress?")`
      )),
    goalPath
  )
  const order = await page.ev<string[]>(
    `$$("[data-goal-stand], [data-goal-note], [data-goal-entries], [data-goal-actions]").map((el) => [...el.attributes].find((a) => a.name.startsWith("data-goal-")).name)`
  )
  check(
    "Ziele: die Kästen stehen in fester Folge",
    order.join(",") === "data-goal-stand,data-goal-note,data-goal-entries,data-goal-actions",
    order
  )

  // Notiz, „Hat es geklappt?“
  await page.click(`button("Notiz", $("[data-goal-note]"))`)
  check("Ziele: Notiz speichern", await saveText(page, "note", "Jede zweite Scheibe."))
  await page.click(`button("Ja", $("[data-outcome]"))`)
  const yes = await page.waitFor(
    `button("Ja", $("[data-outcome]"))?.getAttribute("aria-pressed") === "true"`,
    10_000
  )
  await page.goto(`${base}${goalPath}`)
  const kept = await page.ev<boolean>(
    `button("Ja", $("[data-outcome]"))?.getAttribute("aria-pressed") === "true"`
  )
  await page.click(`button("Ja", $("[data-outcome]"))`)
  check(
    "Ziele: „Hat es geklappt?“ speichert beim Tippen, ein zweiter Tipp nimmt es zurück",
    yes &&
      kept &&
      (await page.waitFor(
        `button("Ja", $("[data-outcome]"))?.getAttribute("aria-pressed") === "false"`,
        10_000
      ))
  )

  // ändern auf „Serie“
  await page.click(`link("Ändern", $("[data-goal-actions]"))`)
  await page.waitFor(`location.pathname === "${goalPath}/edit"`, 10_000)
  await page.click(`button("Serie")`)
  await page.click(`$("[data-goal-save]")`)
  check(
    "Ziele: ändern auf „Serie“ zählt Serien",
    (await page.waitFor(`location.pathname === "${goalPath}"`, 10_000)) &&
      (await page.waitFor(`/Serien? ab 1 Ringen/.test(txt($("[data-goal-big]")))`, 10_000))
  )

  // Start: die Zeile zum Ziel
  await page.goto(`${base}/`)
  const line = await page.ev<string>(
    `($$("a").find((a) => txt(a).startsWith("Ziel ab 1 · ")) ?? null)?.getAttribute("href") ?? ""`
  )
  check("Ziele: auf Start die Zeile zum Ziel, sie führt zum Ziel", line === goalPath, line)

  // Telefon, schmal: kein seitliches Scrollen
  record(
    await noSideScroll(page, {
      minFieldPx: 16,
      base,
      paths: ["/diary/goals", goalPath, "/diary/goals/new", `${goalPath}/edit`],
      widths: [390, 360],
    })
  )
  await page.viewport(390, 844)

  // löschen mit Rückgängig, dann im Papierkorb
  const remove = async () => {
    await page.goto(`${base}${goalPath}`)
    await page.click(`button("Ziel löschen")`)
    await confirm(page, "Löschen")
    return page.waitFor(
      `location.pathname === "/diary/goals" && txt($("[data-undo-bar]")).includes("Ziel gelöscht")`,
      10_000
    )
  }
  check("Ziele: Löschen geht zu den Zielen mit „Rückgängig“", await remove())
  await page.click(`button("Rückgängig", $("[data-undo-bar]"))`)
  check(
    "Ziele: Rückgängig bringt das Ziel zurück",
    await page.waitFor(`!!$('[data-goal="${goalPath.split("/").pop()}"]')`, 10_000)
  )
  await remove()
  await page.goto(`${base}/profile/trash`)
  check(
    "Ziele: das Ziel liegt im Papierkorb unter „Im Tagebuch“",
    await page.ev<boolean>(
      `!!$('[data-diary-trash] [data-trash-entry="goal"]') && txt($("[data-diary-trash]")).startsWith("Im Tagebuch")`
    )
  )
}

/** Abläufe im eigenen Reiter: anlegen als Text, Leseseite, bearbeiten mit Wächter, Löschen mit Rückgängig */
async function routines(page: Page, { base, check, record }: Context) {
  await page.goto(`${base}/diary/routines`)
  check(
    "Abläufe: fünfter Reiter, ohne Ablauf der Leerzustand und „Neuer Ablauf“ oben",
    (await page.ev<boolean>(
      `$('[data-diary-switch] a[aria-current="page"]')?.textContent === "Abläufe"`
    )) &&
      (await page.ev<boolean>(`txt(document.body).includes("Noch kein Ablauf")`)) &&
      (await page.ev<boolean>(`!!link("Neuer Ablauf")`))
  )
  for (const width of [390, 360]) {
    await page.viewport(width, 844)
    await page.goto(`${base}/diary/routines`)
    const tabs = await page.ev<{ rows: number; count: number; inner: number; visual: number }>(
      `(() => { const links = $$("[data-diary-switch] a")
        return { rows: new Set(links.map((a) => Math.round(a.getBoundingClientRect().top))).size,
          count: links.length, inner: innerWidth, visual: visualViewport.width } })()`
    )
    check(
      `Abläufe: Telefon ${width} px, die sechs Reiter in einer Zeile, die Seite nicht breiter`,
      tabs.rows === 1 && tabs.count === 6 && tabs.inner === tabs.visual,
      JSON.stringify(tabs)
    )
  }
  await page.viewport(390, 844)
  await page.goto(`${base}/diary/routines`)
  await page.click(`link("Neuer Ablauf")`)
  await page.waitFor(`location.pathname === "/diary/routines/new"`, 10_000)
  await typeInto(page, "[data-routine-name]", "Ablauf zum Prüfen")
  await page.ev(
    setText("[data-routine-text]", "Griff fassen\nHand ganz hoch.\n\nAtmen\n\nAbziehen")
  )
  check(
    "Abläufe: der Hinweis zählt die Schritte beim Schreiben",
    await page.waitFor(`txt($("[data-routine-hint]")).endsWith("Gerade: 3 Schritte.")`, 5_000)
  )
  await page.click(`$("[data-routine-save]")`)
  const created = await page.waitFor(
    String.raw`/^\/diary\/routines\/(?!new$)[^/]+$/.test(location.pathname)`,
    10_000
  )
  const routinePath = await page.ev<string>(`location.pathname`)
  check(
    "Abläufe: anlegen öffnet die Leseseite mit drei nummerierten Schritten",
    created && (await page.waitFor(`$$("[data-routine-steps] li").length === 3`, 10_000)),
    routinePath
  )
  check(
    "Abläufe: der Rückweg der Leseseite führt auf den Reiter „Abläufe“",
    await page.ev<boolean>(
      `link("Abläufe", $("[data-routine-page]"))?.getAttribute("href") === "/diary/routines"`
    )
  )

  // bearbeiten: Verlassen mit Ungespeichertem fragt, dann speichern
  await page.click(`link("Bearbeiten", $("[data-routine-actions]"))`)
  await page.waitFor(`location.pathname === "${routinePath}/edit"`, 10_000)
  await page.ev(
    setText(
      "[data-routine-text]",
      "Griff fassen\nHand ganz hoch.\n\nAtmen\n\nAbziehen\n\nNachhalten"
    )
  )
  await page.click(`link("Ablauf zum Prüfen")`)
  check(
    "Abläufe: mit Ungespeichertem verlassen fragt",
    await page.waitFor(`txt(${DIALOG}).includes("Änderungen verwerfen?")`, 5_000)
  )
  await page.click(`button("Abbrechen", ${DIALOG})`)
  await page.waitFor(`!${DIALOG}`)
  await page.click(`$("[data-routine-save]")`)
  check(
    "Abläufe: bearbeiten speichert den Text als Schritte",
    (await page.waitFor(`location.pathname === "${routinePath}"`, 10_000)) &&
      (await page.waitFor(`$$("[data-routine-steps] li").length === 4`, 10_000))
  )
  const id = routinePath.split("/").pop()
  await page.goto(`${base}/diary/routines`)
  check(
    "Abläufe: im Reiter steht der Ablauf unter „Ohne Disziplin“ mit seiner Zahl der Schritte",
    await page.ev<boolean>(
      `txt($('[data-routine-group="none"] [data-routine="${id}"]')).includes("4 Schritte")`
    )
  )
  await page.goto(`${base}/diary/thread`)
  check(
    "Abläufe: „Fragen“ zeigt keine Abläufe",
    await page.ev<boolean>(`!$("[data-routine-box]") && !$("[data-routine]")`)
  )

  record(
    await noSideScroll(page, {
      minFieldPx: 16,
      base,
      paths: [
        "/diary/routines",
        "/diary/thread",
        routinePath,
        `${routinePath}/edit`,
        "/diary/routines/new",
      ],
      widths: [390, 360],
    })
  )
  await page.viewport(390, 844)

  await page.goto(`${base}${routinePath}`)
  await page.click(`button("Ablauf löschen")`)
  await confirm(page, "Löschen")
  check(
    "Abläufe: Löschen geht auf den Reiter „Abläufe“ mit „Rückgängig“",
    await page.waitFor(
      `location.pathname === "/diary/routines" && txt($("[data-undo-bar]")).includes("Ablauf gelöscht")`,
      10_000
    )
  )
  await page.click(`button("Rückgängig", $("[data-undo-bar]"))`)
  check(
    "Abläufe: Rückgängig bringt den Ablauf zurück in den Reiter",
    await page.waitFor(`!!$('[data-routine="${id}"]')`, 10_000)
  )
}

/**
 * Auswertung: Reiter, ohne Befinden die Leersätze, dann Befinden an einem Eintrag mit Scheibe, die Zeile „Energie“, die
 * Seite des Merkmals mit Rückweg, das Blatt der Hilfe, kein seitliches Scrollen. Schreibt nur das Befinden eines
 * Eintrags, den `cleanUp` ohnehin löscht.
 */
async function analysis(page: Page, { base, check, record }: Context) {
  await page.goto(`${base}/diary`)
  await page.click(`link("Auswertung", $("[data-diary-switch]"))`)
  check(
    "Auswertung: sechster Reiter, erreichbar und gewählt",
    (await page.waitFor(`location.pathname === "/diary/analysis"`, 10_000)) &&
      (await page.waitFor(
        `$('[data-diary-switch] a[aria-current="page"]')?.textContent === "Auswertung"`
      ))
  )
  const empty = await page.ev<boolean[]>(
    `["Noch kein Eintrag mit Befinden.", "Noch keine bewertete Serie.", "Noch kein Eintrag mit erwartetem Ergebnis.",
      "Noch kein Eintrag mit Prognose und Feedback."].map((t) => txt(document.body).includes(t))`
  )
  check(
    "Auswertung: ohne Befinden stehen Einflüsse und Selbstbild mit allen Leersätzen da",
    (await page.ev<boolean>(`!!$("[data-influences]") && !!$("[data-self-image]")`)) &&
      empty.every(Boolean),
    empty.join(", ")
  )

  // Befinden an einem Eintrag mit Scheibe
  await page.goto(`${base}/diary`)
  const entry = await page.ev<string | null>(
    `$$("[data-diary-entry]").find((a) => !txt(a).includes("Trockentraining"))?.getAttribute("data-diary-entry") ?? null`
  )
  if (!entry) throw new Error("Auswertung: kein Eintrag mit Scheibe übrig")
  await page.goto(`${base}/diary/${entry}`)
  const wellbeing = `$('[data-section="wellbeing"]')`
  await page.click(`button("Befinden eintragen")`)
  for (let i = 0; i < 4; i++) {
    const row = `$$("[data-stage-row]", ${wellbeing})[${i}]`
    await page.click(`$('[data-stage="4"]', ${row})`)
    await page.waitFor(`$('[data-stage="4"]', ${row}).ariaPressed === "true"`)
    await page.wait(300)
  }

  await page.goto(`${base}/diary/analysis`)
  const energy = await page.ev<{ pill: string; text: string; basis: string }>(
    `(() => { const line = $('[data-influence="energy"]')
      return { pill: txt(line && $("[data-pill]", line)), text: txt(line), basis: txt($("[data-influence-basis]")) } })()`
  )
  check(
    "Auswertung: nach dem Befinden steht „Energie“ mit „Noch kein Urteil“ und dem Grund",
    energy.pill === "Noch kein Urteil" &&
      (energy.text.includes("Für ein Urteil braucht es") ||
        energy.basis.includes("zählt nicht mit")),
    energy
  )
  const family = await page.ev<string | null>(
    `new URL($('[data-influence="energy"]').href).searchParams.get("family")`
  )
  await page.click(`$('[data-influence="energy"]')`)
  check(
    "Auswertung: ein Tipp auf „Energie“ öffnet seine Seite mit Rückweg",
    (await page.waitFor(`location.pathname === "/diary/analysis/energy"`, 10_000)) &&
      (await page.ev<boolean>(`!!link("Auswertung", $("[data-factor-page]"))`)),
    await page.ev<string>(`location.href`)
  )
  await page.click(`link("Auswertung", $("[data-factor-page]"))`)
  check(
    "Auswertung: der Rückweg führt zurück, mit derselben Disziplin",
    (await page.waitFor(`location.pathname === "/diary/analysis"`, 10_000)) &&
      (await page.ev<string | null>(`new URL(location.href).searchParams.get("family")`)) ===
        family,
    family
  )

  await page.click(`button("Erklärung: Einflüsse")`, { settle: 300 })
  const help = await page.ev<string>(`txt(sheet())`)
  await page.click(`button("Schließen", sheet())`, { settle: 300 })
  check(
    "Auswertung: „?“ an Einflüsse öffnet das Blatt mit der Form und schließt",
    help.includes("Deine Form ist der Schnitt") && (await page.ev<boolean>(`!sheet()`)),
    help.slice(0, 80)
  )

  // am schmalen Telefon wischt die Leiste: der gewählte Reiter steht trotzdem ganz im Bild
  await page.viewport(360, 844)
  await page.goto(`${base}/diary/analysis`)
  const tab = await page.ev<{ left: number; right: number; barLeft: number; barRight: number }>(
    `(() => { const bar = $("[data-diary-switch] [data-tab-bar]").getBoundingClientRect()
      const tab = $('[data-diary-switch] a[aria-current="page"]').getBoundingClientRect()
      return { left: tab.left, right: tab.right, barLeft: bar.left, barRight: bar.right } })()`
  )
  check(
    "Auswertung: Telefon 360 px, der gewählte Reiter steht ganz im Bild",
    tab.left >= tab.barLeft - 0.5 && tab.right <= tab.barRight + 0.5,
    tab
  )

  record(
    await noSideScroll(page, {
      minFieldPx: 16,
      base,
      paths: ["/diary/analysis", "/diary/analysis/energy"],
      widths: [390, 360],
    })
  )
  await page.viewport(390, 844)
}
