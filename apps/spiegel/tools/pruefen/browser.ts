// Chrome headless über das DevTools-Protokoll, ohne Abhängigkeit (der `WebSocket` von Node 24). Eingaben sind echte
// Eingaben (`Input.dispatch*`): Fokus, Standardaktionen und `next/link` verhalten sich wie bei einem Menschen. Für die
// Skriptprüfung der App (`pruefen.ts`), nicht im Gate.

import { spawn, type ChildProcess } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Message = {
  id?: number
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: { message: string }
  sessionId?: string
}

export class Browser {
  private nextId = 1
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private listeners = new Set<(m: Message) => void>()

  private constructor(
    private readonly chrome: ChildProcess,
    private readonly socket: WebSocket,
    private readonly profile: string
  ) {
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as Message
      if (message.id !== undefined) {
        const waiting = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) waiting?.reject(new Error(message.error.message))
        else waiting?.resolve(message.result)
      } else for (const listener of this.listeners) listener(message)
    })
    // stirbt Chrome mitten im Lauf, hängt sonst jeder offene Aufruf, bis die Zeit der Prüfung abläuft
    const fail = () => {
      this.closed = true
      for (const waiting of this.pending.values()) waiting.reject(new Error("Chrome ist weg"))
      this.pending.clear()
    }
    socket.addEventListener("close", fail)
    socket.addEventListener("error", fail)
  }

  private closed = false

  static async launch(): Promise<Browser> {
    const profile = mkdtempSync(join(tmpdir(), "spiegel-pruefen-"))
    // ohne Pipes: niemand liest sie, und eine volle Pipe hielte Chrome an
    const chrome = spawn(
      CHROME,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--remote-debugging-port=0",
        `--user-data-dir=${profile}`,
        "about:blank",
      ],
      { stdio: "ignore" }
    )
    let failed: Error | null = null
    chrome.once("error", (error) => (failed = error))
    try {
      let port: string | null = null
      for (let i = 0; i < 100 && !port && !failed; i++) {
        await wait(100)
        try {
          port = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]
        } catch {
          // Chrome schreibt die Datei erst nach dem Start
        }
      }
      if (!port) throw new Error(`Chrome startet nicht (${CHROME}); CHROME_PATH setzen`)
      const version = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()) as {
        webSocketDebuggerUrl: string
      }
      const socket = new WebSocket(version.webSocketDebuggerUrl)
      await new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve, { once: true })
        socket.addEventListener("error", reject, { once: true })
      })
      return new Browser(chrome, socket, profile)
    } catch (error) {
      // nichts zurücklassen: kein Chrome, kein Profil im Temp-Verzeichnis
      chrome.kill("SIGKILL")
      rmSync(profile, { recursive: true, force: true })
      throw error
    }
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}, sessionId?: string) {
    if (this.closed) return Promise.reject(new Error("Chrome ist weg"))
    const id = this.nextId++
    this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    })
  }

  on(listener: (m: Message) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async newPage(): Promise<Page> {
    const { targetId } = await this.send<{ targetId: string }>("Target.createTarget", {
      url: "about:blank",
    })
    const { sessionId } = await this.send<{ sessionId: string }>("Target.attachToTarget", {
      targetId,
      flatten: true,
    })
    const page = new Page(this, sessionId, targetId)
    await page.init()
    return page
  }

  async close(): Promise<void> {
    try {
      // höchstens zwei Sekunden: ein hängendes Chrome soll das Ende der Prüfung nicht aufhalten
      await Promise.race([this.send("Browser.close"), wait(2_000)])
    } catch {
      // schon zu
    }
    this.chrome.kill("SIGKILL")
    try {
      // Chrome schreibt nach dem Kill noch kurz ins Profil (ENOTEMPTY); ein Rest im Temp-Ordner darf den Bericht nicht
      // verhindern
      rmSync(this.profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch {
      // bleibt liegen
    }
  }
}

/** ein Element per Ausdruck im Fenster, etwa `$("#target")` oder `button("Lage")` aus den Helfern */
export type Locator = string

const MODIFIERS = { alt: 1, ctrl: 2, meta: 4, shift: 8 } as const
export type Modifier = keyof typeof MODIFIERS

const KEYS: Record<string, { code: string; keyCode: number }> = {
  ArrowLeft: { code: "ArrowLeft", keyCode: 37 },
  ArrowUp: { code: "ArrowUp", keyCode: 38 },
  ArrowRight: { code: "ArrowRight", keyCode: 39 },
  ArrowDown: { code: "ArrowDown", keyCode: 40 },
  Home: { code: "Home", keyCode: 36 },
  End: { code: "End", keyCode: 35 },
  Escape: { code: "Escape", keyCode: 27 },
  Enter: { code: "Enter", keyCode: 13 },
  Tab: { code: "Tab", keyCode: 9 },
  " ": { code: "Space", keyCode: 32 },
}

export class Page {
  /** Fehler im Fenster (unbehandelte Ausnahmen und `console.error`) über den ganzen Lauf */
  readonly errors: string[] = []
  private width = 1280
  private height = 900

  constructor(
    private readonly browser: Browser,
    private readonly sessionId: string,
    readonly targetId: string
  ) {}

  private send<T = unknown>(method: string, params: Record<string, unknown> = {}) {
    return this.browser.send<T>(method, params, this.sessionId)
  }

  async init(): Promise<void> {
    this.browser.on((m) => {
      if (m.sessionId !== this.sessionId) return
      if (m.method === "Runtime.exceptionThrown") {
        const details = m.params?.exceptionDetails as {
          exception?: { description?: string }
          text?: string
        }
        this.errors.push(
          `Ausnahme: ${details.exception?.description?.split("\n")[0] ?? details.text}`
        )
      }
      if (m.method === "Runtime.consoleAPICalled" && m.params?.type === "error") {
        const args = (m.params.args as { value?: unknown; description?: string }[]) ?? []
        this.errors.push(
          `console.error: ${args
            .map((a) => String(a.value ?? a.description ?? ""))
            .join(" ")
            .slice(0, 200)}`
        )
      }
    })
    await this.send("Page.enable")
    await this.send("Runtime.enable")
    await this.send("Page.addScriptToEvaluateOnNewDocument", { source: HELPERS })
  }

  /** Fenstergröße; unter 768 px als Telefon (Touch, mobile Ansicht) */
  async viewport(width: number, height: number): Promise<void> {
    this.width = width
    this.height = height
    const mobile = width < 768
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    })
    await this.send(
      "Emulation.setTouchEmulationEnabled",
      mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false }
    )
  }

  get size() {
    return { width: this.width, height: this.height }
  }

  /** eine Adresse laden und warten, bis React die Seite übernommen hat */
  async goto(url: string, ready: Locator = '$("[data-app-frame]") ?? $("form")'): Promise<void> {
    const loaded = () => {
      let off = () => {}
      const promise = new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 20_000)
        off = this.browser.on((m) => {
          if (m.sessionId === this.sessionId && m.method === "Page.loadEventFired") {
            clearTimeout(timer)
            resolve(true)
          }
        })
      })
      return promise.finally(() => off())
    }
    let waiting = loaded()
    const { loaderId } = await this.send<{ loaderId?: string }>("Page.navigate", { url })
    // nur der Anker anders: der Browser lädt nicht neu, und ein Neuladen behielte die Scrollstelle. Die Prüfung will die
    // Seite frisch mit dem Anker, also über eine leere Seite
    if (!loaderId) {
      waiting = loaded()
      await this.send("Page.navigate", { url: "about:blank" })
      await waiting
      waiting = loaded()
      await this.send("Page.navigate", { url })
    }
    if (!(await waiting)) throw new Error(`lädt nicht: ${url}`)
    if (
      !(await this.waitFor(
        `(() => { const el = ${ready}; return !!el && hydrated(el) })()`,
        20_000
      ))
    )
      throw new Error(`nicht bereit: ${url}`)
    await wait(250)
  }

  /** einen Ausdruck im Fenster auswerten (mit `await`), Ergebnis als Wert */
  async ev<T = unknown>(expression: string): Promise<T> {
    const result = await this.send<{
      result: { value?: T }
      exceptionDetails?: { exception?: { description?: string }; text: string }
    }>("Runtime.evaluate", {
      expression: `(async () => (${expression}))()`,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails)
      throw new Error(
        `${expression.slice(0, 80)}: ${result.exceptionDetails.exception?.description?.split("\n")[0] ?? result.exceptionDetails.text}`
      )
    return result.result.value as T
  }

  /** warten, bis der Ausdruck wahr ist */
  async waitFor(expression: string, timeoutMs = 5_000): Promise<boolean> {
    const until = Date.now() + timeoutMs
    while (Date.now() < until) {
      if (await this.ev<boolean>(`!!(${expression})`).catch(() => false)) return true
      await wait(50)
    }
    return false
  }

  async wait(ms: number): Promise<void> {
    await wait(ms)
  }

  /** Mitte eines Elements im Fenster; ist es nicht im Bild, vorher dorthin scrollen (ohne Gleiten) */
  private async centerOf(locator: Locator, scroll: boolean): Promise<{ x: number; y: number }> {
    const point = await this.ev<{ x: number; y: number } | null>(`(() => {
      const el = ${locator}
      if (!el) return null
      const inView = (r) => r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth
      if (${scroll} && !inView(el.getBoundingClientRect())) el.scrollIntoView({ block: "center", behavior: "instant" })
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })()`)
    if (!point) throw new Error(`nicht gefunden: ${locator}`)
    return point
  }

  /** ein echter Klick in die Mitte des Elements */
  async click(locator: Locator, { scroll = true, settle = 150 } = {}): Promise<void> {
    const { x, y } = await this.centerOf(locator, scroll)
    await this.clickAt(x, y)
    await wait(settle)
  }

  async clickAt(x: number, y: number): Promise<void> {
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
    await this.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    })
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: "left",
      buttons: 0,
      clickCount: 1,
    })
  }

  /** Maus drücken, über Punkte ziehen, loslassen (Zeiger-Ereignisse wie bei einer echten Maus) */
  async drag(points: readonly { x: number; y: number }[]): Promise<void> {
    const [first, ...rest] = points
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...first })
    await this.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      ...first,
      button: "left",
      buttons: 1,
      clickCount: 1,
    })
    for (const p of rest) {
      await this.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        ...p,
        button: "left",
        buttons: 1,
      })
      await wait(20)
    }
    const last = points.at(-1)!
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      ...last,
      button: "left",
      buttons: 0,
      clickCount: 1,
    })
  }

  async hover(x: number, y: number): Promise<void> {
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 })
  }

  /** eine echte Taste auf das fokussierte Element */
  async key(key: string, modifiers: readonly Modifier[] = []): Promise<void> {
    const info = KEYS[key] ?? {
      code: `Key${key.toUpperCase()}`,
      keyCode: key.toUpperCase().charCodeAt(0),
    }
    const mods = modifiers.reduce((sum, m) => sum | MODIFIERS[m], 0)
    const base = { key, code: info.code, windowsVirtualKeyCode: info.keyCode, modifiers: mods }
    await this.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...base })
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", ...base })
    await wait(60)
  }

  /** Bildschirmfoto des Fensters als PNG */
  async screenshot(fullPage = false): Promise<Buffer> {
    const { data } = await this.send<{ data: string }>("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: fullPage,
    })
    return Buffer.from(data, "base64")
  }

  async close(): Promise<void> {
    await this.browser.send("Target.closeTarget", { targetId: this.targetId })
  }
}

