// Skriptprüfung des Labors: Bedienung durchspielen und die Zeichenregeln am gerenderten Bild nachmessen.
// Läuft mit #pruefen in Headless-Chrome (scripts/pruefen.ts); das Ergebnis steht am Ende in <pre id="dbg">.
addEventListener("load", async () => {
  // nur mit #pruefen: im Handy-Rahmen lädt dieselbe Seite ohne, dort läuft keine zweite Prüfung
  if (location.hash !== "#pruefen") return
  const log = []
  // ein Fehler mitten in der Prüfung steht als FAIL im Bericht, statt ihn zu verschlucken
  try {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
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
    const button = (label, root = document) =>
      $$("button", root).find((b) => txt(b).trim() === label)
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

    // Tippen an eine Stelle: die Scheibe wählt den nächsten Treffer der Auswahl (bis 20 px daneben)
    const toScreen = (x, y) => new DOMPoint(x, y).matrixTransform(svg().getScreenCTM())
    const tapCenters = () =>
      hits()
        .filter((g) => !g.dataset.faded)
        .map((g) => ({ label: g.dataset.shot, p: toScreen(...center(circleOf(g))) }))
    const ranked = ([x, y]) =>
      tapCenters()
        .map((c) => ({ label: c.label, d: Math.hypot(c.p.x - x, c.p.y - y) }))
        .sort((a, b) => a.d - b.d)
    const tapAt = async ([x, y], ms = 60) => {
      svg().dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }))
      await wait(ms)
    }
    const centerOf = (label) => {
      const p = toScreen(...center(circleOf(hits().find((g) => g.dataset.shot === label))))
      return [p.x, p.y]
    }
    // eine Stelle `dist` px neben der Mitte von `label`, an der dieser Treffer klar der nächste ist
    const beside = (label, dist) => {
      const [cx, cy] = centerOf(label)
      for (let k = 0; k < 16; k++) {
        const at = [
          cx + dist * Math.cos((k * Math.PI) / 8),
          cy + dist * Math.sin((k * Math.PI) / 8),
        ]
        const [first, second] = ranked(at)
        if (first?.label === label && (!second || second.d - first.d > 3)) return at
      }
      return null
    }

    // Prüfhaken des Labors (#pruefen): Schüsse, Zustand und die Funktionen des Fachkerns
    const L = () => window.__labor
    const tileKeys = () => $$("[data-metric]").map((t) => t.dataset.metric)
    const tileValue = (key) => txt($(`[data-metric="${key}"]`).children[1].childNodes[0])
    const expectedTile = (key) => {
      const { tools, shots, state } = L()
      const metric = tools.inScoring(tools.metricByKey(key), state.scoring)
      const value = tools.computeMetric(metric, tools.selectionShots(shots, state.selection))
      return value === null ? "–" : tools.formatValue(value, metric.decimals)
    }
    const tilesMatch = () => tileKeys().filter((key) => tileValue(key) !== expectedTile(key))
    const tableRows = () => $$("#shot-table tr[data-row]")
    const intervalText = (ms) =>
      ms === null
        ? "–"
        : ms > 180000
          ? `${L().tools.formatValue(ms / 60000, 0)} min`
          : `${L().tools.formatValue(ms / 1000, 0)} s`

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
      Number(
        /scale\(([^)]+)\)/.exec($('[data-overlay="mpi"]', svg()).getAttribute("transform"))[1]
      ) * pxPerMm()
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

    // ---------- Kacheln „Trefferbild in Zahlen“ gegen den Fachkern
    check("Prüfhaken des Labors da", !!L() && L().shots.length === 49)
    check(
      "Kacheln: zehn in der Reihenfolge der Spielwiese",
      tileKeys().join() === L().tools.TILE_KEYS.join(),
      tileKeys().join(" ")
    )
    check(
      "Kacheln rechnen wie der Fachkern (alle Wertungsschüsse)",
      tilesMatch().length === 0,
      tilesMatch().join(" ")
    )
    check(
      "Kacheln: Kurzsatz aus helpForMetric als Titel",
      $$("[data-metric]").every((t) => t.title === L().tools.helpForMetric(t.dataset.metric).short)
    )

    const tileRows = (root) => {
      const rows = new Map()
      for (const t of $$("[data-metric]", root)) {
        const top = Math.round(t.getBoundingClientRect().top)
        rows.set(top, (rows.get(top) ?? 0) + 1)
      }
      return [...rows.values()]
    }
    check(
      "Kacheln: volle Zeilen, keine Lücke (Desktop 5 je Zeile)",
      tileRows(document).every((n) => n === 5),
      tileRows(document).join("+")
    )

    // ---------- Schusstabelle
    const labelsAll = L().tools.shotLabels(L().shots)
    const intervalsAll = L().tools.shotIntervals(L().shots)
    check(
      "Tabelle: 49 Zeilen, neuester oben, P1 unten",
      tableRows().length === 49 &&
        tableRows()[0].dataset.row === "40" &&
        tableRows().at(-1).dataset.row === "P1"
    )
    const wrongIntervals = tableRows().filter(
      (tr) =>
        txt(tr.lastElementChild).trim() !==
        intervalText(intervalsAll[labelsAll.indexOf(tr.dataset.row)])
    )
    check(
      "Tabelle: Intervalle wie shotIntervals, Pause in Minuten",
      wrongIntervals.length === 0 &&
        tableRows().some((tr) => txt(tr.lastElementChild).includes("min")),
      wrongIntervals.map((tr) => tr.dataset.row).join(" ")
    )
    check(
      "Tabelle: jede Zeile mit echtem Knopf (Tab und Enter), mit Namen",
      tableRows().every((tr) => {
        const b = $("button", tr)
        return (
          b &&
          b.type === "button" &&
          b.tabIndex === 0 &&
          /wählen$/.test(b.getAttribute("aria-label"))
        )
      })
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
    // Ein Tipp wählt den nächsten Treffer der Auswahl, bis 20 px neben seiner Mitte: Auf dem Handy misst ein
    // Treffer auf der ganzen Scheibe nur wenige Pixel. Chrome kürzt synthetische Koordinaten auf ganze Pixel.
    await tapAt(centerOf("P1"))
    check(
      "Tipp auf die Mitte eines hohlen Probeschusses wählt ihn",
      txt($("#readout")).includes("Probe P1 · angetippt"),
      txt($("#readout")).slice(0, 40)
    )
    await tapAt(centerOf("P1"))
    const nextToP1 = beside("P1", 14)
    if (nextToP1) await tapAt(nextToP1)
    check(
      "Tipp 14 px neben einen Treffer wählt ihn",
      !!nextToP1 && txt($("#readout")).includes("Probe P1 · angetippt"),
      nextToP1 ? txt($("#readout")).slice(0, 40) : "keine freie Stelle neben P1"
    )
    if (nextToP1) await tapAt(nextToP1)
    const [vx, vy] = view()
    const far = toScreen(vx + 2, vy + 2)
    await tapAt([far.x, far.y])
    check(
      "Tipp weit weg von jedem Treffer wählt nichts",
      ranked([far.x, far.y])[0].d > 30 &&
        !$("[data-chosen]", svg()) &&
        txt($("#readout")).includes("letzter Schuss"),
      `${ranked([far.x, far.y])[0].d.toFixed(0)} px zum nächsten`
    )
    await tapAt(centerOf("14"))
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
    await tapAt(centerOf("14"))
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
    // ein blasser Schuss, neben dem kein Schuss der Auswahl liegt: ein Tipp darauf wählt nichts
    const lonelyFaded = hits()
      .filter((g) => g.dataset.faded)
      .map((g) => g.dataset.shot)
      .find((label) => ranked(centerOf(label))[0].d > 30)
    if (lonelyFaded) await tapAt(centerOf(lonelyFaded))
    check(
      "Tipp auf einen blassen Schuss wählt nichts",
      !!lonelyFaded && !$("[data-chosen]", svg()),
      lonelyFaded ?? "kein blasser Schuss abseits der Auswahl"
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
    check(
      "Kacheln folgen der Auswahl (Serie 2)",
      tilesMatch().length === 0 &&
        txt($('section[aria-label="Trefferbild in Zahlen"]')).includes("Serie 2") &&
        L().tools.selectionShots(L().shots, 2).length === 10,
      tilesMatch().join(" ")
    )
    check(
      "Tabelle folgt der Auswahl: nur Serie 2, neuester oben",
      tableRows()
        .map((tr) => tr.dataset.row)
        .join() === "20,19,18,17,16,15,14,13,12,11"
    )
    await click(button("Gruppe"), 700)
    const [gx, gy, gw] = view()
    check(
      "Gruppe: Ausschnitt auf Serie 2, alle ihre Treffer darin",
      gw < 100 && centers.every(([x, y]) => x > gx && x < gx + gw && y > gy && y < gy + gw),
      `${gw.toFixed(2)} mm`
    )
    const numberPxGroup =
      Number($("text[data-number]", svg()).getAttribute("font-size")) * pxPerMm()
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
      hits().every((g) => !g.dataset.faded) &&
        button("Alle").getAttribute("aria-pressed") === "true"
    )
    await click(tile("4"))
    await click(button("Alle"), 700)
    check(
      "„Alle“ setzt zurück",
      hits().every((g) => !g.dataset.faded) &&
        button("Alle").getAttribute("aria-pressed") === "true"
    )
    await click(button("Scheibe"), 700)

    // ---------- Tabelle wählt den Schuss wie das Antippen
    const row14 = () => tableRows().find((tr) => tr.dataset.row === "14")
    await click(row14().children[2])
    check(
      "Tabelle: Klick in eine Zeile wählt den Schuss",
      txt($("#readout")).includes("Schuss 14 · angetippt") &&
        hits().at(-1).dataset.shot === "14" &&
        $("button", row14()).getAttribute("aria-pressed") === "true"
    )
    $("button", row14()).click()
    await wait(60)
    check(
      "Tabelle: der Knopf der Zeile nimmt die Wahl zurück, ohne doppelt zu zählen",
      !$("[data-chosen]", svg()) && $("button", row14()).getAttribute("aria-pressed") === "false"
    )

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
    check(
      "Ganze Ringe: Kacheln, Übersicht und Tabelle in Ringen",
      L().state.scoring === "rings" &&
        tilesMatch().length === 0 &&
        txt($('[data-metric="result.decimalMean"]')).includes("in ganzen Ringen") &&
        /Ergebnis\s*\d+(?!,)/.test(txt($("#summary"))) &&
        txt($("#shot-table th:nth-child(2)")) === "Ring",
      tilesMatch().join(" ")
    )
    check("amtliche Wertung bleibt als Hinweis", txt($("#summary")).includes("amtlich: Zehntel"))
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
    // gezoomt ist ein Treffer größer als 20 px: Ein Tipp in ihn hinein zählt bis an seinen Rand
    await click(button("Gruppe"), 700)
    const calPx = Number(circleOf(hits()[0]).getAttribute("r")) * pxPerMm()
    const inside = calPx > 30 ? beside("5", calPx * 0.8) : null
    if (inside) await tapAt(inside)
    check(
      "gezoomt: ein Tipp innen am Rand eines großen Treffers wählt ihn",
      !!inside && txt($("#readout")).includes("Schuss 5 · angetippt"),
      `Treffer ${calPx.toFixed(0)} px, ${inside ? txt($("#readout")).slice(0, 30) : "keine freie Stelle"}`
    )
    if (inside) await tapAt(inside)
    await click(button("Scheibe"), 700)
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

    // ---------- Visier verstellt
    const sightGroup = () => $('#series [role="group"]')
    const sightButtons = () => $$("button", sightGroup())
    const dashed = () =>
      labelsOf(
        hits().filter(
          (g) => g.dataset.shot.startsWith("P") && circleOf(g).getAttribute("stroke-dasharray")
        )
      ).join()
    check(
      "Visier: Schalter P1 bis P8, nach P4 gedrückt",
      sightButtons()
        .map((b) => txt(b))
        .join() === "P1,P2,P3,P4,P5,P6,P7,P8" &&
        sightButtons()
          .filter((b) => b.getAttribute("aria-pressed") === "true")
          .map((b) => txt(b))
          .join() === "P4"
    )
    await click(button("P4", sightGroup()))
    await click(button("P2", sightGroup()))
    const stripDashed = $$('[data-series="probe"] circle[stroke-dasharray]').length
    check(
      "Visier nach P2: P1 und P2 gestrichelt, auf der Scheibe und in den Serien",
      dashed() === "P1,P2" &&
        stripDashed === 2 &&
        txt($('[data-series="probe"]')).includes("7 nach der Verstellung"),
      `${dashed()} / ${stripDashed}`
    )
    await click(button("P2", sightGroup()))
    await click(button("P4", sightGroup()))

    // ---------- Hilfe
    const targetHelp = () => $('details[data-help="trefferbild"]')
    check(
      "Erklärungen aus: Trefferbild-Hilfe zu, keine Kurzsätze an den Kacheln",
      !!targetHelp() && !targetHelp().open && $$("[data-short]").length === 0
    )
    await click(button("Erklärungen"))
    check(
      "Erklärungen an: alles offen, Kurzsätze sichtbar an jeder Kachel",
      targetHelp().open &&
        $$("[data-short]").length === 10 &&
        $$("[data-metric]").every(
          (t) => txt($("[data-short]", t)) === L().tools.helpForMetric(t.dataset.metric).short
        )
    )
    await click(button("Erklärungen"))
    check("Erklärungen wieder aus", !targetHelp().open && $$("[data-short]").length === 0)

    const sigmaHelp = () => $('[data-metric="group.sigma"] button[aria-label^="Erklärung"]')
    const sheet = () => $("dialog")
    const sigmaTopic = L().tools.helpForMetric("group.sigma")
    sigmaHelp().focus()
    await click(sigmaHelp(), 100)
    check(
      "„?“ öffnet das Blatt mit der Erklärung der Kennzahl",
      sheet().open &&
        txt($("h2", sheet())) === sigmaTopic.title &&
        txt(sheet()).includes(sigmaTopic.what) &&
        document.activeElement !== sigmaHelp(),
      txt($("h2", sheet()))
    )
    const rect = sheet().getBoundingClientRect()
    check(
      "Desktop: Blatt als Karte am rechten Rand",
      near(rect.right, innerWidth - 16, 2) && near(rect.width, 416, 2),
      `${rect.left.toFixed(0)}–${rect.right.toFixed(0)} von ${innerWidth}`
    )
    await click($('button[aria-label="Schließen"]', sheet()), 100)
    check(
      "Schließen: Blatt zu, Fokus zurück auf dem „?“",
      !sheet().open && document.activeElement === sigmaHelp()
    )
    await click(sigmaHelp(), 100)
    if (typeof sheet().requestClose === "function") {
      // derselbe Weg wie Escape: cancel, dann close
      sheet().requestClose()
      await wait(100)
      check("Escape-Weg (requestClose) schließt das Blatt", !sheet().open)
    } else {
      sheet().close()
      await wait(100)
      check("Escape-Weg: requestClose fehlt in diesem Chrome, close() schließt", !sheet().open)
    }
    await click(sigmaHelp(), 100)
    check("nach dem Schließen öffnet das „?“ wieder", sheet().open)
    $("h2", sheet()).dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await wait(100)
    check("ein Tipp in das Blatt hinein lässt es offen", sheet().open)
    sheet().dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await wait(100)
    check("Tipp neben das Blatt schließt es", !sheet().open)

    // ---------- Handy: 390 px ohne seitliches Scrollen
    const frame = document.createElement("iframe")
    frame.style.cssText = "width:390px;height:900px;border:0;position:absolute;left:-9999px"
    frame.src = location.href.split("#")[0]
    document.body.appendChild(frame)
    await new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }))
    await wait(500)
    const doc = frame.contentDocument
    check(
      "Handy: Kacheln in vollen Zeilen zu zwei",
      !!doc && tileRows(doc).length === 5 && tileRows(doc).every((n) => n === 2),
      doc ? tileRows(doc).join("+") : "kein Zugriff"
    )
    // die breitesten Ausreißer benennen, damit ein Fehlschlag sagt, wo es klemmt
    const wide = doc
      ? [...doc.body.querySelectorAll("*")]
          .filter((el) => !(el instanceof frame.contentWindow.SVGElement))
          .filter((el) => el.getBoundingClientRect().right > 391)
          .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)
          .slice(0, 3)
          .map(
            (el) =>
              `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")} ${el.getBoundingClientRect().right.toFixed(0)}`
          )
      : []
    check(
      "Handy 390 px: kein seitliches Scrollen",
      !!doc && doc.documentElement.scrollWidth <= 390,
      doc ? `${doc.documentElement.scrollWidth} ${wide.join(" | ")}` : "kein Zugriff"
    )
    const phoneHelp = doc?.querySelector(
      '[data-metric="group.r50"] button[aria-label^="Erklärung"]'
    )
    phoneHelp?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await wait(150)
    const phoneSheet = doc?.querySelector("dialog")
    const phoneRect = phoneSheet?.getBoundingClientRect()
    check(
      "Handy: Blatt von unten über die volle Breite",
      !!phoneSheet?.open &&
        near(phoneRect.bottom, doc.documentElement.clientHeight, 1) &&
        near(phoneRect.width, doc.documentElement.clientWidth, 1) &&
        doc.documentElement.scrollWidth <= 390,
      phoneRect
        ? `${phoneRect.top.toFixed(0)}–${phoneRect.bottom.toFixed(0)}, ${phoneRect.width.toFixed(0)} px`
        : "kein Blatt"
    )
    frame.remove()

    check("Keine Skriptfehler", window.__errors.length === 0, window.__errors.join(" | "))
  } catch (error) {
    log.push(`FAIL Skriptprüfung abgebrochen — ${error?.stack ?? error}`)
  }

  const pre = document.createElement("pre")
  pre.id = "dbg"
  pre.textContent = log.join("\n")
  document.body.appendChild(pre)
})
