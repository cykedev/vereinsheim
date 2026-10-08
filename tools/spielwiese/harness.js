<script>
// Skriptprüfung der Spielwiese: Bedienung durchspielen und jede angezeigte Analyse-Zahl gegen shot-core
// nachrechnen. Das Ergebnis steht am Ende im Element dbg, für --dump-dom.
const errors = window.__errors
addEventListener("load", async () => {
  const S = ShotCore
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const $ = (id) => document.getElementById(id)
  const log = []
  const check = (name, ok, detail = "") => log.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`)
  const nf = (d) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d })
  const txt = (el) => el.textContent.replace(/\u00a0/g, " ")
  const vbW = () => Number($("target").getAttribute("viewBox").split(" ")[2])
  const tiles = (sel) => Array.from(document.querySelectorAll(`${sel} .metric`)).map((m) => ({
    label: txt(m.querySelector(".label")),
    value: m.querySelector(".value").childNodes[0] ? txt(m.querySelector(".value").childNodes[0]) : "",
    text: txt(m.querySelector(".value")),
    hint: txt(m.querySelector(".hint")),
  }))
  const tile = (sel, label) => tiles(sel).find((t) => t.label === label)
  const tap = (fx, fy) => {
    const r = $("target").getBoundingClientRect()
    $("target").dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: r.left + r.width * fx, clientY: r.top + r.height * fy }))
  }
  const tab = (id) => document.querySelector(`#tabs [data-tab="${id}"]`).click()
  const A = () => $("analysis")
  const shots = () => window.__spielwiese.metricShots()
  const match = () => shots().filter((s) => s.kind === "match")
  const rowsN = () => $("shot-rows").children.length
  await wait(200)
  // Abstände: zwischen allen Blöcken der Analyse und innerhalb jeder Spalte genau 16 px
  const gapProblems = () => {
    const bad = []
    const bottomOf = (el) => (el.classList.contains("a-grid") ? Math.max(...Array.from(el.children).map((c) => c.getBoundingClientRect().bottom)) : el.getBoundingClientRect().bottom)
    const kids = Array.from(A().children).filter((e) => e.getBoundingClientRect().height > 0)
    for (let i = 1; i < kids.length; i++) {
      const g = kids[i].getBoundingClientRect().top - bottomOf(kids[i - 1])
      if (Math.abs(g - 16) > 1) bad.push(`${kids[i - 1].className.split(" ")[0]} → ${kids[i].className.split(" ")[0]}: ${g.toFixed(1)} px`)
    }
    for (const grid of A().querySelectorAll(".a-grid")) {
      const cols = new Map()
      for (const c of grid.children) {
        const r = c.getBoundingClientRect()
        const k = Math.round(r.left)
        if (!cols.has(k)) cols.set(k, [])
        cols.get(k).push(r)
      }
      for (const rects of cols.values()) {
        rects.sort((a, b) => a.top - b.top)
        for (let i = 1; i < rects.length; i++) {
          const g = rects[i].top - rects[i - 1].bottom
          if (Math.abs(g - 16) > 1) bad.push(`Spalte: ${g.toFixed(1)} px`)
        }
      }
    }
    return bad
  }

  // ---------- Ebenen: alles, was etwas zeigt, über den Schüssen
  check("Ebenen: Schüsse, Nummern, dann Streukreis, Ellipse, Schwerpunkt", Array.from($("target").children).map((g) => g.id).join() === "g-target,g-shots,g-numbers,g-circle,g-ellipse,g-mpi", Array.from($("target").children).map((g) => g.id).join())

  // ---------- Beispielscheibe LP 40 mit Probe (Standard)
  check("Standard: LP, 40 Schuss + 9 Probe", rowsN() === 49 && $("sum").textContent.includes("40 Schuss + 9 Probe"), $("sum").textContent.slice(0, 60))
  check("Probe hohl gezeichnet", Array.from($("g-shots").children).filter((c) => c.getAttribute("fill") === "transparent").length === 9)
  check("Tabelle: Probe als P1 … P9, Wertung ab 1", $("shot-rows").lastElementChild.firstElementChild.textContent === "P1" && $("shot-rows").firstElementChild.firstElementChild.textContent === "40")
  check("Pause in der Intervall-Spalte", Array.from($("shot-rows").children).some((tr) => tr.lastElementChild.textContent.includes("min")))
  check("Kennzahlen: 10 Kacheln", tiles("#metrics").length === 10, tiles("#metrics").map((t) => t.label).join(", "))
  check("Kennzahlen rechnen über die Wertung", tile("#metrics", "Präzision σ").text.startsWith(nf(2).format(S.computeMetric(S.metricByKey("group.sigma"), match()))), tile("#metrics", "Präzision σ").text)
  check("Kacheln an der Scheibe ohne Ø Abstand und ohne Versatz", !tiles("#metrics").some((t) => t.label === "Versatz Probe → Wertung" || t.label.startsWith("mittlerer")))
  // ---------- Treffer, Nummern, Serien (Wünsche des Users, Oktober 2026)
  const shotCircles = Array.from($("g-shots").children)
  const filled = shotCircles.filter((c) => c.getAttribute("fill") !== "transparent")
  check("Treffer leicht durchscheinend, Rand voll", filled.length === 40 && filled.every((c) => c.getAttribute("fill-opacity") === "0.8" && c.getAttribute("stroke") === "var(--shot-edge)" && !c.hasAttribute("stroke-opacity")), filled[0] && filled[0].getAttribute("fill-opacity"))
  check("Probe bleibt hohl", shotCircles.filter((c) => c.getAttribute("fill") === "transparent").length === 9)
  if ($("toggle-numbers").getAttribute("aria-pressed") === "true") $("toggle-numbers").click()
  check("Nummern: aus, keine Beschriftung", $("g-numbers").childElementCount === 0)
  $("toggle-numbers").click()
  await wait(50)
  const numberLabels = Array.from($("g-numbers").children)
  const numberTexts = numberLabels.map((l) => l.textContent)
  const allLabels = [...Array.from({ length: 9 }, (_, i) => `P${i + 1}`), ...Array.from({ length: 40 }, (_, i) => String(i + 1))]
  check("Nummern: Schalter blendet jede Nummer ein", numberLabels.length === 49 && allLabels.every((x) => numberTexts.includes(x)) && $("toggle-numbers").getAttribute("aria-pressed") === "true", `${numberLabels.length} Nummern`)
  const circleOf = (label) => shotCircles.find((c) => (/^(?:Schuss|Probe) (\S+):/.exec(c.textContent) || [])[1] === label)
  check("Nummern: jede auf ihrem Treffer", numberLabels.every((l) => { const c = circleOf(l.textContent); return c && c.getAttribute("cx") === l.getAttribute("x") && c.getAttribute("cy") === l.getAttribute("y") }))
  const pxOf = (label) => Number(label.getAttribute("font-size")) / (vbW() / $("target").getBoundingClientRect().width)
  check("Nummern: 8–12 px auf dem Schirm", pxOf(numberLabels[0]) >= 8 - 1e-6 && pxOf(numberLabels[0]) <= 12 + 1e-6, pxOf(numberLabels[0]).toFixed(2) + " px")
  $("view-group").click()
  await wait(600)
  check("Nummern: wachsen beim Zoomen nicht über 12 px", pxOf($("g-numbers").firstElementChild) <= 12 + 1e-6, pxOf($("g-numbers").firstElementChild).toFixed(2) + " px")
  $("view-target").click()
  await wait(600)
  $("toggle-numbers").click()
  check("Nummern: Schalter blendet wieder aus", $("g-numbers").childElementCount === 0 && $("toggle-numbers").getAttribute("aria-pressed") === "false")
  const seriesTiles = () => Array.from(document.querySelectorAll("#series-grid .series-tile"))
  const tileTitles = seriesTiles().map((t) => t.querySelector("figcaption span").textContent)
  check("Serien: Probe und vier Serien bei den Treffern", !$("series-overview").hidden && tileTitles.join() === "Probe,Serie 1,Serie 2,Serie 3,Serie 4" && txt(seriesTiles()[0].querySelector("b")) === "9 Schuss", tileTitles.join(", "))
  const curveD = S.seriesCurve(shots(), "decimal")
  check("Serien: Ergebnis je Serie wie seriesCurve (Zehntel)", seriesTiles().slice(1).every((t, i) => txt(t.querySelector("b")) === nf(1).format(curveD[i].total)), seriesTiles().slice(1).map((t) => txt(t.querySelector("b"))).join(" · "))
  check("Serien: je Serie ihre zehn Treffer, durchscheinend", seriesTiles().slice(1).every((t) => t.querySelectorAll("circle[fill-opacity='0.8']").length === 10))
  check("Serien: Probe hohl, vor der Verstellung gestrichelt", seriesTiles()[0].querySelectorAll("circle[fill='transparent']").length === 9 && seriesTiles()[0].querySelectorAll("circle[stroke-dasharray]").length === 4)
  check("Serien: alle im gleichen Maßstab", new Set(seriesTiles().map((t) => t.querySelector("svg").getAttribute("viewBox"))).size === 1)
  $("mode-rings").click()
  const curveR = S.seriesCurve(shots(), "rings")
  check("Serien: Ergebnis je Serie in ganzen Ringen", seriesTiles().slice(1).every((t, i) => txt(t.querySelector("b")) === String(curveR[i].total)), seriesTiles().slice(1).map((t) => txt(t.querySelector("b"))).join(" · "))
  $("mode-decimal").click()
  check("Reiter: sechs", document.querySelectorAll("#tabs button").length === 6)

  // ---------- Überblick, Zehntel
  tab("overview")
  const m = match()
  const sigma = S.sigmaEstimate(m)
  const conf = S.mpiConfidence(m)
  const tens = S.shareAtLeast(m, "decimal", 100)
  const lossSplit = S.ringLossSplit(m, S.TARGETS["lp-10m"])
  const zeroedAll = S.sighterZeroed(shots(), { adjustAfter: window.__spielwiese.state.adjustAfter })
  const trend = S.cardTrend(m, "decimal")
  check("Überblick: 8 Kacheln", tiles("#analysis").length === 8)
  check("Überblick: Ergebnis", tile("#analysis", "Ergebnis").value === nf(1).format(S.computeMetric(S.metricByKey("result.decimal"), m)), tile("#analysis", "Ergebnis").text)
  check("Überblick: Zehnerquote mit Wilson", tile("#analysis", "Zehnerquote").value === nf(0).format(tens.rate * 100) && tile("#analysis", "Zehnerquote").hint.includes(`${nf(0).format(tens.low * 100)} %`), tile("#analysis", "Zehnerquote").hint)
  check("Überblick: σ mit Bereich", tile("#analysis", "Präzision σ").value === nf(2).format(sigma.sigma / 1000) && tile("#analysis", "Präzision σ").hint.includes(nf(2).format(sigma.high / 1000)), tile("#analysis", "Präzision σ").hint)
  check("Überblick: Lage echt/unklar wie Hotelling", tile("#analysis", "Lage").value === (conf.real ? "echt" : "unklar"), `${tile("#analysis", "Lage").value}, T² ${conf.t2.toFixed(2)} / ${conf.critical.toFixed(2)}`)
  check("Überblick: Ringverlust aus Lage und Streuung (L4)", tile("#analysis", "Ringverlust").value === nf(1).format(lossSplit.total.decimal), tile("#analysis", "Ringverlust").text + " " + tile("#analysis", "Ringverlust").hint)
  check("Überblick: das Trend-Urteil widerspricht der Zahl nicht", !trend.clear || (trend.direction === "up") === (trend.perTenShots > 0), `${trend.perTenShots} ${trend.direction}`)
  {
    // Stand des Bundles: ohne Lage oder verdächtig kein Ringverlust aus einer Teilsumme (Review SP-1.12)
    const m0 = match()
    const hand = { ...m0[0], seq: 999, xUm: null, yUm: null, flags: ["verdaechtig"] }
    const partial = S.ringLossSplit([...m0, hand], S.LP_10M)
    check("Bundle: Ringverlust nur über alle Wertungsschüsse", partial !== null && partial.total === null && S.ringLossSplit(m0, S.LP_10M).total !== null)
  }
  check("Überblick: Trend mit Richtung", tile("#analysis", "Trend").hint === (trend.clear ? `klar ${trend.direction === "up" ? "steigend" : "fallend"} (95 %)` : "nicht klar") && tile("#analysis", "Trend").value.replace("−", "-").replace("+", "") === nf(2).format(trend.perTenShots).replace("+", ""), tile("#analysis", "Trend").text + " " + tile("#analysis", "Trend").hint)
  const obs = Array.from(document.querySelectorAll("#analysis .observations li")).map((li) => txt(li))
  check("Beobachtungen: mindestens fünf Sätze", obs.length >= 5, obs.length + "")
  check("Beobachtungen: Lage-Satz passt zu Hotelling", obs[0].includes(conf.real ? "echt" : "Zufall"), obs[0])
  check("Beobachtungen: Pause erkannt", obs.some((o) => o.includes("der Pause vor Schuss 21")), obs.find((o) => o.includes("Pause")) || "")
  check("Beobachtungen: Probe nach der Verstellung", obs.some((o) => o.includes("Probe nach der Verstellung")), obs.find((o) => o.includes("Probe")) || "")
  check("Probe → Wertung im Überblick aus „Eingeschossen?“ (S4)", tile("#analysis", "Probe → Wertung").value === nf(2).format(zeroedAll.matchOffsetUm / 1000), tile("#analysis", "Probe → Wertung").text)
  check("Datenlage-Zeile", txt(A().querySelector(".coverage")).startsWith("Datenlage: 40 Wertung · 9 Probe · alle mit Lage, Zeit und Wert"), txt(A().querySelector(".coverage")))

  // ---------- Ergebnis
  tab("result")
  await wait(50)
  const dist = S.ringDistribution(m)
  const barRows = A().querySelectorAll(".bar-row")
  check("Ergebnis: Ringbalken je Ring", barRows.length >= 3 && barRows[0].querySelector(".v").textContent.startsWith(String(dist.counts[10])), barRows.length + " Zeilen, 10er " + dist.counts[10])
  const hist = A().querySelector(".chart-slot svg")
  check("Ergebnis: Zehntelverteilung gezeichnet", !!hist && hist.querySelectorAll("rect").length === S.decimalHistogram(m).counts.filter(Boolean).length, hist ? hist.querySelectorAll("rect").length + "" : "fehlt")
  check("Ergebnis: Diagramm in Pixelbreite", hist && Number(hist.getAttribute("width")) === Math.floor(hist.parentElement.clientWidth), hist && hist.getAttribute("width") + " / " + hist.parentElement.clientWidth)
  const ex = S.shotExtremes(m)
  check("Ergebnis: Teilerlisten ohne eigene Zeile für besten und schwächsten Schuss", txt(A()).includes(`(${ex.bestTeiler[0].number})`) && !txt(A()).includes("Schwächster") && !txt(A()).includes("Teiler Ø"), `bester Teiler bei Schuss ${ex.bestTeiler[0].number}`)
  check("Ergebnis: keine Innenzehner-Quote mehr", !Array.from(A().querySelectorAll(".share-row .k")).some((k) => k.textContent === "Innenzehner"))
  check("Ergebnis: Serienkurve mit vier Serien", A().querySelectorAll("svg circle").length >= 4)
  check("Ergebnis: Quoten mit Intervall (zwei Schwellen, ohne Innenzehner-Quote)", A().querySelectorAll(".share-row .ci").length === 2)

  // ---------- Wertung umschalten: ganze Ringe überall
  $("mode-rings").click()
  await wait(50)
  check("Ringe: Zehntelverteilung nur als Hinweis", !A().querySelector(".chart-slot svg rect[fill*='--s']") && txt(A()).includes("Gibt es nur in der Zehntelwertung"))
  tab("overview")
  check("Ringe: Ergebnis ganzzahlig", tile("#analysis", "Ergebnis").value === String(S.computeMetric(S.metricByKey("result.rings"), m)), tile("#analysis", "Ergebnis").text)
  check("Ringe: Trend in Ringen", tile("#analysis", "Trend").value.replace("−", "-").replace("+", "") === nf(2).format(S.cardTrend(m, "rings").perTenShots).replace("+", ""), tile("#analysis", "Trend").text)
  check("Ringe: Datenlage nennt die Wertung", txt(A().querySelector(".coverage")).includes("in ganzen Ringen"))
  $("mode-decimal").click()

  // ---------- Präzision
  tab("precision")
  await wait(50)
  check("Präzision: σ groß", A().querySelector(".big").textContent.startsWith(nf(2).format(sigma.sigma / 1000)))
  check("Präzision: kein Sa mehr (nur σ)", !txt(A()).includes("Sa ") && !txt(A()).includes("Meyton-Formel"))
  check("Präzision: ohne Ø Abstand, Höhe, Breite und Verhältnis", !txt(A()).includes("Ø Abstand zum") && !txt(A()).includes("Höhe ·") && !txt(A()).includes("Ø Radius / R50"))
  check("Präzision: R50 in Ringbreiten", txt(A()).includes("R50 in Ringbreiten"))
  const olossM = S.outlierLoss(m, "decimal")
  check("Präzision: Kosten der markierten Ausreißer", !olossM || olossM.count === 0 || txt(A()).includes(`Kosten${nf(1).format(olossM.loss)} Ringe`), olossM ? `${olossM.count} markiert, ${olossM.loss}` : "unbekannt")
  const shapeSvg = Array.from(A().querySelectorAll(".chart-slot svg")).find((svg) => svg.querySelector("ellipse"))
  check("Präzision: Form mit Ellipse und Punkten", !!shapeSvg && shapeSvg.querySelectorAll("circle").length >= 40)
  check("Präzision: Ellipsen-Kontur über den Punkten", !!shapeSvg && shapeSvg.querySelector("ellipse:last-of-type").getAttribute("stroke") === "var(--accent)" && Array.from(shapeSvg.children).indexOf(shapeSvg.querySelector("ellipse:last-of-type")) > Array.from(shapeSvg.children).indexOf(shapeSvg.querySelector("circle")))
  const outlM = S.outliers(m)
  check("Präzision: Abreißer als roter Punkt und mit Nummer", outlM.flagged.length >= 1 && shapeSvg.querySelectorAll(".outlier-dot").length === outlM.flagged.length && txt(A()).includes(`Schuss ${outlM.flagged[0].number}`), outlM.flagged.map((f) => f.number).join(", "))
  const shapeM = S.groupShape(m)
  check("Präzision: Form nennt die Grenze", txt(A()).includes(`gestreckt ab ${nf(2).format(shapeM.ratioLimit)} bei ${shapeM.n} Schuss`), `a/b ${shapeM.ratio.toFixed(2)}, Grenze ${shapeM.ratioLimit.toFixed(2)}, gestreckt ${shapeM.elongated}`)

  // ---------- Lage
  tab("position")
  await wait(50)
  const clock = S.directionClock(m)
  const roses = Array.from(A().querySelectorAll(".chart-slot svg")).find((svg) => svg.getAttribute("aria-label") === "Richtungsuhr")
  check("Lage: Richtungsuhr mit einem Keil je besetzter Stunde", roses && roses.querySelectorAll("path").length === clock.counts.filter(Boolean).length, roses ? roses.querySelectorAll("path").length + " / " + clock.counts.filter(Boolean).length : "fehlt")
  A().querySelector('[data-action="clock-mpi"]').click()
  await wait(20)
  check("Lage: Uhr um den Schwerpunkt", A().querySelector('[data-action="clock-mpi"]').getAttribute("aria-pressed") === "true")
  const before = $("g-ellipse").children.length
  A().querySelector('[data-action="ellipse"]').click()
  check("Lage: Knopf zeigt die Ellipse auf der Scheibe (Saum und Linie)", before === 0 && $("g-ellipse").children.length === 2 && $("toggle-ellipse").getAttribute("aria-pressed") === "true")
  A().querySelector('[data-action="ellipse"]').click()
  check("Lage: und blendet sie wieder aus", $("g-ellipse").children.length === 0)
  const split = S.ringLossSplit(m, S.TARGETS["lp-10m"])
  check("Lage: Ringverlust nach Ursache", txt(A()).includes(`Lage ${nf(1).format(split.positionLoss.decimal)}`) && txt(A()).includes(`Streuung ${nf(1).format(split.spreadLoss.decimal)}`), `${split.positionLoss.decimal} / ${split.spreadLoss.decimal}, reliable ${split.reliable}`)
  check("Lage: von Neumann", txt(A()).includes(nf(2).format(S.drift(m).vonNeumann)))
  check("Lage: kein Lageanteil, keine Sprünge", !txt(A()).includes("Lageanteil") && !txt(A()).includes("Sprung von Treffer"))
  check("Lage: Ringverlust gesamt aus L4", txt(A()).includes(`Ringverlust${nf(1).format(split.total.decimal)} Ringe`))

  // ---------- Zeit & Verlauf
  tab("time")
  await wait(50)
  const svgs = Array.from(A().querySelectorAll(".chart-slot svg"))
  const course = svgs.find((svg) => svg.getAttribute("aria-label").startsWith("Wert je Schuss"))
  check("Zeit: Verlauf mit 40 Punkten", course && course.querySelectorAll("circle").length === 40, course ? course.querySelectorAll("circle").length + "" : "fehlt")
  check("Zeit: Verlauf zeigt die Pause", course && course.querySelectorAll('line[stroke="var(--warn)"]').length === 1)
  const rhythm = svgs.find((svg) => svg.getAttribute("aria-label").startsWith("Abstände"))
  check("Zeit: Rhythmus mit 39 Abständen, eine Pause", rhythm && rhythm.querySelectorAll("rect").length === 39 && rhythm.querySelectorAll('rect[fill="var(--warn)"]').length === 1, rhythm ? rhythm.querySelectorAll("rect").length + "" : "fehlt")
  check("Zeit: Serien-Tabelle", A().querySelectorAll("table tbody tr").length === 4)
  const tired = S.fatigue(m, "decimal")
  check("Zeit: Ermüdung", txt(A()).includes(`Ø ${nf(2).format(tired.lastMeanRings)}`))

  // ---------- Probe
  tab("sighters")
  await wait(50)
  check("Probe: Umfang 9", txt(A()).includes("9 (1 Block à zehn)"), A().querySelector(".kv").textContent.slice(0, 80))
  const cmp = S.sighterComparison(shots(), "decimal", { adjustAfter: [4] })
  check("Probe: nach der Verstellung 5 Schuss", cmp.probe.n === 5 && txt(A()).includes("Probe nach Verstellung"))
  const sightSvg = Array.from(A().querySelectorAll(".chart-slot svg")).find((svg) => svg.getAttribute("aria-label").startsWith("Probeschüsse"))
  check("Probe: auf der Scheibe, vier gestrichelt", sightSvg && sightSvg.querySelectorAll("circle[stroke-dasharray]").length === 4, sightSvg ? sightSvg.querySelectorAll("circle[stroke-dasharray]").length + "" : "fehlt")
  // Visier nachträglich setzen und wieder entfernen; die Probe-Auswertungen folgen dem Fachkern
  const adjustBtn = (k) => A().querySelector(`[data-action="adjust"][data-after="${k}"]`)
  const adjusted = () => JSON.stringify(window.__spielwiese.state.adjustAfter)
  check("Probe: Schalter P1 bis P8, P4 aus dem Beispiel gesetzt", A().querySelectorAll('[data-action="adjust"]').length === 8 && adjustBtn(4).getAttribute("aria-pressed") === "true" && adjustBtn(8) !== null && adjustBtn(9) === null)
  adjustBtn(6).click()
  await wait(50)
  const cmp6 = S.sighterComparison(shots(), "decimal", { adjustAfter: [4, 6] })
  const zero6 = S.sighterZeroed(shots(), { adjustAfter: [4, 6] })
  check("Probe: nach P6 verstellt, drei Probeschüsse danach", adjusted() === "[4,6]" && cmp6.probe.n === 3 && zero6.n === 3 && adjustBtn(6).getAttribute("aria-pressed") === "true" && document.activeElement === adjustBtn(6), `${adjusted()} · ${cmp6.probe.n} · ${zero6.n}`)
  const offsetText = (z) => (z.matchOffsetUm === null ? "–" : `${nf(2).format(z.matchOffsetUm / 1000)} mm`)
  check("Probe: „Eingeschossen?“ folgt der Verstellung", txt(A()).includes(`Versatz Probe → Wertung${offsetText(zero6)}`), offsetText(zero6))
  adjustBtn(6).click()
  await wait(50)
  adjustBtn(4).click()
  await wait(50)
  const zeroNone = S.sighterZeroed(shots(), { adjustAfter: [] })
  check("Probe: ohne Verstellung die letzten fünf", adjusted() === "[]" && zeroNone.n === 5 && !txt(A()).includes("Probe nach Verstellung") && txt(A()).includes(`Versatz Probe → Wertung${offsetText(zeroNone)}`), `${adjusted()} · ${zeroNone.n}`)
  adjustBtn(4).click()
  await wait(50)
  check("Probe: zurück zum Beispiel", adjusted() === "[4]")

  // ---------- Abstände in allen Reitern
  const gapReport = []
  for (const id of ["overview", "result", "precision", "position", "time", "sighters"]) {
    tab(id)
    await wait(30)
    const bad = gapProblems()
    if (bad.length) gapReport.push(`${id}: ${bad.join("; ")}`)
  }
  check("Abstände: überall 16 px zwischen Blöcken und Karten", gapReport.length === 0, gapReport.join(" | "))

  // ---------- Hilfe (aus @vereinsheim/shot-help, SP-1.11)
  const HS = ShotHelp
  const entry = (id) => HS.helpTopic(id) ?? HS.VIEW_HELP.find((v) => v.id === id)
  const ROWS = [["what", "Was"], ["read", "So liest du es"], ["act", "Was du tun kannst"], ["caution", "Vorsicht"], ["minimum", "Mindestzahl"]]
  const helpCounts = []
  const seen = new Set()
  const textProblems = []
  const headProblems = []
  const collect = () => {
    for (const d of A().querySelectorAll("details.help[data-help]")) {
      const id = d.dataset.help
      seen.add(id)
      const h = entry(id)
      if (!h) {
        textProblems.push(`${id}: unbekannt`)
        continue
      }
      const got = Array.from(d.querySelectorAll(".help-body > p")).map(txt)
      const want = ROWS.filter(([field]) => h[field]).map(([field, label]) => `${label}: ${h[field]}`)
      if (got.join("\n") !== want.join("\n")) textProblems.push(id)
      const code = d.querySelector("details.formula code")
      if ((code ? txt(code) : undefined) !== h.formula) textProblems.push(`${id} (Formel)`)
      const article = d.closest("article")
      if (!article) continue
      const h3 = article.querySelector("h3")
      const topic = HS.helpTopic(id)
      if (topic) {
        if (txt(h3) !== topic.title + topic.catalog.join(" · ")) headProblems.push(`${txt(h3)} ≠ ${topic.title}`)
        if (h3.title !== topic.short) headProblems.push(`${id}: Kurzsatz`)
      } else if (!txt(h3).startsWith(h.title)) headProblems.push(`${txt(h3)} ≠ ${h.title}`)
    }
  }
  for (const id of ["overview", "result", "precision", "position", "time", "sighters"]) {
    tab(id)
    const cards = Array.from(A().querySelectorAll("article.a-card")).filter((a) => !a.textContent.startsWith("So liest du"))
    helpCounts.push(`${id} ${cards.filter((a) => a.querySelector("details.help")).length}/${cards.length}`)
    if (cards.some((a) => !a.querySelector("details.help"))) check(`Hilfe fehlt im Reiter ${id}`, false, cards.filter((a) => !a.querySelector("details.help")).map((a) => a.querySelector("h3").textContent).join(", "))
    collect()
  }
  check("Hilfe: jede Karte hat „Was heißt das?“", helpCounts.length === 6, helpCounts.join(" · "))
  // die Erklärung „Trefferbild“ steht unter den Schaltern der Scheibe, nicht in der Analyse
  const targetHelp = document.querySelector("#target-help details.help[data-help='trefferbild']")
  if (targetHelp) seen.add("trefferbild")
  const trefferbild = HS.VIEW_HELP.find((v) => v.id === "trefferbild")
  check("Hilfe: „Trefferbild“ unter den Schaltern der Scheibe, Texte aus dem Paket", !!targetHelp && Array.from(targetHelp.querySelectorAll(".help-body > p")).map(txt).join("\n") === [`Was: ${trefferbild.what}`, `So liest du es: ${trefferbild.read}`].join("\n"))
  const wanted = [...HS.HELP_TOPICS.map((t) => t.id), ...HS.VIEW_HELP.map((v) => v.id)]
  check("Hilfe: jedes Thema des Pakets hat seinen Platz", wanted.every((id) => seen.has(id)), wanted.filter((id) => !seen.has(id)).join(", ") || `${seen.size} von ${wanted.length}`)
  check("Hilfe: Texte und Formeln gleich denen im Paket", textProblems.length === 0, textProblems.join(", "))
  check("Hilfe: Kartenkopf und Kurzsatz aus dem Thema", headProblems.length === 0, headProblems.join(" | "))
  tab("overview")
  const introItems = Array.from(A().querySelectorAll(".intro li")).map(txt)
  check("Hilfe: Einstieg „So liest du die Analyse“ aus dem Paket", introItems.length === HS.READING_GUIDE.length + 1 && HS.READING_GUIDE.every((g, i) => introItems[i] === `${g.title}. ${g.text}`), `${introItems.length} Punkte`)
  const gloss = A().querySelector("details.glossary-card:not(.fallacies)")
  const terms = gloss ? Array.from(gloss.querySelectorAll("dt")).map(txt) : []
  const defs = gloss ? Array.from(gloss.querySelectorAll("dd")).map(txt) : []
  check("Hilfe: Glossar gleich dem Paket", terms.length === HS.GLOSSARY.length && HS.GLOSSARY.every((g, i) => terms[i] === g.term && defs[i] === g.text), `${terms.length} Begriffe`)
  const fallacies = Array.from(A().querySelectorAll(".fallacy-list li")).map(txt)
  check("Hilfe: typische Fehlschlüsse aus dem Paket", fallacies.length === HS.FALLACIES.length && HS.FALLACIES.every((f, i) => fallacies[i] === `${f.title}. ${f.text}`), `${fallacies.length}`)
  const shorts = new Set(HS.HELP_TOPICS.map((t) => t.short))
  const tipsTarget = Array.from(document.querySelectorAll("#metrics .metric")).map((m) => m.title)
  check("Kacheln an der Scheibe: Kurzsatz über helpForMetric", tipsTarget.length === 10 && tipsTarget.every((t) => shorts.has(t)), `${tipsTarget.filter((t) => shorts.has(t)).length}/${tipsTarget.length}`)
  const tipsOverview = Array.from(A().querySelectorAll(".metrics .metric")).map((m) => m.title)
  check("Kacheln im Überblick: Kurzsatz aus dem Thema", tipsOverview.length === 8 && tipsOverview.every((t) => shorts.has(t)), `${tipsOverview.filter((t) => shorts.has(t)).length}/${tipsOverview.length}`)
  check("Hilfe: Erklärung unter der Zeile „Datenlage“", !!A().querySelector(".coverage-block details.help[data-help='datenlage']"))
  check("Hilfe: anfangs zu", Array.from(A().querySelectorAll("details.help, details.formula")).every((d) => !d.open))
  $("toggle-help").click()
  check("Hilfe: Schalter öffnet alle", Array.from(A().querySelectorAll("details.help, details.glossary-card")).every((d) => d.open) && $("toggle-help").getAttribute("aria-pressed") === "true")
  tab("position")
  check("Hilfe: bleibt beim Reiterwechsel offen", Array.from(A().querySelectorAll("details.help")).every((d) => d.open))
  check("Hilfe: Formel bleibt zu, bis man sie aufklappt", Array.from(A().querySelectorAll("details.formula")).every((d) => !d.open) && A().querySelectorAll("details.formula").length > 0, `${A().querySelectorAll("details.formula").length} Formeln im Reiter Lage`)
  $("toggle-help").click()
  check("Hilfe: Schalter schließt alle", Array.from(A().querySelectorAll("details.help")).every((d) => !d.open))
  tab("overview")

  // ---------- Probe-Modus beim Tippen
  $("tap-probe").click()
  tap(0.5, 0.5)
  check("Probe-Modus: Schuss als P10", $("shot-rows").firstElementChild.firstElementChild.textContent === "P10" && $("hit-label").textContent === "Probe P10", $("hit-label").textContent)
  check("Probe-Modus: Ergebnis unverändert 40 Schuss", $("sum").textContent.includes("40 Schuss + 10 Probe"))
  $("tap-match").click()
  tap(0.5, 0.5)
  check("Wertung wieder: Schuss 41", $("hit-label").textContent === "Schuss 41", $("hit-label").textContent)

  // ---------- übrige Beispiele und Leerzustand
  const sample = $("sample")
  sample.value = "printout"
  sample.dispatchEvent(new Event("change"))
  check("Ausdruck: 6 Schuss, 6,2", rowsN() === 6 && $("hit-value").textContent === "6,2", rowsN() + " " + $("hit-value").textContent)
  check("Ausdruck: Teiler ab 1000 ohne Nachkomma", Array.from($("shot-rows").children).some((tr) => tr.children[3].textContent === "3831"), Array.from($("shot-rows").children).map((tr) => tr.children[3].textContent).join(" "))
  tab("overview")
  check("Ausdruck: Trend erst ab 10 Schuss", tile("#analysis", "Trend").hint === "ab 10 Schuss")
  const confPrint = S.mpiConfidence(match())
  check("Ausdruck: Lage wie Hotelling (anderer Zustand als LP 40)", tile("#analysis", "Lage").value === (confPrint.real ? "echt" : "unklar") && confPrint.real !== conf.real, `${tile("#analysis", "Lage").value}, T² ${confPrint.t2.toFixed(2)} / ${confPrint.critical.toFixed(2)}`)
  const obsPrint = Array.from(document.querySelectorAll("#analysis .observations li")).map((li) => txt(li))
  check("Ausdruck: Satz ohne Urteil zum Visier", obsPrint[0].includes(confPrint.real ? "echt" : "keinen Grund, das Visier zu verstellen"), obsPrint[0])
  $("pick-lg").click()
  await wait(50)
  check("LG: eigenes Beispiel mit Probe", rowsN() === 49 && Array.from(sample.options).map((o) => o.value).join() === "forty,series")
  check("LG: Quote ab 10,5", (tab("result"), txt(A()).includes("ab 10,5")))
  $("clear").click()
  await wait(50)
  check("Leer: Analyse sagt, was fehlt", txt(A()).includes("Noch keine Schüsse"))
  for (let i = 0; i < 3; i++) tap(0.5 + i * 0.01, 0.5)
  tab("overview")
  check("3 Schuss: σ da, Trend nicht", tile("#analysis", "Präzision σ").value !== "–" && tile("#analysis", "Trend").value === "–")
  for (const id of ["result", "precision", "position", "time", "sighters"]) tab(id)
  check("Alle Reiter mit 3 Schuss ohne Fehler", errors.length === 0, errors.join(" | "))

  // ---------- Bisherige Prüfungen (SP-1.2/1.3)
  $("pick-lp").click()
  sample.value = "printout"
  sample.dispatchEvent(new Event("change"))
  const w0 = vbW()
  check("Start: Schwerpunkt da", !!$("mpi"))
  const scale = Number(/scale\(([^)]+)\)/.exec($("mpi").getAttribute("transform"))[1])
  const pxR = scale / (vbW() / $("target").getBoundingClientRect().width)
  check("Schwerpunkt-Radius 5–8 px", pxR >= 5 && pxR <= 8, pxR.toFixed(2) + " px")
  $("mode-rings").click()
  check("Ringe: Ergebnis 49", $("sum").textContent.includes("Ergebnis 49"), $("sum").textContent)
  $("mode-decimal").click()
  check("Zehntel: Ergebnis 51,8", $("sum").textContent.includes("Ergebnis 51,8"), $("sum").textContent)
  $("view-group").click()
  await wait(600)
  check("Gruppe: Ausschnitt kleiner", vbW() < w0, `${vbW().toFixed(1)} < ${w0.toFixed(1)}`)
  $("view-target").click()
  await wait(600)
  check("Scheibe: Ausschnitt zurück", Math.abs(vbW() - w0) < 1e-6)
  check("Schwerpunkt liegt zuoberst", $("target").lastElementChild.id === "g-mpi")
  $("pdf-sample").click()
  await wait(1500)
  const pdfText = $("pdf-result").textContent
  check("PDF-Beispiel: ID und Druckzeit", pdfText.includes("ff914420") && pdfText.includes("02.10.2026, 19:52:12 (UTC+02:00)"), pdfText.slice(0, 120))
  check("Keine Skriptfehler", errors.length === 0, errors.join(" | "))
  const pre = document.createElement("pre"); pre.id = "dbg"; pre.textContent = log.join("\n"); document.body.appendChild(pre)
})
</script>