/**
 * Helfer im Fenster, vor jedem Laden eingesetzt. Nur Struktur, die `shot-ui`, `ui` und die App rendern (Daten-Attribute,
 * ARIA).
 */
const HELPERS = `
(() => {
  const $ = (s, root = document) => root.querySelector(s)
  const $$ = (s, root = document) => [...root.querySelectorAll(s)]
  const txt = (el) => (el ? el.textContent.replace(/\\u00a0/g, " ").trim() : "")
  const named = (el, label) => txt(el) === label || el.getAttribute("aria-label") === label
  const visible = (el) => !!el && el.getClientRects().length > 0
  const button = (label, root = document) => $$("button", root).find((b) => visible(b) && named(b, label)) ?? null
  const link = (label, root = document) => $$("a[href]", root).find((a) => visible(a) && named(a, label)) ?? null
  const rect = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height } }
  const near = (a, b, tol) => Math.abs(a - b) <= tol
  const hydrated = (el) => Object.keys(el).some((k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps"))
  const analysis = () => $('section[aria-label="Analyse"]')
  const tab = (label) => $$('[role="radiogroup"][aria-label="Thema"] [role="radio"]', analysis() ?? document).find((b) => txt(b) === label) ?? null
  const activeTab = () => txt($('[role="radiogroup"][aria-label="Thema"] [role="radio"][aria-checked="true"]', analysis() ?? document))
  const card = (id) => $('[data-card="' + id + '"]', analysis() ?? document)
  const pill = () => $$("button").find((b) => visible(b) && txt(b).startsWith("Zurück zu „")) ?? null
  const sectionNav = () => $('nav[aria-label="Abschnitte"]')
  const sheet = () => $$("dialog").find((d) => d.open) ?? null
  // was über den Rand ragt: die drei breitesten Elemente, damit ein Fehlschlag sagt, wo es klemmt
  const widest = (limit) => $$("body *").filter((el) => !(el instanceof SVGElement) && el.getBoundingClientRect().right > limit + 1)
    .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right).slice(0, 3)
    .map((el) => el.tagName.toLowerCase() + "." + String(el.className).split(" ").slice(0, 2).join(".") + " " + Math.round(el.getBoundingClientRect().right))
  // letzte Taste: hat die Seite sie für sich genommen? (Lauscher ganz außen, nach allen anderen)
  window.__keys = []
  addEventListener("keydown", (e) => {
    window.__keys.push({ key: e.key, taken: e.defaultPrevented })
    // Alt+Pfeil führte den Browser zurück; die Prüfung will nur wissen, ob die Seite sie genommen hat
    if (e.altKey && !e.defaultPrevented) e.preventDefault()
  })
  Object.assign(window, { $, $$, txt, visible, button, link, rect, near, hydrated, analysis, tab, activeTab, card, pill, sectionNav, sheet, widest })
})()
`
