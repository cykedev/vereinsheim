// Bedienung von Ringwerk für die Abläufe: echte Klicks und Eingaben über `@vereinsheim/pruefen`, gefunden über
// sichtbare Beschriftung, `aria-label`, `title`, `id` und ARIA-Rollen. Radix-Auswahlen öffnen ihre Liste über den
// Auslöser (`role="combobox"` mit der `id`) und wählen eine `role="option"`.

import type { Page } from "@vereinsheim/pruefen/browser"

import { stableText } from "./capture"

/** Helfer im Fenster; eine Navigation im Client behält sie, ein Neuladen setzt sie neu */
const INSTALL = `(window.__rwui || (window.__rwui = true, Object.assign(window, {
  named: (el, label) => txt(el) === label || el.getAttribute("aria-label") === label || el.getAttribute("title") === label,
  namedRe: (el, src) => { const re = new RegExp(src); return re.test(txt(el)) || re.test(el.getAttribute("aria-label") ?? "") || re.test(el.getAttribute("title") ?? "") },
  dlg: () => $$('[role="dialog"], [role="alertdialog"]').filter(visible).at(-1) ?? null,
  btn: (label, root) => $$("button, a[href]", root ?? document).find((b) => visible(b) && named(b, label)) ?? null,
  btnRe: (src, root) => $$("button, a[href]", root ?? document).find((b) => visible(b) && namedRe(b, src)) ?? null,
  opt: (src) => $$('[role="option"]').find((o) => visible(o) && new RegExp(src).test(txt(o))) ?? null,
  rowOf: (text, root) => $$("tr", root ?? document).find((tr) => visible(tr) && txt(tr).includes(text)) ?? null,
  // kleinster Eintrag (Zeile, Listenpunkt, Karte), der alle Texte und den Knopf enthält
  itemOf: (texts, label) => $$("main tr, main li, main div").filter((el) => visible(el) &&
    texts.every((t) => txt(el).includes(t)) && (!label || btn(label, el))).sort((a, b) => txt(a).length - txt(b).length)[0] ?? null,
  // ein Text, der für sich steht (nicht im Auslöser einer Auswahl)
  shown: (text) => $$("main *").some((el) => visible(el) && el.children.length === 0 && txt(el) === text && !el.closest('[role="combobox"]')),
  toasts: () => $$("[data-sonner-toast]").map(txt),
}), true))`

const esc = (re: RegExp | string) =>
  JSON.stringify(
    typeof re === "string" ? `^${re.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$` : re.source
  )

export class Ui {
  constructor(
    readonly page: Page,
    private readonly base: string
  ) {}

  /** Ausdruck im Fenster mit den Helfern */
  ev<T = unknown>(expression: string): Promise<T> {
    return this.page.ev<T>(`(${INSTALL}, ${expression})`)
  }

  async open(path: string): Promise<void> {
    await this.page.goto(`${this.base}${path}`, '$("main") ?? $("form")', { settle: 0 })
    await stableText(this.page)
  }

  /** warten, bis der Ausdruck wahr ist; sonst Fehler mit `what` und den sichtbaren Meldungen */
  async until(expression: string, what: string, timeoutMs = 8_000): Promise<void> {
    const ok = await this.page.waitFor(`(${INSTALL}, ${expression})`, timeoutMs)
    if (!ok) {
      const toasts = await this.ev<string[]>("toasts()").catch(() => [])
      throw new Error(`${what}${toasts.length ? ` (Meldung: ${toasts.join(" | ")})` : ""}`)
    }
  }

  async path(): Promise<string> {
    return this.ev<string>("location.pathname")
  }

  async waitPath(re: RegExp, what: string): Promise<string> {
    await this.until(`${re}.test(location.pathname)`, what, 15_000)
    await stableText(this.page)
    return this.path()
  }

  /** echter Klick; `locator` ist ein Ausdruck im Fenster mit den Helfern */
  async click(locator: string, what = locator): Promise<void> {
    await this.until(`!!(${locator})`, `nicht gefunden: ${what}`)
    await this.page.click(`(${INSTALL}, ${locator})`, { settle: 250 })
  }

