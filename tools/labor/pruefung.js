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
    // nach Text oder, bei Knöpfen nur mit Symbol (Ecken der Scheibe), nach Namen
    const button = (label, root = document) =>
      $$("button", root).find(
        (b) => txt(b).trim() === label || b.getAttribute("aria-label") === label
      )
    const zoom = () => button("Auf Gruppe zoomen")
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
      "Probe durchgezogen, nie gestrichelt",
      probes.every((g) => !circleOf(g).getAttribute("stroke-dasharray"))
    )
    const matchCircle = circleOf(hits().find((g) => g.dataset.shot === "1"))
    check(
      "Wertung gefüllt, Deckkraft 0,9, Haarlinie",
      matchCircle.getAttribute("fill-opacity") === "0.9" &&
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
    const head = () => txt($("[data-card-header]"))
    check(
      "Kopf: Ergebnis 365,2, 40 Schuss + 9 Probe und 9 Zehner wie in der Spielwiese",
      txt($("[data-result]")).includes("365,2") &&
        head().includes("40 Schuss + 9 Probe") &&
        /Zehner\s*9/.test(head()),
      head().slice(0, 160)
    )
    check(
      "Ablesung: Teiler und Abstand, kein x/y",
      /Teiler\s*\d/.test(txt($("#readout"))) &&
        txt($("#readout")).includes("Abstand zur Mitte") &&
        !txt($("#readout")).includes("x / y")
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

    // ---------- Grundauswahl: Probe und Wertung, also ohne Probe
    check(
      "Grundauswahl ohne Probe: „Ohne Probe“ gedrückt, Probe blass, Wertung kräftig",
      L().state.selection === "match" &&
        button("Ohne Probe")?.getAttribute("aria-pressed") === "true" &&
        button("Alle").getAttribute("aria-pressed") === "false" &&
        hits().every((g) => !!g.dataset.faded === g.dataset.shot.startsWith("P"))
    )

    // ---------- Schusstabelle
    const labelsAll = L().tools.shotLabels(L().shots)
    const intervalsAll = L().tools.shotIntervals(L().shots)
    check(
      "Tabelle ohne Probe: 40 Zeilen, neuester oben, Schuss 1 unten",
      tableRows().length === 40 &&
        tableRows()[0].dataset.row === "40" &&
        tableRows().at(-1).dataset.row === "1"
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
    const groupTitles = () => $$('#shot-table th[scope="rowgroup"]').map((th) => txt(th).trim())
    check(
      "Tabelle: Trenner je Serie, neueste zuerst",
      groupTitles().join() === "Serie 4,Serie 3,Serie 2,Serie 1",
      groupTitles().join(" | ")
    )
    await click(button("Alle"))
    check(
      "Alle mit Probe: 49 Zeilen bis P1, Probe als eigene Gruppe, Kacheln mit Probe",
      tableRows().length === 49 &&
        tableRows().at(-1).dataset.row === "P1" &&
        groupTitles().at(-1) === "Probe" &&
        L().state.selection === "all" &&
        tilesMatch().length === 0 &&
        hits().every((g) => !g.dataset.faded),
      `${tableRows().length} Zeilen, ${groupTitles().join(" | ")}`
    )
    await click(button("Ohne Probe"))
    const dotLefts = new Set(
      tableRows().map((tr) =>
        Math.round($("td:nth-child(2) span[aria-hidden]", tr).getBoundingClientRect().left)
      )
    )
    check(
      "Tabelle: Farbpunkte stehen untereinander (9,x wie 10,x)",
      dotLefts.size === 1,
      [...dotLefts].join(" ")
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
    const numbered = hits().filter((g) => !g.dataset.faded)
    check(
      "Nummern an: blasse ohne Nummer",
      hits()
        .filter((g) => g.dataset.faded)
        .every((g) => !$("text[data-number]", g))
    )
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

    // ---------- Antippen (mit Probe, damit auch Probeschüsse wählbar sind)
    await click(button("Alle"))
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

    await click(button("Ohne Probe"))

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
      "nur Serie 2 in Ringwert-Farbe, alle anderen blass und grau",
      labelsOf(series2).join() === "11,12,13,14,15,16,17,18,19,20" &&
        hits()
          .filter((g) => g.dataset.faded)
          .every(
            (g) =>
              g.getAttribute("opacity") === "0.55" &&
              [circleOf(g).getAttribute("fill"), circleOf(g).getAttribute("stroke")].includes(
                "var(--shot-faded)"
              )
          )
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
      "Tabelle folgt der Auswahl: nur Serie 2, neuester oben, ohne Trenner",
      tableRows()
        .map((tr) => tr.dataset.row)
        .join() === "20,19,18,17,16,15,14,13,12,11" && groupTitles().length === 0
    )
    await click(zoom(), 700)
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
    await click(button("Übrige Schüsse blass zeigen"))
    check(
      "„Übrige aus“: nur die Auswahl gezeichnet",
      labelsOf(hits()).join() === "11,12,13,14,15,16,17,18,19,20"
    )
    await click(button("Übrige Schüsse blass zeigen"))
    // eine Serie oder alle: eine andere Serie wechselt, keine Mehrfachauswahl
    await click(tile("3"))
    check(
      "Serie 3 statt Serie 2, nur eine Kachel gedrückt",
      labelsOf(hits().filter((g) => !g.dataset.faded)).join() === "21,22,23,24,25,26,27,28,29,30" &&
        $$("[data-series][aria-pressed='true']").length === 1
    )
    await click(tile("3"), 700)
    check(
      "dieselbe Serie noch einmal führt zur Grundauswahl zurück (ohne Probe)",
      hits().every((g) => !!g.dataset.faded === g.dataset.shot.startsWith("P")) &&
        button("Ohne Probe").getAttribute("aria-pressed") === "true"
    )
    await click(tile("4"))
    await click(button("Alle"), 700)
    check(
      "„Alle“ setzt zurück",
      hits().every((g) => !g.dataset.faded) &&
        button("Alle").getAttribute("aria-pressed") === "true"
    )
    await click(zoom(), 700)

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
    // Probescheibe: das schwarze Eck oben rechts, wie es Konvention ist
    check(
      "Probe-Eck: die kleine Scheibe der Probe hat es, die Serien nicht",
      !!$('[data-series="probe"] [data-probe-corner]') &&
        tiles.slice(1).every((t) => !$("[data-probe-corner]", t))
    )
    check(
      "Probe-Eck: Probe und Wertung zusammen auf der Scheibe ohne",
      !$("[data-probe-corner]", svg())
    )
    await click(tile("probe"))
    const corner = $("[data-probe-corner]", svg())
    const cornerBox = corner?.getBoundingClientRect()
    const svgBox = svg().getBoundingClientRect()
    check(
      "Probe-Eck: Probe gewählt, Eck oben rechts auf der Scheibe",
      !!corner &&
        near(cornerBox.right, svgBox.right, 1) &&
        near(cornerBox.top, svgBox.top, 1) &&
        corner.getAttribute("fill") === "var(--spiegel)",
      corner ? `${cornerBox.right.toFixed(0)}/${svgBox.right.toFixed(0)}` : "kein Eck"
    )
    await click(button("Alle"))
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
      "Serien: Probe mit Zahl der Schüsse, ohne Verstellung",
      txt(tile("probe")).includes("9 Schuss") && !txt(tile("probe")).includes("Verstellung")
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
      "Leer: keine Treffer, statt leerer Kästen nur der Hinweis neben der Scheibe",
      hits().length === 0 &&
        $$("[data-series]").length === 0 &&
        txt($("[data-no-shots]")).includes("Noch kein Schuss") &&
        ["readout", "series", "shot-table", "zahlen", "analyse"].every((id) => !$(`#${id}`)) &&
        !$('nav[aria-label="Abschnitte"]') &&
        !$("[data-result]")
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

    // ---------- nur Probe (Training): wie Wertung, bis eine Wertung dazukommt
    await click(button("60 Probe"), 100)
    check(
      "Nur Probe: Schüsse 1 bis 60, gefüllt wie Wertung, mit Probe-Eck auf Scheibe und Serien",
      labelsOf(hits()).join() === Array.from({ length: 60 }, (_, i) => `${i + 1}`).join() &&
        hits().every((g) => circleOf(g).getAttribute("fill") !== "none") &&
        !!$("[data-probe-corner]", svg()) &&
        $$("[data-series]").every((t) => !!$("[data-probe-corner]", t))
    )
    check(
      "Nur Probe: sechs Serien zu zehn ohne Probe-Kachel, Kopf mit Ergebnis",
      $$("[data-series]")
        .map((t) => t.dataset.series)
        .join() === "1,2,3,4,5,6" &&
        /60 Schuss(?! \+)/.test(head()) &&
        /^\d+,\d/.test(txt($("[data-result]")).trim()),
      head().slice(0, 160)
    )
    check(
      "Nur Probe: Tabelle mit Trennern je Serie und der Pause",
      groupTitles().join() === "Serie 6,Serie 5,Serie 4,Serie 3,Serie 2,Serie 1" &&
        tableRows().some((tr) => txt(tr.lastElementChild).includes("min")),
      groupTitles().join(" | ")
    )
    // eine Wertung dazu: Ab jetzt trennt Spiegel Probe und Wertung
    await click(button("Setzen"))
    await click(button("Wertung"))
    await setAt(0, 0)
    check(
      "Nur Probe plus eine Wertung: Probe P1 bis P60, Wertung 1",
      hits().filter((g) => g.dataset.shot.startsWith("P")).length === 60 &&
        !!hits().find((g) => g.dataset.shot === "1") &&
        $$("[data-series]")
          .map((t) => t.dataset.series)
          .join() === "probe,1",
      $$("[data-series]")
        .map((t) => t.dataset.series)
        .join()
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
      "Ganze Ringe: Kacheln, Kopf und Tabelle in Ringen",
      L().state.scoring === "rings" &&
        tilesMatch().length === 0 &&
        txt($('[data-metric="result.decimalMean"]')).includes("in ganzen Ringen") &&
        /^\d+(?![\d,])/.test(txt($("[data-result]")).trim()) &&
        txt($("#shot-table th:nth-child(2)")) === "Ring",
      tilesMatch().join(" ")
    )
    check(
      "amtliche Wertung bleibt als Hinweis (im Kopf der Scheibe)",
      txt($("[data-result]").closest("[data-card-header]")).includes("amtlich: Zehntel")
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
    // gezoomt ist ein Treffer größer als 20 px: Ein Tipp in ihn hinein zählt bis an seinen Rand
    await click(zoom(), 700)
    const calPx = Number(circleOf(hits()[0]).getAttribute("r")) * pxPerMm()
    const inside = calPx > 30 ? beside("5", calPx * 0.8) : null
    if (inside) await tapAt(inside)
    check(
      "gezoomt: ein Tipp innen am Rand eines großen Treffers wählt ihn",
      !!inside && txt($("#readout")).includes("Schuss 5 · angetippt"),
      `Treffer ${calPx.toFixed(0)} px, ${inside ? txt($("#readout")).slice(0, 30) : "keine freie Stelle"}`
    )
    if (inside) await tapAt(inside)
    await click(zoom(), 700)
    await click(button("Luftpistole"), 60)
    // eine andere Karte derselben Scheibe steht ebenso sofort: aus der Gruppe direkt auf die ganze Scheibe
    await click(zoom(), 700)
    const [, , wGroup] = view()
    await click(button("Ausdruck vom 2. Oktober"), 60)
    const [, , wNext] = view()
    check(
      "andere Karte derselben Scheibe: sofort im neuen Ausschnitt",
      wGroup < 171 && near(wNext, 171.05, 1e-6),
      `${wGroup.toFixed(2)} → ${wNext}`
    )
    await click(button("40 Schuss mit Probe"), 60)
    // die Seite selbst folgt dem Thema, auch unter der Grundformatierung des Artifacts
    const tokenColor = (name) => {
      const probe = document.createElement("div")
      probe.style.background = `var(--${name})`
      document.body.appendChild(probe)
      const color = getComputedStyle(probe).backgroundColor
      probe.remove()
      return color
    }
    const page = () => getComputedStyle(document.body)
    await click(button("Dunkel"))
    check(
      "Thema dunkel: Seite dunkel, Schrift aus dem Design",
      document.documentElement.classList.contains("dark") &&
        page().backgroundColor === tokenColor("background") &&
        page().backgroundColor !== "rgb(247, 247, 245)" &&
        page().fontFamily.includes("Geist"),
      `${page().backgroundColor} / ${tokenColor("background")}, ${page().fontFamily.slice(0, 20)}`
    )
    await click(button("Hell"))
    check(
      "Thema hell: Seite hell aus dem Design",
      !document.documentElement.classList.contains("dark") &&
        page().backgroundColor === tokenColor("background"),
      `${page().backgroundColor} / ${tokenColor("background")}`
    )
    await click(button("System"))

    // ---------- Hilfe
    // Plan Schritt 4, D3: Erklärungen als Blatt über „?“, der Schalter zeigt nur Kurzsätze
    check(
      "Erklärungen aus: keine Kurzsätze, kein „Was heißt das?“ mehr auf der Seite",
      $$("[data-short]").length === 0 && $$("details[data-help]").length === 0
    )
    await click(button("Erklärungen"))
    check(
      "Erklärungen an: Kurzsätze sichtbar an jeder Kachel",
      $$("[data-metric] [data-short]").length === 10 &&
        $$("[data-metric]").every(
          (t) => txt($("[data-short]", t)) === L().tools.helpForMetric(t.dataset.metric).short
        )
    )
    await click(button("Erklärungen"))
    check("Erklärungen wieder aus", $$("[data-short]").length === 0)
    const targetHelpButton = $('#scheibe button[data-help="trefferbild"]')
    await click(targetHelpButton, 100)
    check(
      "„?“ an der Scheibe öffnet die Erklärung „Trefferbild“ als Blatt",
      !!$("dialog")?.open && txt($("dialog h2")).startsWith("Trefferbild"),
      txt($("dialog h2"))
    )
    await click($('button[aria-label="Schließen"]', $("dialog")), 100)

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
      near(rect.right, document.documentElement.clientWidth - 16, 2) && near(rect.width, 416, 2),
      `${rect.left.toFixed(0)}–${rect.right.toFixed(0)} von ${document.documentElement.clientWidth}`
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

    // ---------- Analyse (Schritt 3): jede Zahl gegen den Fachkern, Hilfe, Abstände
    // Text der Seite ohne Skripte und Styles (die Prüfung steht selbst als Skript in der Seite)
    const pageText = () => {
      const copy = document.body.cloneNode(true)
      for (const el of copy.querySelectorAll("script, style")) el.remove()
      return copy.textContent
    }
    const TABS = ["Überblick", "Ergebnis", "Präzision", "Lage", "Zeit und Verlauf", "Probe"]
    await click(button("Luftpistole"), 150)
    await click(button("40 Schuss mit Probe"), 150)
    await click(button("Zehntel"), 100)
    const A = () => $('section[aria-label="Analyse"]')
    const tabBar = () => $('[role="radiogroup"][aria-label="Thema"]', A())
    const tab = (label) => click(button(label, tabBar()), 120)
    const card = (id) => $(`[data-card="${id}"]`, A())
    const ctext = (id) => txt(card(id)).replace(/\s+/g, " ")
    const T = () => L().tools
    const S = () => T().analysis
    const input = () => T().analysisInput(L().shots, L().state.scoring, L().target)
    // unabhängig von analysisInput (D1): die Wertung, ohne Wertung die Probe
    const base = () => {
      const match = L().shots.filter((s) => s.kind === "match")
      return match.length ? match : L().shots
    }
    const nf = (v, d) => T().formatValue(v, d)
    const ovTile = (label) => $(`[data-tile="${label}"]`, A())
    const ovValue = (label) => txt(ovTile(label).children[1].childNodes[0])
    const ovHint = (label) => txt(ovTile(label).children[2])
    check(
      "Analyse: sechs Reiter in der Reihenfolge der Spielwiese",
      $$('[role="radio"]', tabBar())
        .map((b) => txt(b))
        .join() === TABS.join()
    )

    await tab("Überblick")
    const ovTiles = T().overviewTiles(input())
    const shownTiles = $$("[data-tile]", A())
    check(
      "Überblick: acht Kacheln, Werte und Angaben wie im Fachkern",
      shownTiles.length === 8 &&
        ovTiles.every((t) => ovValue(t.label) === (t.value ?? "–") && ovHint(t.label) === t.hint),
      ovTiles
        .filter((t) => ovValue(t.label) !== (t.value ?? "–"))
        .map((t) => t.label)
        .join(", ")
    )
    const resultTotal = T().computeMetric(
      T().inScoring(T().metricByKey("result.decimal"), "decimal"),
      base()
    )
    check(
      "Überblick: Ergebnis und σ direkt aus dem Fachkern",
      ovValue("Ergebnis") === nf(resultTotal, 1) &&
        ovValue("Präzision σ") === nf(S().sigmaEstimate(base()).sigma / 1000, 2),
      `${ovValue("Ergebnis")} · ${ovValue("Präzision σ")}`
    )
    const sentences = $$("[data-observation]", A()).map((li) => txt(li).trim())
    const model = T().observations(input())
    check(
      "Beobachtungen: mindestens fünf Sätze, gleich dem Modell",
      sentences.length >= 5 && model.every((o, i) => sentences[i] === o.text),
      `${sentences.length} Sätze`
    )
    const conf = S().mpiConfidence(base())
    check(
      "Beobachtungen: Lage-Satz passt zu Hotelling",
      (conf.real ? /^Die Lage ist echt/ : /vom Zufall nicht zu unterscheiden/).test(sentences[0]),
      sentences[0]
    )
    check(
      "Beobachtungen: Pause vor Schuss 21 erkannt",
      sentences.some((s) => s.includes("Pause vor Schuss 21"))
    )
    check(
      "Datenlage-Zeile",
      txt($("[data-coverage] p", A())).startsWith(
        "Datenlage: 40 Wertung · 9 Probe · alle mit Lage, Zeit und Wert"
      ),
      txt($("[data-coverage] p", A()))
    )

    await tab("Ergebnis")
    const dist = S().ringDistribution(base())
    const ringRows = $$("[data-ring-row]", A())
    check(
      "Ergebnis: Ringbalken je Ring, die Zehn zuerst",
      ringRows.length >= 3 &&
        ringRows[0].dataset.ringRow === "10" &&
        txt(ringRows[0].children[2]) ===
          `${dist.counts[10]}· ${nf((dist.counts[10] / dist.n) * 100, 0)} %`
    )
    const hist = S().decimalHistogram(base())
    check(
      "Ergebnis: Zehntel-Säulen = belegte Zehntel",
      $$("[data-tenth]", A()).length === hist.counts.filter(Boolean).length
    )
    const histSvg = $("[data-tenth]", A()).closest("svg")
    check(
      "Ergebnis: Diagramm in Pixelbreite",
      Number(histSvg.getAttribute("width")) ===
        Math.round(histSvg.parentElement.getBoundingClientRect().width),
      `${histSvg.getAttribute("width")} / ${histSvg.parentElement.getBoundingClientRect().width}`
    )
    check("Ergebnis: Serienkurve mit vier Serien", $$("[data-series-point]", A()).length === 4)
    check(
      "Ergebnis: zwei Quoten mit 95-%-Bereich",
      $$("[data-share]", A()).length === 2 && $$("[data-share] [data-range]", A()).length === 2
    )

    await click(button("Ganze Ringe"), 120)
    check(
      "Ringe: Zehntelverteilung nur als Hinweis",
      $$("[data-tenth]", A()).length === 0 &&
        ctext("zehntelverteilung").includes("Gibt es nur in der Zehntelwertung")
    )
    await tab("Überblick")
    const ringsTotal = T().computeMetric(
      T().inScoring(T().metricByKey("result.decimal"), "rings"),
      base()
    )
    check(
      "Ringe: Ergebnis ganzzahlig",
      ovValue("Ergebnis") === nf(ringsTotal, 0),
      ovValue("Ergebnis")
    )
    check(
      "Ringe: Datenlage nennt die Wertung",
      txt($("[data-coverage] p", A())).includes("in ganzen Ringen")
    )
    await click(button("Zehntel"), 120)

    await tab("Präzision")
    const sigma = S().sigmaEstimate(base())
    check("Präzision: σ groß", ctext("praezision-sigma").includes(`${nf(sigma.sigma / 1000, 2)}mm`))
    const r50 = T().computeMetric(T().inScoring(T().metricByKey("group.r50"), "decimal"), base())
    check(
      "Präzision: R50 in Ringbreiten",
      ctext("masse-der-gruppe").includes(
        `R50 in Ringbreiten${nf(S().ringWidths(r50 * 1000, L().target), 2)}`
      ),
      ctext("masse-der-gruppe")
    )
    const outlierLoss = S().outlierLoss(base(), "decimal")
    check(
      "Präzision: Kosten der Ausreißer",
      !outlierLoss ||
        outlierLoss.count === 0 ||
        ctext("ausreisser").includes(`Kosten${nf(outlierLoss.loss, 1)} Ringe`),
      outlierLoss ? `${outlierLoss.count} markiert, ${outlierLoss.loss}` : "unbekannt"
    )
    const shapeSvg = $('svg[role="img"]', card("form-der-gruppe"))
    const shapeKids = [...shapeSvg.children]
    const shapeEllipses = $$("ellipse", shapeSvg)
    const groupPoints = $$("[data-group-point]", shapeSvg)
    check(
      "Präzision: Ellipse als Fläche unter und als Linie über den Punkten",
      shapeEllipses.length === 2 &&
        shapeKids.indexOf(shapeEllipses[0]) < shapeKids.indexOf(groupPoints[0]) &&
        shapeKids.indexOf(shapeEllipses[1]) > shapeKids.indexOf(groupPoints.at(-1))
    )
    const flaggedShots = S().outliers(base()).flagged
    const redDots = $$('[data-outlier="true"]', shapeSvg)
    check(
      "Präzision: Abreißer rot und mit Ring",
      flaggedShots.length >= 1 &&
        redDots.length === flaggedShots.length &&
        redDots.every((c) => c.getAttribute("fill") === "var(--destructive)") &&
        $$("[data-outlier-ring]", shapeSvg).length === flaggedShots.length,
      flaggedShots.map((f) => f.number).join(", ")
    )

    // zwei nahe Abreißer: einzeln geprüft verdeckten sie sich, schrittweise fallen beide auf
    await click(button("Luftgewehr"), 200)
    await click(button("Zwei Abreißer"), 200)
    await tab("Präzision")
    const pairFlagged = S()
      .outliers(base())
      .flagged.map((f) => f.number)
    const pairLoss = S().outlierLoss(base(), "decimal")
    check(
      "Zwei Abreißer: beide markiert, Kosten 4,5 Ringe gegen den Median 10,4",
      pairFlagged.join() === "9,10" &&
        pairLoss?.count === 2 &&
        near(pairLoss.loss, 4.5, 1e-9) &&
        ctext("ausreisser").includes("Schuss 9, Schuss 10") &&
        ctext("ausreisser").includes(`Kosten${nf(4.5, 1)} Ringe`),
      `${pairFlagged.join()} · ${pairLoss?.loss}`
    )
    const pairShape = $('svg[role="img"]', card("form-der-gruppe"))
    check(
      "Zwei Abreißer: zwei rote Punkte im Diagramm der Form",
      $$('[data-outlier="true"]', pairShape).length === 2
    )
    const pairForm = S().groupShape(base())
    check(
      "Zwei Abreißer: die Form rechnet ohne sie",
      pairForm.n === 8 &&
        pairForm.without.join() === "9,10" &&
        !pairForm.elongated &&
        ctext("form-der-gruppe").includes("(ohne Ausreißer 9, 10)") &&
        ctext("form-der-gruppe").includes("nicht nachweisbar"),
      `${pairForm.n} · ${pairForm.without.join()} · ${pairForm.elongated}`
    )
    const ellipseAt = ["cx", "cy"].map((a) => Number($("ellipse", pairShape).getAttribute(a)))
    const groupDots = $$("[data-group-point]:not([data-outlier])", pairShape)
    const groupMean = ["cx", "cy"].map(
      (a) => groupDots.reduce((sum, c) => sum + Number(c.getAttribute(a)), 0) / groupDots.length
    )
    check(
      "Zwei Abreißer: die Ellipse sitzt auf der Gruppe",
      groupDots.length === 8 &&
        near(groupMean[0], ellipseAt[0], 0.5) &&
        near(groupMean[1], ellipseAt[1], 0.5),
      `${groupMean.map((v) => v.toFixed(1)).join(", ")} / ${ellipseAt.map((v) => v.toFixed(1)).join(", ")}`
    )
    await tab("Überblick")
    check(
      "Zwei Abreißer: die Beobachtung nennt beide",
      txt(A()).includes("Die Schüsse 9, 10 fallen als Ausreißer aus der Gruppe")
    )
    await click(button("Luftpistole"), 200)
    await click(button("40 Schuss mit Probe"), 200)

    await tab("Lage")
    check(
      "Lage: ein Keil je besetzter Stunde",
      $$("[data-hour]", card("richtungsuhr")).length ===
        S().directionClock(base()).counts.filter(Boolean).length
    )
    await click(button("um den Schwerpunkt", card("richtungsuhr")), 120)
    const aroundMpi = S().directionClock(base(), conf.center)
    check(
      "Lage: Uhr um den Schwerpunkt",
      button("um den Schwerpunkt", card("richtungsuhr")).getAttribute("aria-checked") === "true" &&
        $$("[data-hour]", card("richtungsuhr")).length === aroundMpi.counts.filter(Boolean).length
    )
    const ellipseShown = () => !!$('[data-overlay="ellipse"]', svg())
    const ellipseButton = () =>
      $$("button", card("lage-echt")).find((b) => txt(b).includes("Vertrauensellipse"))
    const ellipseBefore = ellipseShown()
    await click(ellipseButton(), 120)
    check(
      "Lage: Knopf schaltet die Ellipse auf der Scheibe",
      ellipseShown() !== ellipseBefore &&
        ellipseButton().getAttribute("aria-pressed") === String(!ellipseBefore)
    )
    await click(ellipseButton(), 120)
    check("Lage: und schaltet sie zurück", ellipseShown() === ellipseBefore)
    check(
      "Lage: von Neumann",
      ctext("drift-und-wanderung").includes(nf(S().drift(base()).vonNeumann, 2))
    )

    await tab("Zeit und Verlauf")
    check(
      "Zeit: Verlauf mit 40 Punkten und einer Pause",
      $$("[data-course-point]", A()).length === 40 && $$("[data-pause-line]", A()).length === 1
    )
    check(
      "Zeit: Rhythmus mit 39 Abständen, eine Pause",
      $$("[data-interval]", A()).length === 39 &&
        $$('[data-interval][data-pause="true"]', A()).length === 1
    )
    check("Zeit: Serien-Tabelle mit 4 Zeilen", $$("[data-series-row]", A()).length === 4)
    const tired = S().fatigue(base(), "decimal")
    check("Zeit: Ermüdung", ctext("ermuedung").includes(`Ø ${nf(tired.lastMeanRings, 2)}`))

    await tab("Probe")
    check("Probe: Umfang 9", ctext("probe-umfang").includes("9 (1 Block à zehn)"))
    const zeroed = S().sighterZeroed(L().shots)
    check(
      "Probe: „Eingeschossen?“ über die letzten fünf",
      zeroed.n === 5 &&
        ctext("eingeschossen").includes(
          `Versatz Probe → Wertung${nf(zeroed.matchOffsetUm / 1000, 2)} mm`
        )
    )
    check(
      "Probe: auf der Scheibe in Abgabefolge",
      $$("[data-sighter]", A())
        .map((g) => g.dataset.sighter)
        .join() === "P1,P2,P3,P4,P5,P6,P7,P8,P9"
    )
    // Nummern mit echter Schriftbreite: keine überlappt eine andere (1 px Toleranz), alle im Bild
    const sighterLabels = () => {
      const chart = $('svg[aria-label="Probeschüsse um die Mitte"]', A())
      const boxes = $$("[data-sighter-label]", chart).map((t) => t.getBBox())
      const view = chart.viewBox.baseVal
      const hits = []
      boxes.forEach((a, i) =>
        boxes.slice(i + 1).forEach((b, j) => {
          const dx = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
          const dy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
          if (dx > 1 && dy > 1) hits.push(`P${i + 1}/P${i + j + 2}`)
        })
      )
      const inside = boxes.every(
        (b) => b.x >= 0 && b.y >= 0 && b.x + b.width <= view.width && b.y + b.height <= view.height
      )
      return { n: boxes.length, hits, inside }
    }
    for (const gun of ["Luftpistole", "Luftgewehr"]) {
      if (gun === "Luftgewehr") await click(button("Luftgewehr"), 200)
      const probe = sighterLabels()
      check(
        `Probe ${gun}: Nummern ohne Überlappung, alle im Bild`,
        probe.n === 9 && probe.hits.length === 0 && probe.inside,
        `${probe.n} · ${probe.hits.join(" ") || "frei"} · ${probe.inside ? "im Bild" : "ragt hinaus"}`
      )
    }
    await click(button("Luftpistole"), 200)
    await click(button("40 Schuss mit Probe"), 200)
    check("keine Visierverstellung auf der Seite", !/Verstellung|verstellt/.test(pageText()))

    // Abstände: zwischen Blöcken und Karten 16 px, Karten einer Zeile mit gleicher Unterkante
    const BOXES =
      'article, details[data-glossary], details[data-fallacies], [data-coverage], div:has(> [data-tile]), section[aria-label="Analyse"] > div:first-child, section[aria-label="Analyse"] > div:has(> [role="radiogroup"])'
    const gapProblems = () => {
      const boxes = $$(BOXES, A())
        .filter((e) => e.offsetParent !== null)
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
      const name = (b) => b.e.dataset.card ?? b.e.tagName.toLowerCase()
      const out = []
      for (const a of boxes) {
        const below = boxes
          .filter(
            (b) =>
              b !== a &&
              b.r.top >= a.r.bottom - 1 &&
              b.r.left < a.r.right - 1 &&
              b.r.right > a.r.left + 1 &&
              !a.e.contains(b.e) &&
              !b.e.contains(a.e)
          )
          .sort((x, y) => x.r.top - y.r.top)
        if (below.length && !near(below[0].r.top - a.r.bottom, 16, 0.6)) {
          out.push(`${name(a)} → ${name(below[0])}: ${(below[0].r.top - a.r.bottom).toFixed(1)}`)
        }
        const beside = boxes.filter(
          (b) => b.e.tagName === "ARTICLE" && b.r.left >= a.r.right - 1 && near(b.r.top, a.r.top, 1)
        )
        for (const b of a.e.tagName === "ARTICLE" ? beside : []) {
          if (!near(b.r.left - a.r.right, 16, 0.6) || !near(b.r.bottom, a.r.bottom, 0.6)) {
            out.push(`${name(a)} ↔ ${name(b)}`)
          }
        }
      }
      return out
    }
    const gapReport = []
    for (const label of TABS) {
      await tab(label)
      // oben auf der Seite klebt noch nichts über den Karten
      scrollTo(0, 0)
      await wait(30)
      const bad = gapProblems()
      if (bad.length) gapReport.push(`${label}: ${bad.join("; ")}`)
    }
    check(
      // auf der Seite einspaltig: der Kartenbereich neben der Scheibe ist schmaler als 820 px
      "Abstände: überall 16 px zwischen Blöcken und Karten",
      gapReport.length === 0,
      gapReport.join(" | ")
    )

    // Hilfe in der Analyse (Plan Schritt 4, D3): jede Karte ein „?“, das ihre Erklärung als Blatt öffnet
    const seenHelp = new Set()
    const withoutHelp = []
    const headProblems = []
    const sheetProblems = []
    for (const label of TABS) {
      await tab(label)
      for (const art of $$("article", A())) {
        const heading = txt($("h3", art))
        if (!$("button[data-help]", art)) {
          if (!heading.startsWith("So liest du")) withoutHelp.push(`${label}: ${heading}`)
          continue
        }
        const id = $("button[data-help]", art).dataset.help
        const topic = T().helpTopic(id)
        if (topic && ($("h3", art).title !== topic.short || !heading.startsWith(topic.title))) {
          headProblems.push(id)
        }
      }
      for (const b of $$("button[data-help]", A())) seenHelp.add(b.dataset.help)
      // je Reiter das Blatt der ersten Karte: Titel und „Was“ aus dem Paket
      const first = $("article button[data-help]", A())
      const id = first.dataset.help
      const entry = T().helpTopic(id) ?? T().VIEW_HELP.find((v) => v.id === id)
      await click(first, 100)
      if (
        !$("dialog").open ||
        txt($("dialog h2")) !== entry.title ||
        !txt($("dialog")).includes(entry.what)
      ) {
        sheetProblems.push(`${label}: ${id}`)
      }
      await click($('button[aria-label="Schließen"]', $("dialog")), 100)
    }
    check("Hilfe: jede Karte hat ihr „?“", withoutHelp.length === 0, withoutHelp.join(", "))
    const wantedHelp = [
      ...T().HELP_TOPICS.map((t) => t.id),
      "beobachtungen",
      "probe-auf-der-scheibe",
    ]
    check(
      "Hilfe: jedes Thema hat seinen Platz",
      wantedHelp.every((id) => seenHelp.has(id)),
      wantedHelp.filter((id) => !seenHelp.has(id)).join(", ")
    )
    check(
      "Hilfe: „?“ öffnet das Blatt mit Titel und Text aus dem Paket",
      sheetProblems.length === 0,
      sheetProblems.join(", ")
    )
    check(
      "Hilfe: Kartenkopf und Kurzsatz aus dem Thema",
      headProblems.length === 0,
      headProblems.join(", ")
    )
    await tab("Überblick")
    check(
      "Hilfe: Einstieg, Glossar und Fehlschlüsse aus dem Paket",
      $$("[data-guide]", A()).length === T().READING_GUIDE.length + 1 &&
        $$("[data-term]", A()).length === T().GLOSSARY.length &&
        $$("[data-fallacy]", A()).length === T().FALLACIES.length
    )
    check(
      "Hilfe: Glossar und Fehlschlüsse anfangs zu",
      $$("details", A()).every((d) => !d.open)
    )
    await click(button("Erklärungen"), 120)
    check(
      "Hilfe: „Erklärungen“ zeigt Kurzsätze an den acht Kacheln, das Glossar bleibt zu",
      $$("[data-tile] [data-short]", A()).length === 8 && $$("details", A()).every((d) => !d.open)
    )
    await tab("Lage")
    const topicCards = $$("article", A()).filter((a) =>
      T().helpTopic($("button[data-help]", a)?.dataset.help ?? "")
    )
    check(
      "Hilfe: Kurzsatz unter jeder Karte, auch nach dem Reiterwechsel",
      topicCards.length > 0 &&
        topicCards.every(
          (a) =>
            txt($("[data-short]", a)) ===
            T().helpTopic($("button[data-help]", a).dataset.help).short
        )
    )
    await click(button("Erklärungen"), 120)
    check("Hilfe: Schalter nimmt die Kurzsätze wieder weg", $$("[data-short]", A()).length === 0)

    // die übrigen Beispiele
    await click(button("60 Probe"), 200)
    await tab("Ergebnis")
    check(
      "60 Probe: volle Analyse über die Probe, sechs Serien",
      txt($("p", A())).includes("über alle Probeschüsse") &&
        ctext("ergebnis").includes("Schuss60") &&
        $$("[data-series-point]", A()).length === 6,
      txt($("p", A()))
    )
    await click(button("Ausdruck vom 2. Oktober"), 200)
    await tab("Überblick")
    check(
      "Ausdruck: Trend erst ab 10 Schuss",
      ovValue("Trend") === "–" && ovHint("Trend") === "ab 10 Schuss",
      `${ovValue("Trend")} ${ovHint("Trend")}`
    )
    await click(button("Leer"), 200)
    check("Leer: keine Analyse, der Hinweis neben der Scheibe", !A() && !!$("[data-no-shots]"))
    await click(button("Luftgewehr"), 200)
    await click(button("40 Schuss mit Probe"), 200)
    await tab("Ergebnis")
    check(
      "LG: Quoten ab 10,0 und ab 10,5",
      $$("[data-share]", A())
        .map((e) => e.dataset.share)
        .join() === "ab 10,0,ab 10,5"
    )
    await click(button("Luftpistole"), 200)
    await click(button("40 Schuss mit Probe"), 200)
    await tab("Überblick")

    // Analyse auf dem Telefon: keine Seite breiter als der Bildschirm, die Reiter in einer Zeile, der gewählte
    // Reiter im Bild
    const phoneAnalysis = async (doc, win, width) => {
      const bar = doc.querySelector(
        'section[aria-label="Analyse"] [role="radiogroup"][aria-label="Thema"]'
      )
      if (!bar) return ["keine Reiterleiste"]
      const problems = []
      const barHeight = bar.getBoundingClientRect().height
      if (barHeight > 45) problems.push(`Leiste ${barHeight.toFixed(0)} px hoch`)
      for (const label of TABS) {
        const b = [...bar.querySelectorAll("button")].find((x) => txt(x).trim() === label)
        b.dispatchEvent(new win.MouseEvent("click", { bubbles: true }))
        await wait(150)
        const r = b.getBoundingClientRect()
        const c = bar.getBoundingClientRect()
        if (doc.documentElement.scrollWidth > width) {
          problems.push(`${label}: Seite ${doc.documentElement.scrollWidth} px`)
        }
        if (r.left < c.left - 1 || r.right > c.right + 1)
          problems.push(`${label}: Reiter nicht im Bild`)
      }
      return problems
    }

    // ---------- Seitenaufbau (Plan Schritt 4): Sprungleiste, Anker, feste Scheibe, Streifen der Analyse
    const openFrame = async (width, height, hash = "") => {
      const f = document.createElement("iframe")
      f.style.cssText = `width:${width}px;height:${height}px;border:0;position:absolute;left:-9999px`
      f.src = location.href.split("#")[0] + hash
      document.body.appendChild(f)
      await new Promise((resolve) => f.addEventListener("load", resolve, { once: true }))
      await wait(600)
      return f
    }
    // scrollt so, dass das Raster mit Scheibe und Serien direkt unter der Leiste beginnt
    const scrollToRegion = (w) => {
      const region = w.document.getElementById("scheibe")
      w.scrollTo(0, region.getBoundingClientRect().top + w.scrollY - 56)
    }
    const frameClick = async (f, el, ms = 150) => {
      el.dispatchEvent(new f.contentWindow.MouseEvent("click", { bubbles: true }))
      await wait(ms)
    }
    // Desktop in einem Fenster von 1280 × 900 (das Fenster der Prüfung ist über 2000 px hoch)
    const desk = await openFrame(1280, 900)
    const dd = desk.contentDocument
    const dw = desk.contentWindow
    const sectionNav = dd.querySelector('nav[aria-label="Abschnitte"]')
    check(
      "Sprungleiste: vier Anker in der Reihenfolge der Seite",
      [...sectionNav.querySelectorAll("a")].map((a) => a.getAttribute("href")).join() ===
        "#scheibe,#schuesse,#zahlen,#analyse"
    )
    // „Zahlen“ ist kürzer als das Fenster: nach dem Sprung trotzdem genau „Zahlen“ aktiv, nicht die Analyse
    sectionNav.querySelector('a[href="#zahlen"]').click()
    await wait(300)
    dw.dispatchEvent(new dw.Event("scroll"))
    await wait(100)
    const deskActive = [...sectionNav.querySelectorAll("[aria-current]")].map(txt)
    check(
      "Desktop: „Zahlen“ bringt die Zahlen unter die Leiste, aktiv ist genau „Zahlen“",
      near(dd.getElementById("zahlen").getBoundingClientRect().top, 56, 3) &&
        deskActive.join() === "Zahlen",
      `${dd.getElementById("zahlen").getBoundingClientRect().top.toFixed(0)} · ${deskActive.join()}`
    )
    sectionNav.querySelector('a[href="#analyse"]').click()
    await wait(500)
    const analyseTop = dd.getElementById("analyse").getBoundingClientRect().top
    check(
      "Sprungleiste: „Analyse“ bringt die Analyse unter die Leiste",
      near(analyseTop, 56, 3),
      analyseTop.toFixed(0)
    )
    dw.scrollBy(0, 600)
    await wait(100)
    const strip = dd.querySelector(
      'section[aria-label="Analyse"] [role="radiogroup"][aria-label="Thema"]'
    ).parentElement
    check(
      "Desktop: Reiterleiste klebt unter der Sprungleiste",
      near(strip.getBoundingClientRect().top, 56, 1) &&
        near(sectionNav.getBoundingClientRect().top, 0, 1),
      strip.getBoundingClientRect().top.toFixed(0)
    )
    scrollToRegion(dw)
    await wait(100)
    const deskRect = (id) => dd.getElementById(id).getBoundingClientRect()
    const [deskBox, deskSeries, deskTable] = ["target-box", "series", "shot-table"].map(deskRect)
    const tableScroller = dd.querySelector("#shot-table > div")
    check(
      "Desktop: Scheibe und Serien passen zusammen ins Fenster, die Schüsse enden mit den Serien",
      deskSeries.top > deskBox.bottom &&
        deskSeries.bottom <= 900 - 15 &&
        deskBox.width >= 500 &&
        near(deskTable.bottom, deskSeries.bottom, 1) &&
        tableScroller.scrollHeight > tableScroller.clientHeight,
      `Scheibe ${deskBox.width.toFixed(0)} px · Serien bis ${deskSeries.bottom.toFixed(0)} · Schüsse bis ${deskTable.bottom.toFixed(0)}`
    )
    // links Scheibe und Serien, rechts Schuss, Übersicht und Schüsse; Zahlen und Analyse darunter über die
    // ganze Breite
    const regionBox = deskRect("scheibe")
    const fullWidth = ["zahlen", "analyse"].every((id) => {
      const r = deskRect(id)
      return near(r.left, regionBox.left, 1) && near(r.width, regionBox.width, 1)
    })
    const besideTarget = ["readout", "shot-table"].every((id) => deskRect(id).left > deskBox.right)
    check(
      "Desktop: Serien unter der Scheibe, Schuss und Schüsse daneben, Zahlen und Analyse darunter in voller Breite",
      fullWidth && besideTarget && deskSeries.right < deskRect("readout").left,
      `${regionBox.width.toFixed(0)} px`
    )
    // das Ergebnis als Box rechts über der Ablesung; im Kopf steht es nur auf dem Telefon
    const resultBox = dd.querySelector("[data-result-box]").getBoundingClientRect()
    const headResult = dd.querySelector("[data-card-header] [data-result]")
    check(
      "Desktop: Ergebnis als Box über der Ablesung, nicht im Kopf",
      near(resultBox.left, deskRect("readout").left, 1) &&
        resultBox.bottom < deskRect("readout").top &&
        near(resultBox.top, deskBox.top - 15, 2) &&
        headResult.offsetParent === null,
      `${resultBox.left.toFixed(0)}/${deskRect("readout").left.toFixed(0)} · ${resultBox.top.toFixed(0)}`
    )
    dd.getElementById("analyse").scrollIntoView()
    await wait(80)
    check(
      "Desktop: unter dem Raster scrollt die Scheibe mit weg",
      dd.querySelector('[data-section="scheibe"]').getBoundingClientRect().bottom < 56,
      dd.querySelector('[data-section="scheibe"]').getBoundingClientRect().bottom.toFixed(0)
    )
    // nichts angeschnitten: Kacheln in Zeilen zu fünf ohne abgeschnittenen Text, alle Reiter sichtbar,
    // die Knöpfe der Scheibe in ihrem Kasten
    const clipped = [...dd.querySelectorAll("[data-metric] *, [data-tile] *")].filter(
      (e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible"
    )
    check(
      "Desktop: Kacheln zu fünf, kein Text abgeschnitten",
      tileRows(dd).every((n) => n === 5) && clipped.length === 0,
      `${tileRows(dd).join("+")} · ${clipped.length}`
    )
    const deskTabs = dd.querySelector(
      'section[aria-label="Analyse"] [role="radiogroup"][aria-label="Thema"]'
    )
    const boxRect = dd.getElementById("target-box").getBoundingClientRect()
    const corners = [...dd.querySelectorAll('[aria-label="Ansicht der Scheibe"] button')]
    check(
      "Desktop: Reiterleiste ganz sichtbar, die sieben Knöpfe in den Ecken der Scheibe",
      deskTabs.scrollWidth <= deskTabs.clientWidth + 1 &&
        corners.length === 7 &&
        corners.every((b) => {
          const r = b.getBoundingClientRect()
          return (
            r.left >= boxRect.left &&
            r.right <= boxRect.right &&
            r.top >= boxRect.top &&
            r.bottom <= boxRect.bottom
          )
        }),
      `${deskTabs.scrollWidth}/${deskTabs.clientWidth} · ${corners.length}`
    )
    dw.scrollTo(0, 3000)
    await wait(50)
    sectionNav.querySelector('a[href="#scheibe"]').click()
    await wait(100)
    check(
      "Desktop: „Scheibe“ in der Sprungleiste führt nach oben, auch wenn die Scheibe klebt",
      dd.getElementById("scheibe").getBoundingClientRect().top >= 0 &&
        near(dd.getElementById("scheibe").getBoundingClientRect().top, 56, 3),
      `${dw.scrollY.toFixed(0)} · ${dd.getElementById("scheibe").getBoundingClientRect().top.toFixed(0)}`
    )
    desk.remove()
    // aktiver Abschnitt im Fenster der Prüfung: nach dem Sprung meldet der Browser ein Scroll-Ereignis
    {
      const mainNav = $('nav[aria-label="Abschnitte"]')
      $('a[href="#analyse"]', mainNav).click()
      dispatchEvent(new Event("scroll"))
      await wait(100)
      const active = [...mainNav.querySelectorAll("[aria-current]")].map(txt)
      check(
        "Sprungleiste: genau ein Eintrag aktiv, „Analyse“",
        active.join() === "Analyse",
        active.join()
      )
      // am Desktop klebt die Scheibe und ist immer im Bild; oben auf der Seite ist sie der aktive Abschnitt
      scrollTo(0, 0)
      dispatchEvent(new Event("scroll"))
      await wait(100)
      const top = [...mainNav.querySelectorAll("[aria-current]")].map(txt)
      check(
        "Sprungleiste: oben auf der Seite „Scheibe“ aktiv",
        top.join() === "Scheibe",
        top.join()
      )
      scrollTo(0, 0)
    }

    const anchored = await openFrame(800, 900, "#lage")
    const ad = anchored.contentDocument
    const anchoredTab = ad?.querySelector(
      'section[aria-label="Analyse"] [role="radio"][aria-checked="true"]'
    )
    check(
      "Anker #lage öffnet den Reiter Lage und zeigt die Analyse",
      txt(anchoredTab) === "Lage" && ad.getElementById("analyse").getBoundingClientRect().top < 300,
      `${txt(anchoredTab)} · ${ad?.getElementById("analyse").getBoundingClientRect().top.toFixed(0)}`
    )
    const timeTab = [...ad.querySelectorAll('section[aria-label="Analyse"] [role="radio"]')].find(
      (b) => txt(b) === "Zeit und Verlauf"
    )
    await frameClick(anchored, timeTab)
    check(
      "Reiterwechsel schreibt den Anker",
      anchored.contentWindow.location.hash === "#zeit",
      anchored.contentWindow.location.hash
    )
    anchored.remove()

    // feste Scheibe ab 768 px: beim Kleben passt sie samt Leiste ins Fenster, auch flach (D5, D9)
    // flach passt die Scheibe allein ins Fenster, mit genug Höhe samt Serien (ab 280 px Scheibe)
    for (const [width, height, withSeries] of [
      [812, 375, false],
      [1024, 600, false],
      [1024, 768, true],
    ]) {
      const flat = await openFrame(width, height)
      const fd = flat.contentDocument
      scrollToRegion(flat.contentWindow)
      await wait(100)
      const flatBox = fd.getElementById("target-box").getBoundingClientRect()
      const flatSeries = fd.getElementById("series").getBoundingClientRect()
      check(
        `${width} × ${height}: kein seitliches Scrollen, die Scheibe passt unter die Leiste${withSeries ? ", die Serien darunter auch" : ""}`,
        fd.documentElement.scrollWidth <= width &&
          near(flatBox.top - 15, 56, 1) &&
          flatBox.bottom <= height &&
          flatSeries.bottom <= height === withSeries,
        `${fd.documentElement.scrollWidth} · Scheibe ${flatBox.top.toFixed(0)}–${flatBox.bottom.toFixed(0)}, Serien bis ${flatSeries.bottom.toFixed(0)} von ${height}`
      )
      flat.remove()
    }

    // Anker beim Laden: die Seite entsteht erst im Browser, der Sprung kommt aus dem Labor
    const loaded = await openFrame(375, 812, "#schuesse")
    const shotsTop = loaded.contentDocument.getElementById("schuesse").getBoundingClientRect().top
    check(
      "Anker #schuesse beim Laden: die Schüsse unter der Leiste",
      near(shotsTop, 56, 3),
      shotsTop.toFixed(0)
    )
    loaded.remove()

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
    const phone390 = doc ? await phoneAnalysis(doc, frame.contentWindow, 390) : ["kein Zugriff"]
    check(
      "Handy 390 px: jeder Reiter der Analyse passt",
      phone390.length === 0,
      phone390.join(" | ")
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

    // ---------- Handy: 375 px (kleinstes übliches Telefon)
    const small = document.createElement("iframe")
    small.style.cssText = "width:375px;height:812px;border:0;position:absolute;left:-9999px"
    small.src = location.href.split("#")[0]
    document.body.appendChild(small)
    await new Promise((resolve) => small.addEventListener("load", resolve, { once: true }))
    await wait(500)
    const smallDoc = small.contentDocument
    check(
      "Handy 375 px: kein seitliches Scrollen",
      !!smallDoc && smallDoc.documentElement.scrollWidth <= 375,
      smallDoc ? String(smallDoc.documentElement.scrollWidth) : "kein Zugriff"
    )
    const phone375 = smallDoc
      ? await phoneAnalysis(smallDoc, small.contentWindow, 375)
      : ["kein Zugriff"]
    check(
      "Handy 375 px: jeder Reiter der Analyse passt",
      phone375.length === 0,
      phone375.join(" | ")
    )
    // erster Bildschirm (D2): ab dem Kopf der Scheibe passen Kopf und Scheibe auf einen Bildschirm, die Serien
    // folgen direkt (der Kopf des Labors darüber gehört nicht zur App)
    const sd = smallDoc
    const sw = small.contentWindow
    const headTop = sd
      .querySelector("[data-result]")
      .closest("[data-card-header]")
      .getBoundingClientRect().top
    const targetBottom = sd.getElementById("target-box").getBoundingClientRect().bottom
    const cardBottom = sd.getElementById("scheibe").getBoundingClientRect().bottom
    const seriesTop = sd.getElementById("series").getBoundingClientRect().top
    check(
      "Handy 375 px: Kopf mit Ergebnis und Scheibe auf dem ersten Bildschirm, die Serien direkt danach",
      targetBottom - headTop <= 812 && seriesTop - cardBottom <= 30,
      `${(targetBottom - headTop).toFixed(0)} px bis zum Ende der Scheibe, Serien ${(seriesTop - cardBottom).toFixed(0)} px danach`
    )
    const visibleRows = [...sd.querySelectorAll("#shot-table tr[data-row]")].filter(
      (tr) => tr.getBoundingClientRect().height > 0
    )
    const showAll = [...sd.querySelectorAll("#shot-table button")].find((b) =>
      txt(b).startsWith("Alle")
    )
    check(
      "Handy 375 px: die zehn neuesten Schüsse und „Alle 40 zeigen“",
      visibleRows.length === 10 && txt(showAll) === "Alle 40 zeigen",
      `${visibleRows.length} Zeilen · ${txt(showAll)}`
    )
    // Rücksprung (D6): der Ellipsen-Knopf aus „Lage“ holt die Scheibe, die Pille bringt zurück
    const smallBar = sd.querySelector(
      'section[aria-label="Analyse"] [role="radiogroup"][aria-label="Thema"]'
    )
    await frameClick(
      small,
      [...smallBar.querySelectorAll("button")].find((b) => txt(b) === "Lage")
    )
    sd.getElementById("analyse").scrollIntoView({ block: "start" })
    sw.scrollBy(0, 200)
    await wait(200)
    const origin = sw.scrollY
    check(
      "Handy 375 px: in der Analyse deckt die Reiterleiste die Sprungleiste ab",
      near(smallBar.parentElement.getBoundingClientRect().top, 0, 1) &&
        smallBar.parentElement.contains(sd.elementFromPoint(20, 28)),
      `${smallBar.parentElement.getBoundingClientRect().top.toFixed(0)} · ${sd.elementFromPoint(20, 28)?.tagName}`
    )
    const smallEllipse = [...sd.querySelectorAll('[data-card="lage-echt"] button')].find((b) =>
      txt(b).includes("Vertrauensellipse")
    )
    // echter Fokus auf dem Knopf: nach dem Rücksprung muss er dorthin zurück
    smallEllipse.focus()
    await frameClick(small, smallEllipse, 1500)
    const pillButton = () =>
      [...sd.querySelectorAll("button")].find((b) => txt(b).startsWith("Zurück zu"))
    const jumped = sd.querySelector('[data-section="scheibe"]').getBoundingClientRect().top
    check(
      "Handy 375 px: Ellipse aus „Lage“ bringt die Scheibe ins Bild und die Pille",
      near(jumped, 56, 3) && txt(pillButton()) === "Zurück zu „Lage“",
      `${jumped.toFixed(0)} · ${txt(pillButton())}`
    )
    await frameClick(small, pillButton(), 1500)
    check(
      "Handy 375 px: die Pille bringt zurück und verschwindet",
      near(sw.scrollY, origin, 60) && !pillButton(),
      `${sw.scrollY.toFixed(0)} statt ${origin.toFixed(0)}`
    )
    check(
      "Handy 375 px: nach dem Rücksprung liegt der Fokus wieder auf dem Knopf, der Sprung war angesagt",
      sd.activeElement === smallEllipse &&
        !!sd.querySelector('[role="status"][aria-live="polite"].sr-only'),
      sd.activeElement?.textContent?.slice(0, 30) ?? ""
    )
    small.remove()

    check("Keine Skriptfehler", window.__errors.length === 0, window.__errors.join(" | "))
  } catch (error) {
    log.push(`FAIL Skriptprüfung abgebrochen — ${error?.stack ?? error}`)
  }

  const pre = document.createElement("pre")
  pre.id = "dbg"
  pre.textContent = log.join("\n")
  document.body.appendChild(pre)
})
