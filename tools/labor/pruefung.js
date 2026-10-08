// Skriptprüfung des Labors: Bedienung durchspielen und die Zeichenregeln am gerenderten Bild nachmessen.
// Läuft mit #pruefen in Headless-Chrome (scripts/pruefen.ts); das Ergebnis steht am Ende in <pre id="dbg">.
addEventListener("load", async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const log = []
  const check = (name, ok, detail = "") =>
    log.push(`${ok ? "OK  " : "FAIL"} ${name}${detail === "" ? "" : ` — ${detail}`}`)
  const $ = (selector, root = document) => root.querySelector(selector)
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
  const txt = (el) => (el ? el.textContent.replace(/ /g, " ") : "")
  const svg = () => $("#target-box svg")
  const view = () => svg().getAttribute("viewBox").split(" ").map(Number)
  const pxPerMm = () => svg().getBoundingClientRect().width / view()[2]
  const hits = () => $$('[data-layer="shots"] > g[data-shot]', svg())
  const labelsOf = (groups) => groups.map((g) => g.dataset.shot)
  const button = (label, root = document) => $$("button", root).find((b) => txt(b).trim() === label)
  const click = async (el, ms = 60) => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await wait(ms)
  }
  const circleOf = (g) => $("circle", g)
  const center = (c) => [Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))]

  // Streukreis: liegt um die Treffer der Gruppe, am weitesten Treffer genau 2 px Luft
  const spreadGapPx = (groupHits) => {
    const spread = $('[data-overlay="spread"]', svg())
    if (!spread) return null
    const [sx, sy] = center(spread)
    const r = Number(spread.getAttribute("r"))
    const reach = Math.max(
      ...groupHits.map((g) => {
        const c = circleOf(g)
        const [x, y] = center(c)
        return Math.hypot(x - sx, y - sy) + Number(c.getAttribute("r"))
      })
    )
    return (r - reach) * pxPerMm()
  }
  const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance

  await wait(400)

  // ---------- Kopf und Ausgangslage (LP, 40 Schuss mit Probe)
  check(
    "Kopf: Stand gesetzt",
    /Stand [0-9a-f]{7}/.test(txt($("header"))),
    txt($("header")).slice(-40)
  )
  const [x0, , w0] = view()
  check(
    "Scheibe: ganze LP-Scheibe im Ausschnitt",
    near(w0, 171.05, 1e-6) && near(x0, -85.525, 1e-6),
    `${w0}`
  )
  check(
    "Scheibe: 49 Treffer, 9 Probe zuerst, dann 1 bis 40",
    labelsOf(hits()).join() ===
      [
        ...Array.from({ length: 9 }, (_, i) => `P${i + 1}`),
        ...Array.from({ length: 40 }, (_, i) => `${i + 1}`),
      ].join()
  )
  const probes = hits().filter((g) => g.dataset.shot.startsWith("P"))
  check(
    "Probe hohl",
    probes.every((g) => circleOf(g).getAttribute("fill") === "none")
  )
  check(
    "Probe vor der Verstellung (nach P4) gestrichelt",
    labelsOf(probes.filter((g) => circleOf(g).getAttribute("stroke-dasharray"))).join() ===
      "P1,P2,P3,P4"
  )
  const matchCircle = circleOf(hits().find((g) => g.dataset.shot === "1"))
  check(
    "Wertung gefüllt, Deckkraft 0,8, Haarlinie",
    matchCircle.getAttribute("fill-opacity") === "0.8" &&
      matchCircle.getAttribute("vector-effect") === "non-scaling-stroke"
  )
  check(
    "Ringzahlen höchstens 12 px",
    $$("text[data-ring]", svg()).every(
      (t) => Number(t.getAttribute("font-size")) * pxPerMm() <= 12.01
    )
  )
  const overlays = $('[data-layer="overlays"]', svg())
  check("Schwerpunkt ganz oben", overlays.lastElementChild?.dataset.overlay === "mpi")
  const mpiPx =
    Number(/scale\(([^)]+)\)/.exec($('[data-overlay="mpi"]', svg()).getAttribute("transform"))[1]) *
    pxPerMm()
  check("Schwerpunkt 5–8 px", mpiPx >= 4.99 && mpiPx <= 8.01, mpiPx.toFixed(2))
  const allMatch = hits().filter((g) => !g.dataset.shot.startsWith("P"))
  const gapAll = spreadGapPx(allMatch)
  check(
    "Streukreis um die Treffer, 2 px Luft",
    gapAll !== null && near(gapAll, 2, 0.05),
    gapAll?.toFixed(3)
  )
  check("Ablesung: letzter Schuss", txt($("#readout")).includes("Schuss 40 · letzter Schuss"))
  check(
    "Übersicht: Ergebnis 365,2 und 9 Zehner wie in der Spielwiese",
    txt($("#summary")).includes("365,2") && /Zehner\s*9/.test(txt($("#summary"))),
    txt($("#summary"))
  )

  // ---------- Nummern in Ebenen
  check("Nummern zuerst aus", $$("text[data-number]", svg()).length === 0)
  await click(button("Nummern"))
  const numbered = hits()
  check(
    "Nummern an: jede in der Gruppe ihres Treffers, nach dem Kreis",
    numbered.every((g) => {
      const t = $("text[data-number]", g)
      return (
        t &&
        t.dataset.number === g.dataset.shot &&
        g.lastElementChild === t &&
        t.previousElementSibling?.tagName === "circle"
      )
    })
  )
  const numberPx = Number($("text[data-number]", svg()).getAttribute("font-size")) * pxPerMm()
  check("Nummern 8–12 px", numberPx >= 7.99 && numberPx <= 12.01, numberPx.toFixed(2))
  check(
    "ein späterer Schuss liegt über der Nummer eines früheren",
    hits().indexOf(hits().find((g) => g.dataset.shot === "2")) >
      hits().indexOf(hits().find((g) => g.dataset.shot === "1"))
  )

  // ---------- Antippen
  await click(hits().find((g) => g.dataset.shot === "14"))
  check(
    "Antippen hebt den Schuss ganz nach oben, mit Ring",
    hits().at(-1).dataset.shot === "14" &&
      hits().at(-1).dataset.chosen === "true" &&
      !!$('[data-ring="chosen"]', svg())
  )
  check(
    "Ablesung zeigt den angetippten Schuss",
    txt($("#readout")).includes("Schuss 14 · angetippt")
  )
  await click(hits().find((g) => g.dataset.shot === "14"))
  check(
    "zweites Antippen nimmt ihn zurück",
    !$("[data-chosen]", svg()) && txt($("#readout")).includes("letzter Schuss")
  )

  // ---------- Auswahl einer Serie
  const tile = (key) => $(`[data-series="${key}"]`)
  await click(tile("2"))
  check(
    "Serie 2 gewählt, „Alle“ nicht mehr gedrückt",
    tile("2").getAttribute("aria-pressed") === "true" &&
      button("Alle").getAttribute("aria-pressed") === "false"
  )
  const series2 = hits().filter((g) => !g.dataset.faded)
  check(
    "nur Serie 2 kräftig, alle anderen blass",
    labelsOf(series2).join() === "11,12,13,14,15,16,17,18,19,20" &&
      hits()
        .filter((g) => g.dataset.faded)
        .every((g) => g.getAttribute("opacity") === "0.18")
  )
  check(
    "Nummern nur auf der Auswahl, Nummern der ganzen Scheibe",
    labelsOf($$("text[data-number]", svg()).map((t) => t.parentElement)).join() ===
      "11,12,13,14,15,16,17,18,19,20"
  )
  check(
    "blasse Schüsse liegen unter der Auswahl",
    hits()
      .slice(-10)
      .every((g) => !g.dataset.faded)
  )
  const gap2 = spreadGapPx(series2)
  check("Streukreis folgt der Auswahl", gap2 !== null && near(gap2, 2, 0.05), gap2?.toFixed(3))
  const centers = series2.map((g) => center(circleOf(g)))
  const mean = [0, 1].map((k) => centers.reduce((s, c) => s + c[k], 0) / centers.length)
  const mpiAt = /translate\(([^ ]+) ([^)]+)\)/
    .exec($('[data-overlay="mpi"]', svg()).getAttribute("transform"))
    .slice(1)
    .map(Number)
  check(
    "Schwerpunkt der Auswahl",
    near(mpiAt[0], mean[0], 1e-6) && near(mpiAt[1], mean[1], 1e-6),
    `${mpiAt} / ${mean}`
  )
  await click(button("Gruppe"), 700)
  const [gx, gy, gw] = view()
  check(
    "Gruppe: Ausschnitt auf Serie 2, alle ihre Treffer darin",
    gw < 100 && centers.every(([x, y]) => x > gx && x < gx + gw && y > gy && y < gy + gw),
    `${gw.toFixed(2)} mm`
  )
  const numberPxGroup = Number($("text[data-number]", svg()).getAttribute("font-size")) * pxPerMm()
  check(
    "Nummern auch gezoomt 8–12 px",
    numberPxGroup >= 7.99 && numberPxGroup <= 12.01,
    numberPxGroup.toFixed(2)
  )
  await click(button("Übrige aus"))
  check(
    "„Übrige aus“: nur die Auswahl gezeichnet",
    labelsOf(hits()).join() === "11,12,13,14,15,16,17,18,19,20"
  )
  await click(button("Übrige blass"))
  // eine Serie oder alle: eine andere Serie wechselt, keine Mehrfachauswahl
  await click(tile("3"))
  check(
    "Serie 3 statt Serie 2, nur eine Kachel gedrückt",
    labelsOf(hits().filter((g) => !g.dataset.faded)).join() === "21,22,23,24,25,26,27,28,29,30" &&
      $$("[data-series][aria-pressed='true']").length === 1
  )
  await click(tile("3"), 700)
  check(
    "dieselbe Serie noch einmal zeigt wieder alle",
    hits().every((g) => !g.dataset.faded) && button("Alle").getAttribute("aria-pressed") === "true"
  )
  await click(tile("4"))
  await click(button("Alle"), 700)
  check(
    "„Alle“ setzt zurück",
    hits().every((g) => !g.dataset.faded) && button("Alle").getAttribute("aria-pressed") === "true"
  )
  await click(button("Scheibe"), 700)

  // ---------- Serien als kleine Scheiben
  const tiles = $$("[data-series]")
  check(
    "Serien: Probe und vier Serien",
    tiles.map((t) => t.dataset.series).join() === "probe,1,2,3,4"
  )
  const boxes = new Set(tiles.map((t) => $("svg", t).getAttribute("viewBox")))
  check("Serien: alle im selben Ausschnitt", boxes.size === 1)
  const rows = new Map()
  for (const t of tiles) {
    const top = Math.round(t.getBoundingClientRect().top)
    rows.set(top, (rows.get(top) ?? 0) + 1)
  }
  const counts = [...rows.values()]
  check(
    "Serien: gleich volle Zeilen, keine allein",
    counts.length === 1 || Math.min(...counts) >= Math.max(...counts) - 1,
    counts.join("+")
  )
  check(
    "Serien: Probe mit Zahl nach der Verstellung",
    txt(tile("probe")).includes("5 nach der Verstellung")
  )

  // ---------- Setzen
  await click(button("Setzen"))
  // Klick genau auf die Mitte der Scheibe (0 | 0), umgerechnet wie im Labor über die Bildschirm-Matrix
  const mid = new DOMPoint(0, 0).matrixTransform(svg().getScreenCTM())
  svg().dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: mid.x, clientY: mid.y }))
  await wait(80)
  const added = hits().find((g) => g.dataset.shot === "41")
  // Chrome kürzt die Koordinaten eines Klicks auf ganze Pixel: höchstens ein Pixel daneben, dazu die
  // Rundung auf 1/100 mm
  const tolerance = 1 / pxPerMm() + 0.01
  const at = added ? center(circleOf(added)) : [NaN, NaN]
  check(
    "Setzen: Schuss 41 an der getippten Stelle",
    !!added && near(at[0], 0, tolerance) && near(at[1], 0, tolerance),
    `${at.map((v) => v.toFixed(3))} ±${tolerance.toFixed(3)} mm`
  )
  check(
    "Setzen: Ablesung 10,9 für die Mitte",
    txt($("#readout")).includes("Schuss 41 · letzter Schuss") &&
      txt($("#readout")).includes("10,9"),
    txt($("#readout")).slice(0, 60)
  )
  await click(button("Ansehen"))

  // ---------- leere Scheibe Schuss für Schuss: die Serienleiste erscheint erst mit dem ersten Schuss und
  // misst dann ihre Breite (sonst stünden die Kacheln in schmalen Zeilen für 300 px)
  await click(button("Leer"), 100)
  check(
    "Leer: keine Treffer, keine Serien, Ablesung wartet",
    hits().length === 0 &&
      $$("[data-series]").length === 0 &&
      txt($("#readout")).includes("Noch kein Schuss")
  )
  await click(button("Setzen"))
  const setAt = async (x, y) => {
    const p = new DOMPoint(x, y).matrixTransform(svg().getScreenCTM())
    svg().dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: p.x, clientY: p.y }))
    await wait(30)
  }
  await click(button("Probe"))
  await setAt(4, -4)
  await click(button("Wertung"))
  for (let i = 0; i < 31; i++) await setAt(((i % 7) - 3) * 2, (Math.floor(i / 7) - 2) * 2)
  await wait(200)
  const fresh = $$("[data-series]")
  const freshRows = new Set(fresh.map((t) => Math.round(t.getBoundingClientRect().top)))
  check(
    "Leer gesetzt: Probe und vier Serien in einer Zeile",
    fresh.map((t) => t.dataset.series).join() === "probe,1,2,3,4" && freshRows.size === 1,
    `${fresh.length} Kacheln, ${freshRows.size} Zeilen`
  )
  await click(button("Ansehen"))
  await click(button("40 Schuss mit Probe"), 100)

  // ---------- Wertung, Scheibe, Thema
  await click(button("Ganze Ringe"))
  const seriesValues = $$("[data-series] b")
    .slice(1)
    .map((b) => txt(b).trim())
  check(
    "Ganze Ringe: Serien als ganze Zahlen",
    seriesValues.every((v) => /^\d+$/.test(v)),
    seriesValues.join(" ")
  )
  await click(button("Zehntel"))
  // eine andere Scheibe steht sofort, ohne Gleiten
  await click(button("Luftgewehr"), 60)
  const [, , wLg] = view()
  check(
    "Luftgewehr: eigene Scheibe, Zehnerserie wählbar",
    near(wLg, 53.5, 1e-6) && !!button("Zehnerserie"),
    `${wLg}`
  )
  await click(button("Zehnerserie"))
  check(
    "Zehnerserie: zehn Treffer, keine Probe",
    hits().length === 10 && !$("[data-series='probe']")
  )
  await click(button("Luftpistole"), 60)
  // eine andere Karte derselben Scheibe steht ebenso sofort: aus der Gruppe direkt auf die ganze Scheibe
  await click(button("Gruppe"), 700)
  const [, , wGroup] = view()
  await click(button("Ausdruck vom 2. Oktober"), 60)
  const [, , wNext] = view()
  check(
    "andere Karte derselben Scheibe: sofort im neuen Ausschnitt",
    wGroup < 171 && near(wNext, 171.05, 1e-6),
    `${wGroup.toFixed(2)} → ${wNext}`
  )
  await click(button("40 Schuss mit Probe"), 60)
  await click(button("Dunkel"))
  check("Thema dunkel", document.documentElement.classList.contains("dark"))
  await click(button("Hell"))
  check("Thema hell", !document.documentElement.classList.contains("dark"))
  await click(button("System"))

  // ---------- Handy: 390 px ohne seitliches Scrollen
  const frame = document.createElement("iframe")
  frame.style.cssText = "width:390px;height:900px;border:0;position:absolute;left:-9999px"
  frame.src = location.href.split("#")[0]
  document.body.appendChild(frame)
  await new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }))
  await wait(500)
  const doc = frame.contentDocument
  check(
    "Handy 390 px: kein seitliches Scrollen",
    !!doc && doc.documentElement.scrollWidth <= 390,
    doc ? `${doc.documentElement.scrollWidth}` : "kein Zugriff"
  )
  frame.remove()

  check("Keine Skriptfehler", window.__errors.length === 0, window.__errors.join(" | "))

  const pre = document.createElement("pre")
  pre.id = "dbg"
  pre.textContent = log.join("\n")
  document.body.appendChild(pre)
})