  /** Knopf oder Link nach Beschriftung, `aria-label` oder `title`, wahlweise in einem Bereich */
  async press(label: string | RegExp, root = "document"): Promise<void> {
    const locator =
      typeof label === "string"
        ? `btn(${JSON.stringify(label)}, ${root})`
        : `btnRe(${esc(label)}, ${root})`
    await this.click(locator, `Knopf „${label}“`)
  }

  /** Knopf im kleinsten Eintrag, der alle Texte enthält */
  async pressIn(texts: string[], label: string): Promise<void> {
    await this.click(
      `btn(${JSON.stringify(label)}, itemOf(${JSON.stringify(texts)}, ${JSON.stringify(label)}))`,
      `„${label}“ bei ${texts.join(" / ")}`
    )
  }

  /** im obersten offenen Dialog */
  async pressInDialog(label: string | RegExp): Promise<void> {
    await this.until("!!dlg()", `kein Dialog für „${label}“`)
    await this.press(label, "dlg()")
  }

  async dialogClosed(what: string): Promise<void> {
    await this.until("!dlg()", what, 10_000)
    await this.page.wait(300)
  }

  /** Feld per `id` füllen: Text getippt (vorher geleert), Datum über den Wert wie die Auswahl im Kalender */
  async fill(id: string, value: string): Promise<void> {
    const sel = `$(${JSON.stringify(`#${id}`)})`
    await this.until(`!!${sel} && !${sel}.disabled`, `Feld #${id} fehlt oder ist gesperrt`)
    const type = await this.ev<string>(`${sel}.type`)
    if (type === "date") {
      await this.ev(`(() => { const el = ${sel}
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, ${JSON.stringify(value)})
        el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })) })()`)
      return
    }
    await this.click(sel, `#${id}`)
    await this.ev(`${sel}.select()`)
    if (value === "") await this.page.key("Backspace")
    else await this.page.type(value)
  }

  async value(id: string): Promise<string> {
    return this.ev<string>(`$(${JSON.stringify(`#${id}`)})?.value ?? ""`)
  }

  /** Radix-Auswahl: Auslöser per `id`, Möglichkeit nach Text (genau oder Muster) */
  async choose(id: string, option: string | RegExp): Promise<void> {
    await this.click(`$(${JSON.stringify(`#${id}`)})`, `Auswahl #${id}`)
    await this.click(`opt(${esc(option)})`, `Möglichkeit „${option}“ in #${id}`)
    await this.until(`!$$('[role="listbox"]').some(visible)`, `Auswahl #${id} schließt nicht`)
    await this.until(
      `new RegExp(${esc(option)}).test(txt($(${JSON.stringify(`#${id}`)})))`,
      `#${id} zeigt nach der Wahl nicht „${option}“`
    )
  }

  /** Text des Auslösers einer Radix-Auswahl */
  async chosen(id: string): Promise<string> {
    return this.ev<string>(`txt($(${JSON.stringify(`#${id}`)}))`)
  }

  /** Radix-Schalter oder natives Kästchen auf einen Zustand bringen */
  async check(id: string, on: boolean): Promise<void> {
    const sel = `$(${JSON.stringify(`#${id}`)})`
    const state = `(${sel}.getAttribute("aria-checked") ?? String(${sel}.checked)) === "true"`
    if ((await this.ev<boolean>(state)) !== on) await this.click(sel, `#${id}`)
    await this.until(`${state} === ${on}`, `#${id} lässt sich nicht umschalten`)
  }

  async text(): Promise<string> {
    return stableText(this.page)
  }

  async toasts(): Promise<string[]> {
    return this.ev<string[]>("toasts()")
  }

  /** fängt `window.open` ab (PDF-Knöpfe öffnen ein neues Fenster) und liefert die Adresse nach dem Klick */
  async openedBy(label: string): Promise<string> {
    await this.ev(
      `(window.__opened = null, window.open = (url) => { window.__opened = String(url); return null })`
    )
    await this.press(label)
    await this.until("!!window.__opened", `„${label}“ öffnet nichts`)
    return this.ev<string>("window.__opened")
  }
}
