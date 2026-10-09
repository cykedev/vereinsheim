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
    // Ebene 1 und 2 sprechen Alltag (U3, D1): Fachbegriffe stehen nur im Blatt „?“ und in den Reitern; seit U4 auch
    // kein „unklar“ mehr („Eingeschossen?“ entfiel); „rechts“ trifft `\becht` nicht
    // „95 %“ nur als Sicherheit („mit 95 %“, „95 %:“), nicht als Quote; „echt“ auch groß und gebeugt (Review U3)
    const JARGON =
      /σ|R50|T²|mit 95 ?%|95 ?%:|Median|P10|P90|mittlere Hälfte|bedeutsam|Hotelling|\b[Ee]cht(e[nmrs]?)?\b|\b[Uu]nklar\b|KW \d/
    // ohne Blätter (`<dialog>`): das der Labor-Werkzeuge spricht über das Labor („aus den echten Bausteinen“)
    const jargonIn = (...els) =>
      els
        .filter(Boolean)
        .map((el) => {
          const copy = el.cloneNode(true)
          copy.querySelectorAll("dialog").forEach((d) => d.remove())
          return txt(copy)
        })
        .join(" ")
        .match(JARGON)?.[0] ?? null
    // Wege sind seit N3 Links mit Adresse (`RouteLink`), gefunden nach Text oder Namen
    const link = (label, root = document) =>
      $$("a[href]", root).find(
        (a) => txt(a).trim() === label || a.getAttribute("aria-label") === label
      )
    // ein Bereich der Navigation (Plan N3): der sichtbare Eintrag des Rahmens mit diesem Text oder Namen
    const area = (label, root = document) =>
      $$("[data-app-frame] nav a", root).find(
        (a) =>
          a.offsetParent !== null &&
          (txt(a).trim() === label ||
            a.getAttribute("aria-label") === label ||
            a.getAttribute("aria-label")?.startsWith(`${label},`))
      )
    // das Blatt der Hilfe ist das letzte <dialog> der Seite; davor stehen das der Labor-Werkzeuge und je Seite weitere
    const helpSheet = () => $$("dialog").at(-1)
    // Knöpfe im Blatt der Labor-Werkzeuge (Beispielscheibe, Beispiel, Tippen, Neuer Schuss), auch geschlossen; nur dort
    // gesucht, damit ein gleich benannter Knopf der Seite (Reiter „Probe“) nicht dazwischenkommt (Review)
    const inLabor = (label) => button(label, $("[data-labor-panel]"))
    // die Darstellung unten in der Seitenleiste
    const sideTheme = (label) => button(label, $("[data-app-sidebar] [data-theme-switch]"))
    const zoom = () => button("Auf Gruppe zoomen")
    // Adressen (Plan N1): die Zeile im Kopf, in Teile wie `location`, hin und zurück über den Prüfhaken
    const addr = () => txt($("[data-address]")).trim()
    const urlParts = (url) => {
      const h = url.indexOf("#")
      const hash = h < 0 ? "" : url.slice(h)
      const rest = h < 0 ? url : url.slice(0, h)
      const q = rest.indexOf("?")
      return q < 0 ? [rest, "", hash] : [rest.slice(0, q), rest.slice(q), hash]
    }
    const seenAddresses = new Set()
    const routeOf = (url) => {
      seenAddresses.add(url)
      return L().tools.nav.routeFromUrl(...urlParts(url))
    }
    const sortKeys = (v) =>
      Array.isArray(v)
        ? v.map(sortKeys)
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.keys(v)
                .sort()
                .map((k) => [k, sortKeys(v[k])])
            )
          : v
    const same = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b))
    const click = async (el, ms = 60) => {
      // abbrechbar wie ein echter Klick: sonst folgt der Browser einem Link trotz `preventDefault` (N3)
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
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
    const tableRows = () => $$("#shot-table tr[data-row]")
    // Pausen über drei Minuten als m:ss, nicht auf ganze Minuten gerundet (Prüfung, Zeit 7)
    const intervalText = (ms) => {
      if (ms === null) return "–"
      if (ms <= 180000) return `${L().tools.formatValue(ms / 1000, 0)} s`
      const seconds = Math.round(ms / 1000)
      return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} min`
    }

    await wait(400)

    // ---------- Kopf und Ausgangslage (LP, 40 Schuss wie am Ausdruck, U4)
    // ohne Labor-Kopf steht der Kopf der Seite oben (Inhalt beginnt nach 28 px Abstand); mit dem alten Kopf lag er
    // weit über 200 px tiefer
    const pageHeadTop = (selector) => {
      scrollTo(0, 0)
      return Math.round($(selector)?.getBoundingClientRect().top ?? 999)
    }
    const sampleHeadTop = pageHeadTop("[data-card-header]")
    check(
      "Labor: der Stand steht im Blatt der Labor-Werkzeuge, die Beispielscheibe beginnt oben mit ihrem Kopf",
      /Stand [0-9a-f]{7}/.test(txt($("[data-labor-panel]"))) && sampleHeadTop < 80,
      `${txt($("[data-labor-panel]")).slice(0, 20)} · Kopf ${sampleHeadTop}`
    )
    const [x0, , w0] = view()
    check(
      "Scheibe: ganze LP-Scheibe im Ausschnitt",
      near(w0, 171.05, 1e-6) && near(x0, -85.525, 1e-6),
      `${w0}`
    )
    check(
      "Scheibe: 40 Treffer, 1 bis 40, keine Probe neben Wertung (U4: wie am Ausdruck)",
      labelsOf(hits()).join() === Array.from({ length: 40 }, (_, i) => `${i + 1}`).join() &&
        hits().every((g) => circleOf(g).getAttribute("fill") !== "none")
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
    const gapAll = spreadGapPx(hits())
    check(
      "Streukreis um die Treffer, 2 px Luft",
      gapAll !== null && near(gapAll, 2, 0.05),
      gapAll?.toFixed(3)
    )
    check("Ablesung: letzter Schuss", txt($("#readout")).includes("Schuss 40 · letzter Schuss"))
    const head = () => txt($("[data-card-header]"))
    check(
      "Kopf: Ergebnis 365,2, 40 Schuss ohne Probe und 9 Zehner wie in der Spielwiese",
      txt($("[data-result]")).includes("365,2") &&
        head().includes("40 Schuss") &&
        !head().includes("Probe") &&
        /Zehner\s*9/.test(head()),
      head().slice(0, 160)
    )
    check(
      "Ablesung: Teiler und Abstand, kein x/y",
      /Teiler\s*\d/.test(txt($("#readout"))) &&
        txt($("#readout")).includes("Abstand zur Mitte") &&
        !txt($("#readout")).includes("x / y")
    )

    // ---------- „Zahlen“ entfiel (U1): kein Abschnitt, keine Kacheln „Trefferbild in Zahlen“; der Überblick der
    // Analyse ist die Zahlen-Ansicht
    check("Prüfhaken des Labors da", !!L() && L().shots.length === 40)
    check(
      "U1: keine Kacheln „Trefferbild in Zahlen“, kein Abschnitt #numbers",
      !$('section[aria-label="Trefferbild in Zahlen"]') &&
        !$("[data-metric]") &&
        !document.getElementById("numbers") &&
        $$('nav[aria-label="Abschnitte"] a').map(txt).join() === "Scheibe,Schüsse,Analyse"
    )
    // Kacheln des Überblicks in Zeilen
    const tileRows = (root) => {
      const rows = new Map()
      for (const t of $$('section[aria-label="Analyse"] [data-tile]', root)) {
        const top = Math.round(t.getBoundingClientRect().top)
        rows.set(top, (rows.get(top) ?? 0) + 1)
      }
      return [...rows.values()]
    }
    // der Kopf: die wichtigsten Beobachtungen wie im Paket gerechnet, die Lage zuerst (U1, D4)
    const headObservations = $$("[data-card-header] [data-observation]")
    const keyExpected = L().tools.keyObservations(
      L().tools.observations(L().tools.analysisInput(L().shots, L().state.scoring, L().target))
    )
    check(
      "Kopf: die wichtigsten Beobachtungen, Lage und Ausreißer Schuss 27, je ein Satz",
      headObservations.length === 2 &&
        keyExpected.length === 2 &&
        headObservations.every(
          (li, i) =>
            li.dataset.observation === keyExpected[i].icon && txt(li) === keyExpected[i].text
        ) &&
        keyExpected[0].icon === "position" &&
        txt(headObservations[1]) === "Schuss 27 fällt als Ausreißer aus der Gruppe." &&
        !!$("[data-card-header] [data-more-observations]"),
      headObservations.map(txt).join(" | ")
    )

    // ---------- Grundauswahl: die ganze Scheibe (U4: kein „Ohne Probe“, keine Probe-Kachel)
    check(
      "Grundauswahl: die ganze Scheibe, „Alle“ gedrückt, kein „Ohne Probe“, keine Probe-Kachel",
      L().state.selection === "all" &&
        !button("Ohne Probe") &&
        !$('[data-series="probe"]') &&
        button("Alle").getAttribute("aria-pressed") === "true" &&
        hits().every((g) => !g.dataset.faded)
    )

    // ---------- Schusstabelle
    const labelsAll = L().tools.shotLabels(L().shots)
    const intervalsAll = L().tools.shotIntervals(L().shots)
    check(
      "Tabelle: 40 Zeilen, neuester oben, Schuss 1 unten",
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

    // ---------- Antippen (am Abreißer Schuss 27, der abseits liegt; bis U4 an der Probe P1)
    // Ein Tipp wählt den nächsten Treffer der Auswahl, bis 20 px neben seiner Mitte: Auf dem Handy misst ein
    // Treffer auf der ganzen Scheibe nur wenige Pixel. Chrome kürzt synthetische Koordinaten auf ganze Pixel.
    await tapAt(centerOf("27"))
    check(
      "Tipp auf die Mitte eines Treffers wählt ihn",
      txt($("#readout")).includes("Schuss 27 · angetippt"),
      txt($("#readout")).slice(0, 40)
    )
    await tapAt(centerOf("27"))
    const nextTo27 = beside("27", 14)
    if (nextTo27) await tapAt(nextTo27)
    check(
      "Tipp 14 px neben einen Treffer wählt ihn",
      !!nextTo27 && txt($("#readout")).includes("Schuss 27 · angetippt"),
      nextTo27 ? txt($("#readout")).slice(0, 40) : "keine freie Stelle neben Schuss 27"
    )
    if (nextTo27) await tapAt(nextTo27)
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
      "Adresse: Beispiel ohne Herkunft, Serie 2 steht darin",
      /^\/cards\/lp-10m-forty\?series=2(&|#|$)/.test(addr()) && routeOf(addr()).selection === 2,
      addr()
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
      "dieselbe Serie noch einmal führt zur ganzen Scheibe zurück",
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
      "Serien: vier Serien, keine Probe-Kachel (U4)",
      tiles.map((t) => t.dataset.series).join() === "1,2,3,4"
    )
    const boxes = new Set(tiles.map((t) => $("svg", t).getAttribute("viewBox")))
    check("Serien: alle im selben Ausschnitt", boxes.size === 1)
    // Probe-Eck nur an einem Training nur aus Probe (Abschnitt „Nur Probe“), nie an einer Scheibe mit Wertung
    check(
      "Probe-Eck: weder an den Serien noch an der Scheibe einer Wertung",
      tiles.every((t) => !$("[data-probe-corner]", t)) && !$("[data-probe-corner]", svg())
    )
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

    // ---------- Setzen
    const laborKnob = () => $("[data-labor-button]")
    const idleKnob = [laborKnob().getAttribute("aria-label"), laborKnob().dataset.active]
    await click(inLabor("Setzen"))
    check(
      "Labor: „Setzen“ wirkt bei geschlossenem Blatt weiter, der Knopf zeigt es (Name und Punkt)",
      idleKnob[0] === "Labor-Werkzeuge" &&
        idleKnob[1] === undefined &&
        laborKnob().getAttribute("aria-label") === "Labor-Werkzeuge, Setzen aktiv" &&
        laborKnob().dataset.active === "Setzen" &&
        !!laborKnob().querySelector("span.bg-primary"),
      `${idleKnob.join("/")} → ${laborKnob().getAttribute("aria-label")}`
    )
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
    await click(inLabor("Ansehen"))
    check(
      "Labor: mit „Ansehen“ ist der Knopf wieder neutral",
      laborKnob().getAttribute("aria-label") === "Labor-Werkzeuge" &&
        laborKnob().dataset.active === undefined &&
        !laborKnob().querySelector("span.bg-primary")
    )

    // ---------- leere Scheibe Schuss für Schuss: die Serienleiste erscheint erst mit dem ersten Schuss und
    // misst dann ihre Breite (sonst stünden die Kacheln in schmalen Zeilen für 300 px)
    await click(inLabor("Leer"), 100)
    check(
      "Leer: keine Treffer, statt leerer Kästen nur der Hinweis neben der Scheibe",
      hits().length === 0 &&
        $$("[data-series]").length === 0 &&
        txt($("[data-no-shots]")).includes("Noch kein Schuss") &&
        ["readout", "series", "shot-table", "analysis"].every((id) => !$(`#${id}`)) &&
        !$('nav[aria-label="Abschnitte"]') &&
        !$("[data-result]")
    )
    await click(inLabor("Setzen"))
    const setAt = async (x, y) => {
      const p = new DOMPoint(x, y).matrixTransform(svg().getScreenCTM())
      svg().dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: p.x, clientY: p.y }))
      await wait(30)
    }
    await click(inLabor("Probe"))
    await setAt(4, -4)
    await click(inLabor("Wertung"))
    for (let i = 0; i < 31; i++) await setAt(((i % 7) - 3) * 2, (Math.floor(i / 7) - 2) * 2)
    await wait(200)
    const fresh = $$("[data-series]")
    const freshRows = new Set(fresh.map((t) => Math.round(t.getBoundingClientRect().top)))
    // der Probeschuss vor der Wertung fällt weg wie am Ausdruck (U4): vier Serien, keine Probe-Kachel
    check(
      "Leer gesetzt: vier Serien in einer Zeile, der Probeschuss vor der Wertung fällt weg",
      fresh.map((t) => t.dataset.series).join() === "1,2,3,4" &&
        freshRows.size === 1 &&
        hits().length === 31,
      `${fresh.length} Kacheln, ${freshRows.size} Zeilen, ${hits().length} Treffer`
    )
    await click(inLabor("Ansehen"))
    await click(inLabor("40 Schuss"), 100)

    // ---------- nur Probe (Training): wie Wertung, bis eine Wertung dazukommt
    await click(inLabor("60 Probe"), 100)
    check(
      "Nur Probe: Schüsse 1 bis 60, gefüllt wie Wertung, mit Probe-Eck auf Scheibe und Serien",
      labelsOf(hits()).join() === Array.from({ length: 60 }, (_, i) => `${i + 1}`).join() &&
        hits().every((g) => circleOf(g).getAttribute("fill") !== "none") &&
        !!$("[data-probe-corner]", svg()) &&
        $$("[data-series]").every((t) => !!$("[data-probe-corner]", t))
    )
    // das Eck oben rechts auf der Scheibe, wie es Konvention ist (bis U4 an der gewählten Probe geprüft)
    const corner = $("[data-probe-corner]", svg())
    const cornerBox = corner?.getBoundingClientRect()
    const svgBox = svg().getBoundingClientRect()
    check(
      "Probe-Eck: oben rechts auf der Scheibe, in der Farbe des Spiegels",
      !!corner &&
        near(cornerBox.right, svgBox.right, 1) &&
        near(cornerBox.top, svgBox.top, 1) &&
        corner.getAttribute("fill") === "var(--spiegel)",
      corner ? `${cornerBox.right.toFixed(0)}/${svgBox.right.toFixed(0)}` : "kein Eck"
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
    // eine Wertung dazu: wie am Ausdruck löscht der erste Wertungsschuss die Probe (U4)
    await click(inLabor("Setzen"))
    await click(inLabor("Wertung"))
    await setAt(0, 0)
    check(
      "Nur Probe plus eine Wertung: wie am Ausdruck nur noch die Wertung, ohne Probe-Eck; der neue Schuss ploppt",
      labelsOf(hits()).join() === "1" &&
        !!$('[data-shot="1"] circle.shot-ui-pop', svg()) &&
        $$("[data-series]")
          .map((t) => t.dataset.series)
          .join() === "1" &&
        !$("[data-probe-corner]", svg()),
      `${labelsOf(hits()).join()} · ${$$("[data-series]")
        .map((t) => t.dataset.series)
        .join()}`
    )
    await click(inLabor("Ansehen"))
    await click(inLabor("40 Schuss"), 100)

    // ---------- Wertung, Scheibe, Thema
    await click(button("Ganze Ringe"))
    const seriesValues = $$("[data-series] b").map((b) => txt(b).trim())
    check(
      "Ganze Ringe: Serien als ganze Zahlen",
      seriesValues.every((v) => /^\d+$/.test(v)),
      seriesValues.join(" ")
    )
    check(
      "Ganze Ringe: Überblick, Kopf und Tabelle in Ringen",
      L().state.scoring === "rings" &&
        /^\d+$/.test(txt($('[data-tile="Ergebnis"]').children[1].childNodes[0]).trim()) &&
        /^\d+(?![\d,])/.test(txt($("[data-result]")).trim()) &&
        txt($("#shot-table th:nth-child(2)")) === "Ring",
      txt($('[data-tile="Ergebnis"]'))
    )
    check(
      "amtliche Wertung bleibt als Hinweis (im Kopf der Scheibe)",
      txt($("[data-result]").closest("[data-card-header]")).includes("amtlich: Zehntel")
    )
    await click(button("Zehntel"))
    // eine andere Scheibe steht sofort, ohne Gleiten
    await click(inLabor("Luftgewehr"), 60)
    const [, , wLg] = view()
    check(
      "Luftgewehr: eigene Scheibe, Zehnerserie wählbar",
      near(wLg, 53.5, 1e-6) && !!inLabor("Zehnerserie"),
      `${wLg}`
    )
    await click(inLabor("Zehnerserie"))
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
    await click(inLabor("Luftpistole"), 60)
    // eine andere Karte derselben Scheibe steht ebenso sofort: aus der Gruppe direkt auf die ganze Scheibe
    await click(zoom(), 700)
    const [, , wGroup] = view()
    await click(inLabor("Ausdruck vom 2. Oktober"), 60)
    const [, , wNext] = view()
    check(
      "andere Karte derselben Scheibe: sofort im neuen Ausschnitt",
      wGroup < 171 && near(wNext, 171.05, 1e-6),
      `${wGroup.toFixed(2)} → ${wNext}`
    )
    await click(inLabor("40 Schuss"), 60)
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
    await click(sideTheme("Dunkel"))
    check(
      "Thema dunkel: Seite dunkel, Schrift aus dem Design",
      document.documentElement.classList.contains("dark") &&
        page().backgroundColor === tokenColor("background") &&
        page().backgroundColor !== "rgb(247, 247, 245)" &&
        page().fontFamily.includes("Geist"),
      `${page().backgroundColor} / ${tokenColor("background")}, ${page().fontFamily.slice(0, 20)}`
    )
    await click(sideTheme("Hell"))
    check(
      "Thema hell: Seite hell aus dem Design",
      !document.documentElement.classList.contains("dark") &&
        page().backgroundColor === tokenColor("background"),
      `${page().backgroundColor} / ${tokenColor("background")}`
    )
    await click(sideTheme("System"))

    // ---------- Hilfe
    // Plan Schritt 4, D3: Erklärungen als Blatt über „?“, der Schalter zeigt nur Kurzsätze
    check(
      "Erklärungen aus: keine Kurzsätze, kein „Was heißt das?“ mehr auf der Seite",
      $$("[data-short]").length === 0 && $$("details[data-help]").length === 0
    )
    await click(button("Erklärungen", $("[data-analysis-head]")))
    check(
      "Erklärungen an: der Schalter steht im Kopf der Analyse, Kurzsätze an den acht Kacheln des Überblicks",
      $$('section[aria-label="Analyse"] [data-tile] [data-short]').length === 8
    )
    await click(button("Erklärungen", $("[data-analysis-head]")))
    check("Erklärungen wieder aus", $$("[data-short]").length === 0)
    const targetHelpButton = $('#target button[data-help="trefferbild"]')
    await click(targetHelpButton, 100)
    check(
      "„?“ an der Scheibe öffnet die Erklärung „Trefferbild“ als Blatt",
      !!helpSheet()?.open && txt($("h2", helpSheet())).startsWith("Trefferbild"),
      txt($("h2", helpSheet()))
    )
    await click($('button[aria-label="Schließen"]', helpSheet()), 100)

    // die Erklärung einer Kennzahl am „?“ ihrer Kachel im Überblick (seit U1 die Zahlen-Ansicht der Seite)
    const sigmaHelp = () =>
      $('section[aria-label="Analyse"] [data-tile="Streuung"] button[aria-label^="Erklärung"]')
    const sheet = () => helpSheet()
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
    // fünf Reiter, kein Reiter „Probe“ (U4: wie am Ausdruck)
    const TABS = ["Überblick", "Ergebnis", "Präzision", "Lage", "Zeit und Verlauf"]
    await click(inLabor("Luftpistole"), 150)
    await click(inLabor("40 Schuss"), 150)
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
      "Analyse: fünf Reiter in der Reihenfolge der Spielwiese, kein Reiter „Probe“",
      $$('[role="radio"]', tabBar())
        .map((b) => txt(b))
        .join() === TABS.join()
    )

    // keine Verweise in den Katalog („E1 · E2“) im Kopf der Karten, in keinem Reiter (User, 9. Oktober 2026)
    const catalogHeads = (root) =>
      $$("[data-card] h3", root)
        .filter((h) => /\b[A-Z]\d{1,2}\b/.test(txt(h)) || !!h.querySelector(".font-mono"))
        .map((h) => txt(h))
    const cardHeads = []
    for (const label of TABS) {
      await tab(label)
      cardHeads.push(...$$("[data-card] h3", A()))
      cardHeads.push(...catalogHeads(A()).map((t) => `!${t}`))
    }
    check(
      "Analyse: keine Katalog-Verweise im Kopf der Karten, in allen sechs Reitern",
      cardHeads.length > 20 && !cardHeads.some((h) => typeof h === "string"),
      cardHeads
        .filter((h) => typeof h === "string")
        .slice(0, 3)
        .join(" | ") || `${cardHeads.length} Karten`
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
      "Überblick: Ergebnis und Streuung (σ) direkt aus dem Fachkern",
      ovValue("Ergebnis") === nf(resultTotal, 1) &&
        ovValue("Streuung") === nf(S().sigmaEstimate(base()).sigma / 1000, 2),
      `${ovValue("Ergebnis")} · ${ovValue("Streuung")}`
    )
    // die Lage in Alltagsworten (U3, D11): „versetzt“ mit Richtung oder „passt“, nie „echt“ oder „unklar“
    const lageConf = S().mpiConfidence(base())
    check(
      "Überblick: Lage „versetzt“ mit Richtung oder „passt“",
      ovValue("Lage") === (lageConf.real ? "versetzt" : "passt") &&
        ovHint("Lage") ===
          (lageConf.real ? L().tools.directionName(lageConf.center) : "kein Versatz belegt"),
      `${ovValue("Lage")} · ${ovHint("Lage")}`
    )
    // ein Lage-Anteil bis null heißt „kostet nichts“, nie ein Gewinn (U3, D10)
    const lossSplit = S().ringLossSplit(base(), L().target)
    const lossPosition = lossSplit.positionLoss.decimal
    // gerundet wie gezeigt; kostet die Lage nichts, trägt die Streuung den ganzen Ringverlust (Review U3)
    const lossFree = Math.round(lossPosition * 10) <= 0
    const lossSpread = lossFree
      ? lossSplit.spreadLoss.decimal + lossPosition
      : lossSplit.spreadLoss.decimal
    check(
      "Überblick: Ringverlust nennt die Lage mit Zahl oder „Lage kostet nichts“, beide ergeben den Ringverlust",
      ovHint("Ringverlust").startsWith(
        `${lossFree ? "Lage kostet nichts" : `Lage ${nf(lossPosition, 1)}`} · Streuung ${nf(lossSpread, 1)}`
      ) &&
        (lossSplit.total === null ||
          Math.abs((lossFree ? 0 : lossPosition) + lossSpread - lossSplit.total.decimal) < 1e-9),
      ovHint("Ringverlust")
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
      (conf.real
        ? /^Deine Gruppe liegt .* das ist sicher kein Zufall\./
        : /das kann Zufall sein/
      ).test(sentences[0]),
      sentences[0]
    )
    check(
      "Beobachtungen: Pause vor Schuss 21 erkannt",
      sentences.some((s) => s.includes("Pause vor Schuss 21"))
    )
    // Kopf und Überblick ohne Fachbegriffe (U3, D1)
    const cardJargon = jargonIn(
      $("[data-card-header]"),
      ...$$("[data-tile]", A()),
      ...$$("[data-observation]", A())
    )
    check(
      "Kopf und Überblick: keine Fachbegriffe (σ, R50, T², 95 %, Median, echt)",
      !cardJargon,
      cardJargon ?? ""
    )
    // der Gewinn in der Mitte ist eine Summe: mit n und je Schuss, ohne Visier (Prüfung, Ergebnis 1, D1)
    const split = S().ringLossSplit(base(), L().target)
    const gain = split.positionLoss.decimal
    check(
      "Beobachtungen: Lage-Satz mit n und je Schuss, kein Visier",
      split.reliable &&
        sentences[0].includes(
          `Läge die Gruppe in der Mitte, brächten ${split.n} weitere Schuss zusammen etwa ${nf(gain, 1)} Ringe mehr (rund ${nf(gain / split.n, 2)} je Schuss).`
        ) &&
        !/Visier/.test(sentences.join(" ")),
      sentences[0]
    )
    // U4, D6: die Ausreißer statt „Eingeschossen?“: wie viele und welche, wie der Fachkern sie markiert
    // die Kachel zählt nur, welche es sind, steht in Kopf und Beobachtung (Review U4, wie die Lage in U3)
    const flaggedTile = S().outliers(base())
    const flaggedCount = flaggedTile?.flagged.length ?? -1
    check(
      "Überblick: „Ausreißer“ zählt die markierten Schüsse, ohne Nummern, kein „Eingeschossen?“",
      !!flaggedTile &&
        ovValue("Ausreißer") === (flaggedCount ? String(flaggedCount) : "keiner") &&
        ovHint("Ausreißer") ===
          (flaggedCount > 1 ? "fallen aus der Gruppe" : "fällt aus der Gruppe") &&
        !ovTile("Eingeschossen?"),
      `${ovValue("Ausreißer")} · ${ovHint("Ausreißer")}`
    )
    check(
      "Datenlage-Zeile",
      txt($("[data-coverage] p", A())).startsWith(
        "Datenlage: 40 Wertungsschüsse · alle mit Lage, Zeit und Wert"
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
    // E10 als Standardabweichung je Schuss, nicht als MAD (User, 9. Oktober 2026)
    const consistency = S().seriesConsistency(base(), "decimal")
    check(
      "Ergebnis: Abweichung je Schuss (SD) statt MAD",
      ctext("serien-und-konstanz").includes(
        `Abweichung je Schuss${nf(consistency.shotSd, 2)} Ringe (SD)`
      ) && !ctext("serien-und-konstanz").includes("MAD"),
      ctext("serien-und-konstanz")
    )
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
    await click(inLabor("Luftgewehr"), 200)
    await click(inLabor("Zwei Abreißer"), 200)
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
    await click(inLabor("Luftpistole"), 200)
    await click(inLabor("40 Schuss"), 200)

    await tab("Lage")
    check(
      "Adresse: der Reiter Lage als Anker",
      addr().endsWith("#position") && routeOf(addr()).anchor?.tab === "position",
      addr()
    )
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
      ctext("drift-und-wanderung").includes(nf(S().drift(base(), input().card).vonNeumann, 2))
    )
    check(
      "Lage: „Gruppe in der Mitte“ statt korrigiertem Visier",
      ctext("ringverlust-nach-ursache").includes(
        `Gruppe in der Mitte${nf(split.centered.decimal, 1)} Ringe`
      ) && !/Visier|Korrektur/.test(txt(A())),
      ctext("ringverlust-nach-ursache")
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

    // ---------- Lineal (Plan L1): Antippen, Ziehen, zweites Tippen, „Auf der Scheibe“, Kopplung, Tabellen
    const courseSvg = () =>
      $('svg[aria-label="Wert je Schuss mit gleitendem Schnitt"]', card("verlauf-und-trend"))
    const courseLine = () => txt($("[data-readout]", card("verlauf-und-trend")))
    const pointAt = (n) => Number($(`[data-course-point="${n}"]`, courseSvg()).getAttribute("cx"))
    const pointer = async (type, n, root = courseSvg(), x = pointAt(n)) => {
      const r = root.getBoundingClientRect()
      const clientX = r.left + (x / root.viewBox.baseVal.width) * r.width
      root.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX,
          clientY: r.top + r.height / 2,
          pointerId: 1,
        })
      )
      await wait(30)
    }
    const tapPoint = async (n) => {
      await pointer("pointerdown", n)
      await pointer("pointerup", n)
    }
    check("Lineal: ohne Wahl der Hinweis", courseLine().includes("Tippe oder ziehe im Diagramm"))
    // Ziehen mit der Maus beginnt keine Textauswahl; Diagramm und Scheibe sind nicht markierbar (User, 9. Oktober 2026)
    const mouseDown = new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerType: "mouse",
      button: 0,
      pointerId: 7,
      clientX: courseSvg().getBoundingClientRect().left + 10,
      clientY: courseSvg().getBoundingClientRect().top + 10,
    })
    courseSvg().dispatchEvent(mouseDown)
    courseSvg().dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse", pointerId: 7 })
    )
    await wait(30)
    const unselectable = (el) => !!el && getComputedStyle(el).userSelect === "none"
    check(
      "Diagramme: Ziehen mit der Maus markiert keinen Text, Diagramm samt Rahmen und Scheibe nicht markierbar",
      mouseDown.defaultPrevented &&
        document.activeElement === courseSvg() &&
        unselectable(courseSvg()) &&
        unselectable(courseSvg().parentElement) &&
        unselectable(svg()),
      `${mouseDown.defaultPrevented} ${document.activeElement?.tagName} ${getComputedStyle(courseSvg().parentElement).userSelect}`
    )
    // die Wahl dieses Klicks wieder aufheben, damit die folgenden Prüfungen ohne Wahl beginnen
    if (!courseLine().includes("Tippe oder ziehe im Diagramm")) {
      courseSvg().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
      await wait(30)
    }
    await tapPoint(23)
    check(
      "Lineal: Antippen von Punkt 23 nennt ihn und zeigt die Linie",
      courseLine().includes("Schuss 23 · ") && !!$("[data-ruler]", courseSvg()),
      courseLine().slice(0, 60)
    )
    await pointer("pointerdown", 10)
    await pointer("pointermove", 20)
    await pointer("pointermove", 30)
    await pointer("pointerup", 30)
    check(
      "Lineal: Ziehen von 10 bis 30 wandert mit",
      courseLine().includes("Schuss 30 · "),
      courseLine().slice(0, 40)
    )
    await tapPoint(30)
    check(
      "Lineal: zweites Tippen auf denselben Punkt hebt die Wahl auf",
      courseLine().includes("Tippe oder ziehe") && !$("[data-ruler]", courseSvg())
    )
    await tapPoint(14)
    await click(button("Auf der Scheibe", card("verlauf-und-trend")), 120)
    check(
      "Lineal: „Auf der Scheibe“ wählt Schuss 14 dort",
      txt($("#readout")).includes("Schuss 14 · angetippt"),
      txt($("#readout")).slice(0, 40)
    )
    await click(button("Auf der Scheibe", card("verlauf-und-trend")), 120)
    check(
      "Lineal: noch einmal „Auf der Scheibe“ lässt ihn gewählt",
      txt($("#readout")).includes("Schuss 14 · angetippt")
    )
    // Tastatur: das Diagramm hat den Fokus; Pfeile und Ränder wandern, Escape hebt auf, fremde Tasten bleiben frei
    const keyOn = (el, key, extra = {}) => {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra })
      el.dispatchEvent(event)
      return event.defaultPrevented
    }
    courseSvg().focus()
    keyOn(courseSvg(), "ArrowRight")
    await wait(30)
    const afterRight = courseLine()
    keyOn(courseSvg(), "End")
    await wait(30)
    const afterEnd = courseLine()
    const altTaken = keyOn(courseSvg(), "ArrowLeft", { altKey: true })
    await wait(30)
    const afterAlt = courseLine()
    const downTaken = keyOn(courseSvg(), "ArrowDown")
    keyOn(courseSvg(), "Escape")
    await wait(30)
    const afterEscape = courseLine()
    const escapeTaken = keyOn(courseSvg(), "Escape")
    check(
      "Lineal: Tastatur wandert, Escape hebt auf; Alt+Pfeil, Pfeil runter und Escape ohne Wahl bleiben dem Browser",
      document.activeElement === courseSvg() &&
        afterRight.includes("Schuss 15 · ") &&
        afterEnd.includes("Schuss 40 · ") &&
        !altTaken &&
        afterAlt.includes("Schuss 40 · ") &&
        !downTaken &&
        afterEscape.includes("Tippe oder ziehe") &&
        !escapeTaken,
      [afterRight, afterEnd, afterAlt, afterEscape].map((t) => t.slice(0, 10)).join(" | ")
    )
    const beforeHover = courseLine()
    await pointer("pointermove", 30)
    check("Lineal: Überfahren ohne Druck wählt nichts", courseLine() === beforeHover)
    await tapPoint(20)
    await pointer("pointerdown", 8)
    await pointer("pointercancel", 8)
    check(
      "Lineal: übernimmt der Browser das Scrollen (pointercancel), gilt die Wahl davor",
      courseLine().includes("Schuss 20 · "),
      courseLine().slice(0, 24)
    )
    await click(
      $$("#shot-table button").find((b) => b.getAttribute("aria-label") === "Schuss 15 wählen"),
      150
    )
    check(
      "Lineal: ein auf der Scheibe gewählter Schuss steht im Verlauf und im Rhythmus",
      !!$('[data-course-point="15"][data-chosen]', courseSvg()) &&
        !!$('[data-interval="15"][data-chosen]', card("rhythmus")) &&
        courseLine().includes("Schuss 15 · "),
      courseLine().slice(0, 24)
    )
    check(
      "Lineal: Verlauf und Rhythmus scrollen senkrecht weiter (touch-action)",
      [courseSvg(), $('svg[aria-label="Abstände zwischen den Schüssen"]', card("rhythmus"))].every(
        (el) => getComputedStyle(el).touchAction === "pan-y"
      )
    )
    // eine Wahl im Lineal gehört zu ihrer Karte: Schuss 15 auf der Scheibe abwählen (ohne Vorgabe der Scheibe),
    // Punkt 33 antippen, andere Karte → der Hinweis, nicht Schuss 33 der neuen Karte
    await click(
      $$("#shot-table button").find((b) => b.getAttribute("aria-label") === "Schuss 15 wählen"),
      150
    )
    await tapPoint(33)
    const before33 = courseLine()
    await click(inLabor("Luftgewehr"), 150)
    check(
      "Lineal: eine Wahl bleibt bei ihrer Karte, die neue Karte fängt ohne Wahl an",
      before33.includes("Schuss 33 · ") && courseLine().includes("Tippe oder ziehe"),
      `${before33.slice(0, 12)} → ${courseLine().slice(0, 16)}`
    )
    await click(inLabor("Luftpistole"), 150)
    await tab("Ergebnis")
    const lastBar = $$("[data-tenth]", $('svg[aria-label^="Zehntelverteilung"]', A())).at(-1)
    await pointer(
      "pointerdown",
      null,
      lastBar.ownerSVGElement,
      Number(lastBar.getAttribute("x")) + Number(lastBar.getAttribute("width")) / 2
    )
    await pointer(
      "pointerup",
      null,
      lastBar.ownerSVGElement,
      Number(lastBar.getAttribute("x")) + Number(lastBar.getAttribute("width")) / 2
    )
    const barLine = txt($("[data-readout]", lastBar.ownerSVGElement.parentElement))
    await click(inLabor("Luftgewehr"), 150)
    await click(inLabor("Zehnerserie"), 150)
    const freshLine = txt(
      $("[data-readout]", $('svg[aria-label^="Zehntelverteilung"]', A()).parentElement)
    )
    check(
      "Lineal: nach einem Kartenwechsel ohne alte Wahl, nirgends NaN",
      / Schuss$/.test(barLine) &&
        freshLine.includes("Tippe oder ziehe") &&
        !/NaN|undefined/.test(txt(A())),
      `${barLine} → ${freshLine.slice(0, 20)}`
    )
    await click(inLabor("Luftpistole"), 150)
    await click(inLabor("40 Schuss"), 150)
    const decimalSvg = $('svg[aria-label^="Zehntelverteilung"]', A())
    check(
      "Tabelle: Zehntel-Säulen, eine Zeile je belegtem Zehntel",
      $$("tbody tr", decimalSvg.parentElement).length === $$("[data-tenth]", decimalSvg).length &&
        getComputedStyle(decimalSvg).touchAction === "pan-y",
      `${$$("tbody tr", decimalSvg.parentElement).length} / ${$$("[data-tenth]", decimalSvg).length}`
    )
    await tab("Lage")
    const clockSvg = $('svg[aria-label="Richtungsuhr"]', A())
    check(
      "Tabelle: Richtungsuhr, eine Zeile je belegter Stunde",
      $$("tbody tr", clockSvg.parentElement).length === $$("[data-hour]", clockSvg).length,
      `${$$("tbody tr", clockSvg.parentElement).length} / ${$$("[data-hour]", clockSvg).length}`
    )

    check("keine Visierverstellung auf der Seite", !/Verstellung|verstellt|Visier/.test(pageText()))

    // Abstände: zwischen Blöcken und Karten 16 px, Karten einer Zeile mit gleicher Unterkante
    const BOXES =
      'article, details[data-guide-card], details[data-glossary], details[data-fallacies], [data-coverage], div:has(> [data-tile]), section[aria-label="Analyse"] > div:first-child, section[aria-label="Analyse"] > div:has(> [role="radiogroup"])'
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
        !helpSheet().open ||
        txt($("h2", helpSheet())) !== entry.title ||
        !txt(helpSheet()).includes(entry.what)
      ) {
        sheetProblems.push(`${label}: ${id}`)
      }
      await click($('button[aria-label="Schließen"]', helpSheet()), 100)
    }
    check("Hilfe: jede Karte hat ihr „?“", withoutHelp.length === 0, withoutHelp.join(", "))
    const wantedHelp = [
      // die Themen über viele Scheiben gehören auf die Seite eines Zeitraums (L3)
      ...T()
        .HELP_TOPICS.filter((t) => t.theme !== "period")
        .map((t) => t.id),
      "beobachtungen",
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
      "Hilfe: Einstieg, Glossar und Fehlschlüsse anfangs zu",
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
    await click(inLabor("60 Probe"), 200)
    await tab("Ergebnis")
    check(
      "60 Probe: volle Analyse über die Probe, sechs Serien",
      txt($("p", A())).includes("über alle Probeschüsse") &&
        ctext("ergebnis").includes("Schuss60") &&
        $$("[data-series-point]", A()).length === 6,
      txt($("p", A()))
    )
    await click(inLabor("Ausdruck vom 2. Oktober"), 200)
    await tab("Überblick")
    check(
      "Ausdruck: Trend erst ab 10 Schuss",
      ovValue("Trend") === "–" && ovHint("Trend") === "ab 10 Schuss",
      `${ovValue("Trend")} ${ovHint("Trend")}`
    )
    await click(inLabor("Leer"), 200)
    check("Leer: keine Analyse, der Hinweis neben der Scheibe", !A() && !!$("[data-no-shots]"))
    await click(inLabor("Luftgewehr"), 200)
    await click(inLabor("40 Schuss"), 200)
    await tab("Ergebnis")
    check(
      "LG: Quoten ab 10,0 und ab 10,5",
      $$("[data-share]", A())
        .map((e) => e.dataset.share)
        .join() === "ab 10,0,ab 10,5"
    )
    await click(inLabor("Luftpistole"), 200)
    await click(inLabor("40 Schuss"), 200)
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
      const region = w.document.getElementById("target")
      w.scrollTo(0, region.getBoundingClientRect().top + w.scrollY - 56)
    }
    const frameClick = async (f, el, ms = 150) => {
      el.dispatchEvent(new f.contentWindow.MouseEvent("click", { bubbles: true, cancelable: true }))
      await wait(ms)
    }
    // Desktop in einem Fenster von 1280 × 900 (das Fenster der Prüfung ist über 2000 px hoch)
    const desk = await openFrame(1280, 900)
    const dd = desk.contentDocument
    const dw = desk.contentWindow
    const sectionNav = dd.querySelector('nav[aria-label="Abschnitte"]')
    check(
      "Sprungleiste: drei Anker in der Reihenfolge der Seite (U1: ohne „Zahlen“)",
      [...sectionNav.querySelectorAll("a")].map((a) => a.getAttribute("href")).join() ===
        "#target,#shots,#analysis"
    )
    // die Leiste scrollt selbst: auch in einer data:-Vorschau, wo der Browser den Sprung zum Anker blockt
    const jumpClick = new dw.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    sectionNav.querySelector('a[href="#analysis"]').dispatchEvent(jumpClick)
    check(
      "Sprungleiste: der Klick springt selbst, nicht über den Browser",
      jumpClick.defaultPrevented
    )
    await wait(300)
    dw.dispatchEvent(new dw.Event("scroll"))
    await wait(100)
    const deskActive = [...sectionNav.querySelectorAll("[aria-current]")].map(txt)
    check(
      "Desktop: „Analyse“ bringt die Analyse unter die Leiste, aktiv ist genau „Analyse“",
      near(dd.getElementById("analysis").getBoundingClientRect().top, 56, 3) &&
        deskActive.join() === "Analyse",
      `${dd.getElementById("analysis").getBoundingClientRect().top.toFixed(0)} · ${deskActive.join()}`
    )
    // „Alle Beobachtungen“ im Kopf: der Überblick der Analyse, oben an ihrem Anfang (U1, D4)
    dw.scrollTo(0, 0)
    await frameClick(
      desk,
      [...dd.querySelectorAll('section[aria-label="Analyse"] [role="radio"]')].find(
        (b) => txt(b) === "Lage"
      )
    )
    dw.scrollTo(0, 0)
    await wait(50)
    await frameClick(desk, dd.querySelector("[data-more-observations]"), 200)
    const moreTab = txt(
      dd.querySelector('section[aria-label="Analyse"] [role="radio"][aria-checked="true"]')
    )
    // die Karte „Beobachtungen“ steht sichtbar unter Sprung- und Reiterleiste (2 × 56 px; höher geht es nicht, wenn die
    // Seite darunter endet), der Fokus auf dem Reiter (Review U1)
    const moreCard = dd.querySelector('section[aria-label="Analyse"] [data-card="beobachtungen"]')
    const moreTop = moreCard?.getBoundingClientRect().top ?? -1
    check(
      "„Alle Beobachtungen“ öffnet den Überblick, die Karte „Beobachtungen“ steht unter den Leisten, Fokus am Reiter",
      moreTab === "Überblick" &&
        // unter den Leisten oder, wenn die Seite darunter endet, so weit es geht (ganz unten gescrollt)
        (near(moreTop, 112, 3) ||
          (moreTop > 112 && dw.scrollY + dw.innerHeight >= dd.documentElement.scrollHeight - 2)) &&
        dd.activeElement?.getAttribute("aria-checked") === "true" &&
        txt(dd.activeElement) === "Überblick",
      `${moreTab} · ${moreTop.toFixed(0)} · ${dd.activeElement?.tagName} ${txt(dd.activeElement ?? dd.body).slice(0, 12)}`
    )
    sectionNav.querySelector('a[href="#analysis"]').click()
    await wait(500)
    const analyseTop = dd.getElementById("analysis").getBoundingClientRect().top
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
    // links Scheibe und Serien, rechts Schuss, Übersicht und Schüsse; die Analyse darunter über die ganze Breite
    const regionBox = deskRect("target")
    const fullWidth = ["analysis"].every((id) => {
      const r = deskRect(id)
      return near(r.left, regionBox.left, 1) && near(r.width, regionBox.width, 1)
    })
    const besideTarget = ["readout", "shot-table"].every((id) => deskRect(id).left > deskBox.right)
    check(
      "Desktop: Serien unter der Scheibe, Schuss und Schüsse daneben, die Analyse darunter in voller Breite",
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
    dd.getElementById("analysis").scrollIntoView()
    await wait(80)
    check(
      "Desktop: unter dem Raster scrollt die Scheibe mit weg",
      dd.querySelector('[data-section="target"]').getBoundingClientRect().bottom < 56,
      dd.querySelector('[data-section="target"]').getBoundingClientRect().bottom.toFixed(0)
    )
    // nichts angeschnitten: Kacheln des Überblicks in Zeilen zu vier ohne abgeschnittenen Text, alle Reiter
    // sichtbar, die Knöpfe der Scheibe in ihrem Kasten
    const clipped = [...dd.querySelectorAll("[data-tile] *")].filter(
      (e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible"
    )
    check(
      "Desktop: Kacheln des Überblicks zu vier, kein Text abgeschnitten",
      tileRows(dd).length === 2 && tileRows(dd).every((n) => n === 4) && clipped.length === 0,
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
    sectionNav.querySelector('a[href="#target"]').click()
    await wait(100)
    check(
      "Desktop: „Scheibe“ in der Sprungleiste führt nach oben, auch wenn die Scheibe klebt",
      dd.getElementById("target").getBoundingClientRect().top >= 0 &&
        near(dd.getElementById("target").getBoundingClientRect().top, 56, 3),
      `${dw.scrollY.toFixed(0)} · ${dd.getElementById("target").getBoundingClientRect().top.toFixed(0)}`
    )
    desk.remove()
    // aktiver Abschnitt im Fenster der Prüfung: nach dem Sprung meldet der Browser ein Scroll-Ereignis
    {
      const mainNav = $('nav[aria-label="Abschnitte"]')
      $('a[href="#analysis"]', mainNav).click()
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

    const anchored = await openFrame(800, 900, "#position")
    const ad = anchored.contentDocument
    const anchoredTab = ad?.querySelector(
      'section[aria-label="Analyse"] [role="radio"][aria-checked="true"]'
    )
    check(
      "Anker #position öffnet den Reiter Lage und zeigt die Analyse",
      txt(anchoredTab) === "Lage" &&
        ad.getElementById("analysis").getBoundingClientRect().top < 300,
      `${txt(anchoredTab)} · ${ad?.getElementById("analysis").getBoundingClientRect().top.toFixed(0)}`
    )
    const timeTab = [...ad.querySelectorAll('section[aria-label="Analyse"] [role="radio"]')].find(
      (b) => txt(b) === "Zeit und Verlauf"
    )
    await frameClick(anchored, timeTab)
    check(
      "Reiterwechsel schreibt den Anker",
      anchored.contentWindow.location.hash === "#time",
      anchored.contentWindow.location.hash
    )
    anchored.remove()

    // feste Scheibe ab 768 px: beim Kleben passt sie samt Leiste ins Fenster, auch flach (D5, D9)
    // flach passt die Scheibe allein ins Fenster, mit genug Höhe samt Serien (ab 280 px Scheibe). Ab 1024 px steht die
    // Seitenleiste daneben (N3): die Spalte wird schmaler, bei 1024 × 600 passen die Serien darum mit ins Fenster
    for (const [width, height, withSeries] of [
      [812, 375, false],
      [1024, 600, true],
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
    // Tablet (unter 1024 px breit): die untere Leiste nimmt 72 px, Scheibe und Serien enden darüber (Plan N3, D2).
    // 700 px hoch, damit die Höhe die Scheibe begrenzt und nicht die Breite: ohne Abzug der Leiste reichten die
    // Serien unter sie. Seit U4 sind es vier statt fünf Serien-Kacheln, jede breiter und höher; bei 660 px bliebe für
    // die Scheibe weniger als `MIN_TARGET_PX`, dann folgen die Serien gewollt darunter
    const tablet = await openFrame(768, 700)
    scrollToRegion(tablet.contentWindow)
    await wait(100)
    const tabletBox = tablet.contentDocument.getElementById("target-box").getBoundingClientRect()
    const tabletSeries = tablet.contentDocument.getElementById("series").getBoundingClientRect()
    check(
      "768 × 700: Scheibe und Serien enden über der unteren Leiste",
      tabletBox.bottom <= 700 - 72 && tabletSeries.bottom <= 700 - 72,
      `Scheibe bis ${tabletBox.bottom.toFixed(0)}, Serien bis ${tabletSeries.bottom.toFixed(0)} von ${700 - 72}`
    )
    tablet.remove()

    // Telefon: „Auf der Scheibe“ im Lineal springt zur Scheibe, die Pille nennt den Reiter (Plan L1, D4)
    const rulerPhone = await openFrame(375, 812)
    const rd = rulerPhone.contentDocument
    const rulerTab = [...rd.querySelectorAll('section[aria-label="Analyse"] [role="radio"]')].find(
      (b) => txt(b) === "Zeit und Verlauf"
    )
    await frameClick(rulerPhone, rulerTab, 200)
    // die Zeile über dem Diagramm hat bei 375 px für den Hinweis und jede Wahl dieselbe Höhe, nichts abgeschnitten
    const rulerTap = (svgEl, attr, n) => {
      const r = svgEl.querySelector(`[${attr}="${n}"]`).getBoundingClientRect()
      for (const type of ["pointerdown", "pointerup"])
        svgEl.dispatchEvent(
          new rulerPhone.contentWindow.PointerEvent(type, {
            bubbles: true,
            clientX: r.left + r.width / 2,
            clientY: r.top + r.height / 2,
            pointerId: 1,
          })
        )
    }
    const lineBoxes = []
    for (const [cardId, label, attr, points] of [
      [
        "verlauf-und-trend",
        "Wert je Schuss mit gleitendem Schnitt",
        "data-course-point",
        [1, 21, 40],
      ],
      ["rhythmus", "Abstände zwischen den Schüssen", "data-interval", [21, 2, 39]],
    ]) {
      const chartEl = rd.querySelector(`[data-card="${cardId}"] svg[aria-label="${label}"]`)
      const lineEl = rd.querySelector(`[data-card="${cardId}"] [data-readout]`)
      const measure = () => {
        const span = lineEl.querySelector("span")
        return {
          h: Math.round(lineEl.getBoundingClientRect().height),
          clipped: span.scrollHeight > span.clientHeight + 1,
        }
      }
      lineBoxes.push(measure())
      for (const n of points) {
        rulerTap(chartEl, attr, n)
        await wait(60)
        lineBoxes.push(measure())
      }
      rulerTap(chartEl, attr, points.at(-1))
      await wait(60)
    }
    check(
      "Telefon: die Zeile über Verlauf und Rhythmus behält ihre Höhe, kein Text abgeschnitten",
      lineBoxes.every((b) => b.h === lineBoxes[0].h && !b.clipped),
      lineBoxes.map((b) => `${b.h}${b.clipped ? "!" : ""}`).join(" ")
    )
    const rulerCourse = rd.querySelector('svg[aria-label="Wert je Schuss mit gleitendem Schnitt"]')
    rulerCourse.scrollIntoView()
    await wait(100)
    const rulerRect = rulerCourse.getBoundingClientRect()
    const rulerX =
      rulerRect.left +
      (Number(rulerCourse.querySelector('[data-course-point="14"]').getAttribute("cx")) /
        rulerCourse.viewBox.baseVal.width) *
        rulerRect.width
    for (const type of ["pointerdown", "pointerup"])
      rulerCourse.dispatchEvent(
        new rulerPhone.contentWindow.PointerEvent(type, {
          bubbles: true,
          clientX: rulerX,
          clientY: rulerRect.top + rulerRect.height / 2,
          pointerId: 1,
        })
      )
    await wait(80)
    const rulerShow = [...rd.querySelectorAll('[data-card="verlauf-und-trend"] button')].find(
      (b) => txt(b) === "Auf der Scheibe"
    )
    if (rulerShow) await frameClick(rulerPhone, rulerShow, 400)
    const rulerPill = [...rd.querySelectorAll("button")].find(
      (b) => txt(b).startsWith("Zurück zu") && !b.closest("[data-labor-panel]")
    )
    check(
      "Telefon: „Auf der Scheibe“ springt zur Scheibe, die Pille führt zurück zu „Zeit und Verlauf“",
      !!rulerShow &&
        !!rulerPill &&
        txt(rulerPill).includes("Zeit und Verlauf") &&
        rd.querySelector('[data-section="target"]').getBoundingClientRect().top < 400,
      rulerPill ? txt(rulerPill) : rulerShow ? "keine Pille" : "kein Knopf"
    )
    // der Knopf der Labor-Werkzeuge steht über der Pille, nicht darunter (Review: 5 px Überlappung bei 360 px)
    const pillBox = rulerPill?.parentElement.getBoundingClientRect()
    const knobBox = rd.querySelector("[data-labor-button]")?.getBoundingClientRect()
    const overlaps =
      !!pillBox &&
      !!knobBox &&
      pillBox.left < knobBox.right &&
      knobBox.left < pillBox.right &&
      pillBox.top < knobBox.bottom &&
      knobBox.top < pillBox.bottom
    check(
      "Telefon: der Knopf der Labor-Werkzeuge liegt nicht über der Pille",
      !!pillBox && !!knobBox && !overlaps && knobBox.bottom <= pillBox.top,
      `Pille ${Math.round(pillBox?.left ?? 0)}–${Math.round(pillBox?.right ?? 0)} / ${Math.round(pillBox?.top ?? 0)}, Knopf ${Math.round(knobBox?.left ?? 0)}–${Math.round(knobBox?.right ?? 0)} / ${Math.round(knobBox?.bottom ?? 0)}`
    )
    const pillBottom = rulerPill?.parentElement.getBoundingClientRect().bottom ?? 9999
    check(
      "Telefon: die Pille steht über der unteren Leiste (Plan N3, D2)",
      pillBottom <= 812 - 72,
      `${Math.round(pillBottom)} von 812`
    )
    // ohne Labor-Kopf beginnt die Seite einer Scheibe mit ihrem Titel (Labor näher an der App)
    rulerPhone.contentWindow.scrollTo(0, 0)
    await wait(50)
    const headTopPhone = rd.querySelector("[data-card-header]")?.getBoundingClientRect().top ?? 999
    check(
      "Telefon 375 px: die Seite einer Scheibe beginnt mit ihrem Titel, kein Labor-Kopf davor",
      headTopPhone < 120,
      `${Math.round(headTopPhone)}`
    )
    rulerPhone.remove()

    // Anker beim Laden: die Seite entsteht erst im Browser, der Sprung kommt aus dem Labor
    const loaded = await openFrame(375, 812, "#shots")
    const shotsTop = loaded.contentDocument.getElementById("shots").getBoundingClientRect().top
    check(
      "Anker #shots beim Laden: die Schüsse unter der Leiste",
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
      "Handy: Kacheln des Überblicks in vollen Zeilen zu zwei",
      !!doc && tileRows(doc).length === 4 && tileRows(doc).every((n) => n === 2),
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
    // die Sprungleiste auf dem Telefon: drei gleiche Felder über die volle Breite (U1)
    const phoneNav = doc?.querySelector('nav[aria-label="Abschnitte"] > div')
    const phoneNavLinks = phoneNav ? [...phoneNav.querySelectorAll("a")] : []
    const phoneNavWidths = phoneNavLinks.map((a) => Math.round(a.getBoundingClientRect().width))
    check(
      "Handy: Sprungleiste mit drei gleichen Feldern",
      phoneNavLinks.length === 3 &&
        Math.max(...phoneNavWidths) - Math.min(...phoneNavWidths) <= 1 &&
        frame.contentWindow.getComputedStyle(phoneNav).gridTemplateColumns.split(" ").length === 3,
      phoneNavWidths.join(" ")
    )
    // kürzer als vorher (Durchsicht, 9. Oktober 2026: 5,8 Bildschirme zu 772 px bei 390 × 844, nur „Überblick“)
    const lengthFrame = await openFrame(390, 844)
    const lengthOfCard = !!lengthFrame.contentDocument.querySelector("[data-card-header]")
    const screens = lengthFrame.contentDocument.documentElement.scrollHeight / (844 - 72)
    lengthFrame.remove()
    check(
      "Handy 390 × 844: die Seite einer Scheibe ist kürzer als 5 Bildschirme (vorher 5,8)",
      lengthOfCard && screens < 5,
      screens.toFixed(2)
    )
    const phone390 = doc ? await phoneAnalysis(doc, frame.contentWindow, 390) : ["kein Zugriff"]
    check(
      "Handy 390 px: jeder Reiter der Analyse passt",
      phone390.length === 0,
      phone390.join(" | ")
    )
    // „Alle Beobachtungen“ auf dem Telefon: die Karte sichtbar unter der Reiterleiste, die dort die Sprungleiste deckt
    if (doc) {
      frame.contentWindow.scrollTo(0, 0)
      await frameClick(frame, doc.querySelector("[data-more-observations]"), 200)
      const phoneMore = doc
        .querySelector('section[aria-label="Analyse"] [data-card="beobachtungen"]')
        ?.getBoundingClientRect().top
      check(
        "Handy 390 px: „Alle Beobachtungen“ bringt die Karte „Beobachtungen“ sichtbar unter die Reiterleiste",
        phoneMore !== undefined &&
          (near(phoneMore, 56, 3) ||
            (phoneMore > 56 &&
              frame.contentWindow.scrollY + frame.contentWindow.innerHeight >=
                doc.documentElement.scrollHeight - 2)),
        String(Math.round(phoneMore ?? -1))
      )
    }
    // das „?“ der ersten Karte im offenen Reiter (die Prüfung davor endet bei „Probe“)
    const phoneHelp = doc?.querySelector(
      'section[aria-label="Analyse"] [data-card] button[aria-label^="Erklärung"]'
    )
    phoneHelp?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await wait(150)
    const phoneSheet = doc ? [...doc.querySelectorAll("dialog")].at(-1) : null
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
    const seriesTop = sd.getElementById("series").getBoundingClientRect().top
    // die Karte der Scheibe (mit der Ablesezeile) ist das erste Kind der Spalte der Scheibe
    const targetCardBottom = sd
      .querySelector('[data-section="target"] > *')
      .getBoundingClientRect().bottom
    // sichtbar ist das Fenster über der unteren Leiste (72 px); die Serien folgen der Karte der Scheibe direkt (vorher
    // maß die Prüfung gegen das Ende des Rasters, das die Serien schon enthält: immer negativ, Review U1)
    const seriesGap = seriesTop - targetCardBottom
    check(
      "Handy 375 px: Kopf mit Ergebnis und Scheibe über der unteren Leiste, die Serien direkt danach",
      targetBottom - headTop <= 812 - 72 && seriesGap >= 0 && seriesGap <= 30,
      `${(targetBottom - headTop).toFixed(0)} px bis zum Ende der Scheibe, Serien ${seriesGap.toFixed(0)} px danach`
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
    sd.getElementById("analysis").scrollIntoView({ block: "start" })
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
      [...sd.querySelectorAll("button")].find(
        (b) => txt(b).startsWith("Zurück zu") && !b.closest("[data-labor-panel]")
      )
    const jumped = sd.querySelector('[data-section="target"]').getBoundingClientRect().top
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
    // drei Beobachtungen (LG „Zwei Abreißer“): auf dem Telefon steht nur die erste im Kopf, Kopf und Scheibe passen
    // weiter über die untere Leiste (Review U1)
    sw.scrollTo(0, 0)
    const smallPanel = (label) =>
      [...sd.querySelectorAll("[data-labor-panel] button")].find((b) => txt(b) === label)
    await frameClick(small, smallPanel("Luftgewehr"), 200)
    await frameClick(small, smallPanel("Zwei Abreißer"), 300)
    sw.scrollTo(0, 0)
    await wait(50)
    const pairItems = [...sd.querySelectorAll("[data-card-header] [data-observation]")]
    const pairShown = pairItems.filter((li) => li.offsetParent !== null).length
    const pairHead = sd.querySelector("[data-card-header]").getBoundingClientRect().top
    const pairBottom = sd.getElementById("target-box").getBoundingClientRect().bottom
    check(
      "Handy 375 px, drei Beobachtungen: im Kopf nur die erste, Kopf und Scheibe über der unteren Leiste",
      pairItems.length === 3 && pairShown === 1 && pairBottom - pairHead <= 812 - 72,
      `${pairShown} von ${pairItems.length} · ${(pairBottom - pairHead).toFixed(0)} px`
    )
    small.remove()

    // im hohen Fenster: ein Abschnitt erreicht die Leiste und ist aktiv (der letzte Abschnitt ist fensterhoch)
    const tallJump = async (hash, label = "Zahlen", id = "numbers", then) => {
      const f = await openFrame(1440, 1400, hash)
      const d = f.contentDocument
      const w = f.contentWindow
      const link = [...d.querySelectorAll('nav[aria-label="Abschnitte"] a')].find(
        (a) => a.textContent === label
      )
      link.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }))
      await wait(200)
      w.dispatchEvent(new w.Event("scroll"))
      await wait(100)
      const top = d.getElementById(id).getBoundingClientRect().top
      const active = d.querySelector('nav[aria-label="Abschnitte"] [aria-current]')?.textContent
      const after = await then?.(f)
      f.remove()
      return { top, active, after }
    }
    // „zeigen“ an einem Rekord springt nach oben zur gewählten Scheibe (User, 9. Oktober 2026): am Desktop die
    // Ablesung, am Telefon die Ablesezeile unter dem Verlauf, ganz im Bild unter der Sprungleiste
    const recordJump = async (f, shown) => {
      const d = f.contentDocument
      const w = f.contentWindow
      const button = [...d.querySelectorAll("[data-records-new] [data-record] button")].find(
        (b) => !b.disabled
      )
      const cardId = button?.closest("[data-record]")?.dataset.recordCard
      button?.scrollIntoView({ block: "center" })
      if (button) await frameClick(f, button, 200)
      const el = d.querySelector(shown)
      const box = el?.getBoundingClientRect()
      const bottomEdge = w.innerHeight - (w.innerWidth < 1024 ? 72 : 0)
      return {
        ok:
          !!cardId &&
          el?.getAttribute(shown.slice(1, -1)) === cardId &&
          box.top >= 56 - 2 &&
          box.bottom <= bottomEdge + 2,
        detail: box
          ? `${cardId} · ${Math.round(box.top)}–${Math.round(box.bottom)} / ${bottomEdge}`
          : "keine Ablesung",
      }
    }
    // ---------- Seite eines Zeitraums (Plan L3, Task 15)
    {
      const P = () => L().period
      const M = () => P().model
      const tools = L().tools
      const mean = (vs) => (vs.length ? vs.reduce((s, v) => s + v.value, 0) / vs.length : null)
      const valuesOf = (key, cards = M().cards) =>
        tools.analysis.cardValues(cards, tools.metricByKey(key), P().state.scoring, {
          includeProbeOnly: P().state.includeProbeOnly,
        })
      const helpDialog = () => $$("dialog").at(-1)
      const pickerDialog = () => $("[data-period-picker]").closest("dialog")
      const radio = (label) =>
        $$("[data-period-picker] label")
          .find((l) => txt(l).startsWith(label))
          ?.querySelector("input")
      const apply = async () => {
        await click(button("Übernehmen", pickerDialog()), 200)
      }
      const choose = async (periodLabel, compareLabel = null) => {
        await click($("[data-period-chip]"), 150)
        const inputs = $$("[data-period-picker] fieldset")
        const pick = (fieldset, label) =>
          $$("label", fieldset)
            .find((l) => txt(l).startsWith(label))
            ?.querySelector("input")
        const p = pick(inputs[0], periodLabel)
        if (p) await click(p, 60)
        if (compareLabel) {
          const c = pick(inputs[1], compareLabel)
          if (c) await click(c, 60)
        }
        await apply()
      }
      // Blatt „Filter“ (U2, D3): Art, Vergleich und Trainings nur aus Probe stehen im Blatt, nicht im Kopf
      const filterSet = (legend) =>
        $$("[data-period-picker] fieldset").find((f) => txt($("legend", f)) === legend)
      const pickIn = (legend, label) =>
        $$("label", filterSet(legend))
          .find((l) => txt(l).startsWith(label))
          ?.querySelector("input")
      const applyFilters = async ({ kind, compare, probe } = {}) => {
        await click($("[data-period-chip]"), 150)
        if (kind) await click(pickIn("Art", kind), 60)
        if (compare) await click(pickIn("Vergleichen mit", compare), 60)
        const box = $('[data-period-picker] input[type="checkbox"]')
        if (probe !== undefined && box.checked !== probe) await click(box, 60)
        await apply()
      }
      const clearCompare = () => applyFilters({ compare: "ohne" })
      // die Wertung des Geräts steht in Profil (U2, D4); zurück in den Fortschritt über die Navigation
      const deviceScoring = async (label) => {
        await click(area("Profil"), 300)
        await click(button(label, $("[data-scoring-setting]")), 150)
        await click(area("Fortschritt"), 400)
      }
      const rowIds = () => $$("[data-card-row]").map((r) => r.dataset.cardRow)
      const chartSvg = () =>
        $(
          'svg[role="slider"][aria-label*="je Scheibe"], svg[role="slider"][aria-label*="je Monat"]'
        )
      const pointerAt = async (svgEl, x, type) => {
        const r = svgEl.getBoundingClientRect()
        svgEl.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            clientX: r.left + (x / svgEl.viewBox.baseVal.width) * r.width,
            clientY: r.top + r.height / 2,
            pointerId: 1,
          })
        )
        await wait(40)
      }

      await click(area("Fortschritt"), 400)
      check(
        "Zeitraum: die Ansicht öffnet die Seite mit Kopf und Sprungleiste",
        !!$("[data-period-header]") &&
          $$('nav[aria-label="Abschnitte"] a')
            .map((a) => a.getAttribute("href"))
            .join() === "#history,#cards,#numbers,#analysis"
      )
      check(
        "Zeitraum: Vorgabe „Letzte 90 Tage“ über Luftgewehr",
        txt($("[data-period-header] h1")) === "Letzte 90 Tage" &&
          P().state.family === "lg-freihand" &&
          P().state.choice.days === 90
      )
      const boxValue = txt($("[data-result-box] [data-period-result]")).split("R")[0].trim()
      check(
        "Zeitraum: Ergebnis-Box = Mittel der Ø je Schuss je Scheibe",
        boxValue === tools.formatValue(mean(valuesOf("result.decimalMean")), 2),
        boxValue
      )
      const tileProblems = []
      for (const tile of $$("[data-period-tile]")) {
        const key = tile.dataset.periodTile
        const metric = tools.inScoring(tools.metricByKey(key), P().state.scoring)
        const want = mean(valuesOf(key))
        const shown = txt(tile.querySelector(".font-display"))
          .replace(/[^\d,−-].*$/, "")
          .trim()
        if (want !== null && shown !== tools.formatValue(want, metric.decimals)) {
          tileProblems.push(`${key}: ${shown}`)
        }
      }
      check(
        "Zeitraum: jede Kachel = Mittel der Werte je Scheibe (sechs Kacheln)",
        $$("[data-period-tile]").length === 6 && tileProblems.length === 0,
        tileProblems.join(", ")
      )
      check(
        "Zeitraum: Liste mit jeder Scheibe des Zeitraums, neueste oben",
        rowIds().join() ===
          M()
            .cards.map((c) => c.id)
            .reverse()
            .join()
      )
      check(
        "Zeitraum: Verlauf mit einem Punkt je Scheibe mit Wert und Formband",
        $$("[data-card-point]").length === M().values.length && !!$("[data-band]")
      )
      check(
        "Zeitraum: Satz im Kopf aus dem Modell",
        txt($("[data-period-header] [data-sentence]")) === tools.period.periodSentence(M())
      )
      // „Werde ich besser?“ (U2, D1): ohne gewählten Vergleich still gegen den Zeitraum davor, nie die 30 Tage
      const plainSentence = txt($("[data-period-header] [data-sentence]"))
      check(
        "Zeitraum: der Satz vergleicht ohne gewählten Vergleich mit dem Zeitraum davor",
        !M().compareRange &&
          M().form?.label === "Zeitraum davor" &&
          plainSentence.includes("Zeitraum davor") &&
          !plainSentence.includes("30 Tage"),
        plainSentence
      )
      // eine Zeile Bedienung (U2, D3): die Familie und der Chip, keine Art, kein „mit Training nur aus Probe“
      check(
        "Zeitraum: im Kopf nur die Familie und der Chip des Blatts „Filter“",
        $$("[data-period-controls] > *").filter((c) => c.tagName !== "DIALOG").length === 2 &&
          !!$('[data-period-controls] [aria-label="Familie"]') &&
          !!$("[data-period-controls] [data-period-chip]") &&
          !$('[data-period-controls] [aria-label="Art"]') &&
          !txt($("[data-period-controls]")).includes("mit Training"),
        txt($("[data-period-controls]"))
      )
      await applyFilters({ kind: "Training", probe: false })
      const filteredChip = txt($("[data-period-chip]"))
      const filteredState = [P().state.kind, P().state.includeProbeOnly]
      await applyFilters({ kind: "Alle", probe: true })
      check(
        "Zeitraum: das Blatt „Filter“ setzt Art und Trainings nur aus Probe, der Chip fasst zusammen",
        filteredState[0] === "training" &&
          filteredState[1] === false &&
          filteredChip ===
            tools.period.filterSummary("Letzte 90 Tage", {
              kind: "training",
              compareLabel: null,
              includeProbeOnly: false,
            }) &&
          filteredChip === "Letzte 90 Tage · Training · ohne Probe-Training" &&
          P().state.kind === "all" &&
          P().state.includeProbeOnly === true &&
          txt($("[data-period-chip]")) === "Letzte 90 Tage",
        `${filteredChip} · ${filteredState.join(" ")}`
      )
      // ein Bezug für eine Scheibe (U2, D2): keine Karte „Gegen deinen Schnitt“, das „?“ steht an der Ablesung
      check("Zeitraum: keine Karte „Gegen deinen Schnitt“", !$('[data-card="gegen-den-schnitt"]'))
      const periodJargon = jargonIn(
        $("[data-period-header]"),
        $("[data-result-box]"),
        ...$$("[data-period-tile]"),
        $("[data-card-readout]"),
        $("#card-list"),
        $('[data-section="history"]')
      )
      check(
        "Zeitraum: Kopf, Ergebnis, Zahlen, Liste und Verlauf ohne Fachbegriffe",
        !periodJargon,
        periodJargon ?? ""
      )
      await click($('[data-card-readout] button[data-help="gegen-den-schnitt"]'), 120)
      const readoutHelp = txt($("h2", helpSheet()))
      await click($('button[aria-label="Schließen"]', helpSheet()), 80)
      check(
        "Zeitraum: das „?“ an der Ablesung erklärt den Abstand zum Schnitt davor",
        readoutHelp === "Abstand zum Schnitt davor",
        readoutHelp
      )
      // Rekorde (U2, D5): oben höchstens fünf aus dem Zeitraum, alle zugeklappt darunter
      const newRecords = $$("[data-records-new] [data-record]")
      const allRecords = $$("[data-records] [data-record]")
      const periodIdsNow = new Set(M().cards.map((c) => c.id))
      const rowsNow = tools.period.recordRows(M().records, P().state.scoring)
      check(
        "Zeitraum: Rekorde oben höchstens fünf aus dem Zeitraum, „Alle Rekorde (n)“ zugeklappt",
        newRecords.length > 0 &&
          newRecords.length <= 5 &&
          newRecords.every((r) =>
            periodIdsNow.has(rowsNow.find((x) => x.key === r.dataset.record)?.record.cardId)
          ) &&
          allRecords.length === rowsNow.length &&
          txt($("[data-all-records] summary")) === `Alle Rekorde (${rowsNow.length})` &&
          !$("[data-all-records]").open,
        `${newRecords.length} oben · ${allRecords.length} alle`
      )
      // „zeigen“ an einem Rekord wählt seine Scheibe für Verlauf, Ablesung und Liste (User, 9. Oktober 2026)
      const recordRow = newRecords.find(
        (r) => rowsNow.find((x) => x.key === r.dataset.record)?.record.cardId !== P().state.chosen
      )
      const recordCard = rowsNow.find((x) => x.key === recordRow?.dataset.record)?.record.cardId
      await click($("button", recordRow), 200)
      check(
        "Zeitraum: „zeigen“ an einem Rekord wählt seine Scheibe, die Ablesung zeigt sie",
        !!recordCard &&
          P().state.chosen === recordCard &&
          M().reading?.card.id === recordCard &&
          !!$(
            `[data-card-row="${recordCard}"][aria-selected="true"], [data-card-row="${recordCard}"][data-chosen]`
          ),
        `${recordCard} · gewählt ${P().state.chosen} · Ablesung ${M().reading?.card.id}`
      )

      // Umfang je Woche: die Achse nennt den Montag jeder Woche, keine Kalenderwoche (U3, D6)
      const weekTicks = $$('svg[aria-label="Schüsse je Woche"] text')
        .map(txt)
        .filter((t) => !/^\d+$/.test(t))
      const firstWeek = M().weeks[0]
      check(
        "Zeitraum: Umfang je Woche mit dem Datum des Montags, keine „KW“",
        weekTicks.length > 1 &&
          weekTicks.every((t) => /^\d\d\.\d\d\.$/.test(t)) &&
          weekTicks[0] === firstWeek.label &&
          firstWeek.label === tools.period.weekLabel(firstWeek.key) &&
          !txt($('[data-section="history"]')).includes("KW"),
        weekTicks.join(" ")
      )

      // Lineal und Liste teilen die Wahl
      const target = M().values[Math.floor(M().values.length / 2)]
      const point = $(`[data-card-point="${target.id}"] circle:last-child`)
      await pointerAt(chartSvg(), Number(point.getAttribute("cx")), "pointerdown")
      await pointerAt(chartSvg(), Number(point.getAttribute("cx")), "pointerup")
      await wait(150)
      check(
        "Zeitraum: ein Tipp in den Verlauf wählt die Scheibe für Ablesung und Liste",
        P().state.chosen === target.id &&
          $("[data-card-readout]")?.dataset.cardReadout === target.id &&
          $(`[data-card-row="${target.id}"]`)?.dataset.chosen === "true",
        String(P().state.chosen)
      )
      const rowId = rowIds()[2]
      await click($(`[data-card-row="${rowId}"] button`), 200)
      check(
        "Zeitraum: eine Zeile der Liste wählt die Scheibe und setzt das Lineal",
        P().state.chosen === rowId && $(`[data-card-point="${rowId}"]`)?.dataset.chosen === "true"
      )
      await click($(`[data-card-row="${rowId}"] button`), 200)
      check("Zeitraum: dieselbe Zeile noch einmal hebt die Wahl auf", P().state.chosen === null)
      check(
        "Zeitraum: ohne Wahl liest die Ablesung die neueste Scheibe mit Ø",
        $("[data-card-readout]")?.dataset.cardReadout === M().reading.card.id &&
          M().reading.card.id === M().newest &&
          txt($("[data-card-readout] h3")) === "Neueste Scheibe"
      )
      const readoutDelta = txt($("[data-card-readout] [data-delta]"))
      const newest = M().deltas.get(M().cards.at(-1).id)
      check(
        "Zeitraum: Abstand zum Schnitt der Scheiben davor in der Ablesung",
        !!newest &&
          readoutDelta.startsWith(
            tools.formatValue(Math.abs(newest.delta), 2).length
              ? newest.delta < 0
                ? "−"
                : "+"
              : ""
          ) &&
          readoutDelta.includes(`der ${newest.n} Scheiben davor`),
        readoutDelta
      )

      // Wähler
      await click($("[data-period-chip]"), 150)
      check(
        "Zeitraum: der Chip öffnet das Blatt „Filter“",
        pickerDialog().open && txt($("h2", pickerDialog())) === "Filter"
      )
      await click($('button[aria-label="Schließen"]', pickerDialog()), 100)
      await choose("Letzte 30 Tage")
      const in30 = P().cards.filter(
        (c) => c.startedAtMs >= M().range.fromMs && c.startedAtMs < M().range.toMs
      )
      check(
        "Zeitraum: „Letzte 30 Tage“ zeigt genau die Scheiben der 30 Tage",
        txt($("[data-period-header] h1")) === "Letzte 30 Tage" &&
          rowIds().length === in30.length &&
          M().range.toMs - M().range.fromMs === 30 * 86_400_000 + 1,
        `${rowIds().length} / ${in30.length}`
      )
      await choose("Alles")
      check(
        "Zeitraum: „Alles“ zeigt alle Scheiben der Familie, ab 60 je Monat",
        rowIds().length === P().cards.length &&
          M().view === "months" &&
          $$("[data-month]").length === M().months.length &&
          M().months.length >= 6
      )
      const monthSpans = $$("[data-month-span]").length
      check(
        "Zeitraum: je Monat Median und Spanne P10–P90 ab fünf Scheiben",
        monthSpans === M().months.filter((m) => m.p10 !== null).length && monthSpans > 0
      )
      // auch je Monat ohne Fachbegriffe: „Mitte“ und „Spanne“, kein Median, P10, P90 (Review U3)
      const monthJargon = jargonIn($('[data-section="history"]'))
      check("Zeitraum je Monat: ohne Fachbegriffe", !monthJargon, monthJargon ?? "")
      await click(button("je Scheibe"), 200)
      check(
        "Zeitraum: „je Scheibe“ zeigt wieder jede Scheibe",
        M().view === "cards" && $$("[data-card-point]").length === M().values.length
      )
      await click(button("Streuung"), 200)
      const sigmaMonths = M().months
      check(
        "Zeitraum: Streuung (σ) im Verlauf, Boden ist bei σ das P90 (kleiner ist besser)",
        P().state.metric === "group.sigma" &&
          sigmaMonths.every((m) => m.p10 === null || (m.floor === m.p90 && m.ceiling === m.p10))
      )
      await click(button("Ø je Schuss"), 200)
      await choose("Neue Munition", "Zeitraum davor")
      const comparison = M().comparison
      const boxCompare = txt($("[data-result-box] [data-comparison]"))
      check(
        "Zeitraum: „Neue Munition“ gegen den Zeitraum davor mit Unterschied und Urteil",
        txt($("[data-period-header] h1")) === "Neue Munition" &&
          !!comparison &&
          boxCompare.includes(tools.formatValue(Math.abs(comparison.delta), 2)) &&
          boxCompare.includes(tools.period.verdictText(comparison, "higher")),
        boxCompare
      )
      check(
        "Zeitraum: die Saison zeigt den Munitionswechsel: Ø nachweisbar höher",
        comparison?.verdict === "higher"
      )
      const judged = [
        boxCompare,
        ...$$("[data-tile-compare]").map(txt),
        txt($("[data-period-header] [data-sentence]")),
      ]
      // Urteil in Alltagsworten (U3, D5): „deutlich“ nur mit einem Urteil, kein „bedeutsam“ mehr auf der Seite
      check(
        "Zeitraum: „deutlich“ nie ohne Urteil, kein „bedeutsam“",
        judged.every(
          (t) =>
            !t.includes("bedeutsam") &&
            (!/deutlich /.test(t) || /deutlich (besser|schwächer|höher|tiefer)/.test(t))
        ) && judged.some((t) => /besser|schwächer|kein klarer Unterschied/.test(t)),
        judged.join(" | ")
      )
      check(
        "Zeitraum: Vergleich im Verlauf übereinander mit Legende, ohne Band",
        !!$("[data-legend]") &&
          $$("[data-compare-point]").length === (M().compareValues?.length ?? -1) &&
          !$("[data-band]") &&
          txt($("[data-period-chip]")).includes("mit Zeitraum davor")
      )

      // Hilfe
      const helpIds = [...new Set($$("button[data-help]").map((b) => b.dataset.help))]
      const helpProblems = []
      for (const id of helpIds) {
        const entry = tools.helpTopic(id) ?? tools.VIEW_HELP.find((v) => v.id === id)
        await click($(`button[data-help="${id}"]`), 120)
        if (!helpDialog().open || txt($("h2", helpDialog())) !== entry?.title) helpProblems.push(id)
        await click($('button[aria-label="Schließen"]', helpDialog()), 80)
      }
      check(
        "Zeitraum: jedes „?“ öffnet sein Blatt",
        helpIds.length >= 5 && helpProblems.length === 0,
        helpProblems.join(", ")
      )
      const periodTopics = tools.HELP_TOPICS.filter((t) => t.theme === "period").map((t) => t.id)
      check(
        "Hilfe: jedes Thema über viele Scheiben hat seinen Platz auf der Seite eines Zeitraums",
        periodTopics.every((id) => helpIds.includes(id)),
        periodTopics.filter((id) => !helpIds.includes(id)).join(", ")
      )

      // Öffnen und zurück
      const chosenId = M().cards.at(-3).id
      await click($(`[data-card-row="${chosenId}"] button`), 200)
      const listShots = Number(txt($(`[data-card-row="${chosenId}"] td:last-child`)))
      const listValue = txt($(`[data-card-row="${chosenId}"] td:nth-child(3)`))
      scrollTo(0, 700)
      await wait(50)
      const scrolledTo = window.scrollY
      const progressAddress = addr()
      const progressRoute = routeOf(progressAddress)
      check(
        "Adresse: der Zeitraum mit Vergleich, Familie und Wahl, gleich dem Zustand der Seite",
        progressRoute.page === "progress" &&
          same(progressRoute.query, P().state) &&
          progressAddress.includes(`range=${P().state.choice.id}`) &&
          progressAddress.includes("compare=") &&
          progressAddress.includes("family=lg-freihand") &&
          progressAddress.includes(`pick=${chosenId}`),
        progressAddress
      )
      await click(link("Scheibe öffnen", $("[data-card-readout]")), 500)
      const openedAddress = addr()
      check(
        "Adresse: die geöffnete Scheibe trägt den Zeitraum als Herkunft, ohne `pick`",
        openedAddress.startsWith(`/cards/${chosenId}?from=progress&range=${P().state.choice.id}`) &&
          !openedAddress.includes("pick=") &&
          routeOf(openedAddress).origin?.from === "progress",
        openedAddress
      )
      check(
        "Adresse: der Rückweg heißt nach dem Zeitraum",
        !!link("Zurück zu „Neue Munition“") && !link("Zurück zum Zeitraum")
      )
      await click($('[data-series="2"]'), 120)
      check(
        "Adresse: Serie 2 der geöffneten Scheibe steht darin, die Herkunft bleibt",
        addr().includes("series=2") && routeOf(addr()).origin?.from === "progress",
        addr()
      )
      // die Wertung trägt die Scheibe; sie kommt über die Adresse mit zurück (ohne „restore“ bliebe Zehntel)
      await click(button("Ganze Ringe"), 150)
      check("Adresse: ganze Ringe auf der Scheibe", addr().includes("scoring=rings"), addr())
      const matchShots = (L().shots ?? []).filter((s) => s.kind === "match")
      const openedMean = tools.computeMetric(
        tools.inScoring(tools.metricByKey("result.decimalMean"), "decimal"),
        L().shots ?? []
      )
      check(
        "Zeitraum: „Scheibe öffnen“ zeigt die Scheibe mit derselben Schusszahl und demselben Ø",
        !!$("[data-card-header]") &&
          matchShots.length === listShots &&
          openedMean !== null &&
          tools.formatValue(openedMean, 2) === listValue,
        `${matchShots.length}/${listShots} ${listValue}`
      )
      // Blättern aus dem Fortschritt (Plan N3, D5): die Nachbarn unter den Scheiben seines Zeitraums
      const periodIds = P().model.cards.map((c) => c.id)
      const openedId = routeOf(addr()).id
      const at = periodIds.indexOf(openedId)
      const linkId = (el) => (el ? routeOf(el.getAttribute("href")).id : null)
      check(
        "Blättern aus dem Fortschritt: vorige und nächste liegen im Zeitraum, als Nachbarn",
        at >= 0 &&
          linkId(link("Vorige Scheibe")) === (periodIds[at - 1] ?? null) &&
          linkId(link("Nächste Scheibe")) === (periodIds[at + 1] ?? null) &&
          routeOf(link("Vorige Scheibe")?.getAttribute("href") ?? addr()).origin?.from ===
            "progress",
        `${periodIds.length} im Zeitraum · ${openedId} an ${at}`
      )
      await click(link("Zurück zu „Neue Munition“"), 500)
      check(
        "Zeitraum: „Zurück“ kehrt an die Stelle zurück",
        scrolledTo > 0 && near(window.scrollY, scrolledTo, 5),
        `${Math.round(window.scrollY)} / ${Math.round(scrolledTo)}`
      )
      check(
        "Zeitraum: „Zurück“ stellt aus der Adresse Zeitraum, Vergleich und Wahl wieder her",
        txt($("[data-period-header] h1")) === "Neue Munition" &&
          txt($("[data-period-chip]")).includes("mit Zeitraum davor") &&
          P().state.chosen === chosenId &&
          P().state.scoring === "rings" &&
          same(routeOf(addr()).query, { ...progressRoute.query, scoring: "rings" }),
        `${addr()} / ${progressAddress}`
      )
      // im Fortschritt kein Schalter der Wertung mehr (U2, D4): zurück auf Zehntel über Profil
      check(
        "Zeitraum: kein Schalter der Wertung im Fortschritt",
        !button("Ganze Ringe", $("[data-app-content]")) &&
          !button("Zehntel", $("[data-app-content]"))
      )
      await deviceScoring("Zehntel")
      check("Adresse: zurück auf Zehntel wie vor dem Öffnen", addr() === progressAddress, addr())
      // die Wertung des Geräts aus Profil gilt im Fortschritt und auf der Scheibe, die er öffnet; „Zurück“ lässt sie
      // stehen (Review N1)
      await deviceScoring("Ganze Ringe")
      check(
        "Zeitraum: Profil „Ganze Ringe“ gilt im Fortschritt",
        P().state.scoring === "rings" && addr().includes("scoring=rings"),
        addr()
      )
      await click(link("Scheibe öffnen", $("[data-card-readout]")), 500)
      check(
        "Adresse: ganze Ringe aus dem Zeitraum gelten auf der geöffneten Scheibe",
        L().state.scoring === "rings" && addr().includes("scoring=rings"),
        `${L().state.scoring} · ${addr()}`
      )
      check("Adresse: eine geöffnete Scheibe beginnt ohne Anker", !addr().includes("#"), addr())
      await click(link("Zurück zu „Neue Munition“"), 500)
      check(
        "Adresse: „Zurück“ lässt die ganzen Ringe des Zeitraums stehen",
        P().state.scoring === "rings" && addr().includes("scoring=rings"),
        `${P().state.scoring} · ${addr()}`
      )
      await deviceScoring("Zehntel")
      const brokenAddresses = [...seenAddresses].filter(
        (url) => L().tools.nav.urlFromRoute(L().tools.nav.routeFromUrl(...urlParts(url))) !== url
      )
      check(
        "Adresse: jede gezeigte Adresse übersteht Lesen und Schreiben unverändert",
        seenAddresses.size >= 5 && brokenAddresses.length === 0,
        `${seenAddresses.size} gesehen · ${brokenAddresses.join(" ")}`
      )
      await clearCompare()
      check(
        "Zeitraum: „ohne“ im Blatt „Filter“ entfernt den Vergleich",
        !M().compareRange && !txt($("[data-period-chip]")).includes("mit ")
      )

      // überlappende Zeiträume: die gemeinsamen Scheiben zählen nur im gewählten (Review)
      await choose("Letzte 12 Monate", "Vorbereitung Landesmeisterschaft")
      check(
        "Zeitraum: überlappende Zeiträume ohne gemeinsame Scheiben im Vergleich",
        M().compareShared > 0 &&
          txt($("[data-result-box] [data-compare-shared]")).startsWith(
            `${M().compareShared} Scheiben`
          ) &&
          txt($("[data-result-box] [data-comparison]")).includes("zu wenige Scheiben"),
        txt($("[data-result-box]"))
      )
      await clearCompare()

      // „Frei“: zwei Tage, übernehmen; nicht übernommene Tage gelten beim nächsten Öffnen nicht (Review)
      const setDate = (input, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value)
        input.dispatchEvent(new Event("input", { bubbles: true }))
      }
      const dateInputs = () => $$('[data-period-picker] input[type="date"]')
      await click($("[data-period-chip]"), 150)
      await click(radio("Frei"), 60)
      setDate(dateInputs()[0], "2026-07-01")
      setDate(dateInputs()[1], "2026-07-31")
      await wait(60)
      await apply()
      const july = P().cards.filter(
        (c) =>
          c.startedAtMs >= Date.parse("2026-07-01T00:00:00+02:00") &&
          c.startedAtMs < Date.parse("2026-08-01T00:00:00+02:00")
      )
      check(
        "Zeitraum: „Frei“ vom 1. bis 31. Juli zeigt genau die Scheiben des Juli",
        txt($("[data-period-header] h1")) === "01.07.2026 – 31.07.2026" &&
          rowIds().length === july.length,
        `${txt($("[data-period-header] h1"))} ${rowIds().length}/${july.length}`
      )
      await click($("[data-period-chip]"), 150)
      setDate(dateInputs()[1], "2026-07-15")
      await wait(60)
      await click($('button[aria-label="Schließen"]', pickerDialog()), 100)
      await click($("[data-period-chip]"), 150)
      check(
        "Zeitraum: nicht übernommene freie Tage gelten beim nächsten Öffnen nicht",
        dateInputs()[1].value === "2026-07-31",
        dateInputs()[1].value
      )
      await click($('button[aria-label="Schließen"]', pickerDialog()), 100)
      await choose("Letzte 90 Tage")

      // Rekorde
      const records = M().records
      const teilerRow = $('[data-record="R3"]')
      check(
        "Zeitraum: Bester Teiler wie im Fachkern, als „Bezeichnung: Wert“ (U5, D3)",
        !!records.bestTeiler &&
          !!teilerRow &&
          txt(teilerRow).includes(
            `Bester Teiler: ${tools.formatValue(records.bestTeiler.value, 1)}`
          )
      )
      const recordCards = Object.values(records).flatMap((r) =>
        !r ? [] : "cardId" in r ? [r.cardId] : Object.values(r).map((x) => x.cardId)
      )
      const printoutOnly = P().cards.find((c) => c.flags?.includes("nur-pdf"))?.id
      check(
        "Zeitraum: die Scheibe nur aus dem Ausdruck setzt keinen Rekord",
        !!printoutOnly && recordCards.length > 0 && !recordCards.includes(printoutOnly),
        printoutOnly ?? "keine Scheibe nur aus dem Ausdruck"
      )

      // Telefon und Desktop in eigenen Fenstern (die Ansicht ist gemerkt, der Anker hält sie fest)
      for (const [width, height] of [
        [390, 844],
        [375, 812],
      ]) {
        const f = await openFrame(width, height, "#history")
        const d = f.contentDocument
        const w = f.contentWindow
        const rows = [...d.querySelectorAll("[data-card-row]")]
        const visibleRows = rows.filter((r) => w.getComputedStyle(r).display !== "none")
        // Länge des Fortschritts am Telefon 390 × 844 (Durchsicht: 4,7 Bildschirme zu 772 px)
        const screens = d.documentElement.scrollHeight / (height - 72)
        if (width === 390)
          check(
            "Zeitraum, Telefon 390 × 844: kürzer als vorher (4,7 Bildschirme)",
            !!d.querySelector("[data-period-header]") && screens < 4.7,
            screens.toFixed(2)
          )
        const line = d.querySelector("[data-card-line]")
        const nav = d.querySelector('nav[aria-label="Abschnitte"] > div')
        // der Umschalter der Kennzahl bricht nicht um (U3: „Streuung“ ist länger als „σ“)
        const metricButtons = [
          ...d.querySelectorAll('[role="radiogroup"][aria-label="Kennzahl"] button'),
        ]
        const metricHeights = new Set(
          metricButtons.map((b) => Math.round(b.getBoundingClientRect().height))
        )
        // im Rahmen der Prüfung bricht er auch ohne Regel nicht sichtbar um (Bildschirmfoto 390 schon), deshalb dazu die
        // Regel selbst: kein Umbruch, zu breit scrollt er in sich
        const metricBar = metricButtons[0]?.parentElement
        check(
          `Zeitraum, Telefon ${width} px: Umschalter der Kennzahl ohne Umbruch`,
          metricButtons.length === 4 &&
            metricHeights.size === 1 &&
            metricButtons.every((b) => w.getComputedStyle(b).whiteSpace === "nowrap") &&
            w.getComputedStyle(metricBar).overflowX === "auto",
          [...metricHeights].join(" / ")
        )
        check(
          `Zeitraum, Telefon ${width} px: kein seitliches Scrollen`,
          d.documentElement.scrollWidth <= width,
          `${d.documentElement.scrollWidth}`
        )
        check(
          `Zeitraum, Telefon ${width} px: zehn Zeilen und „Alle zeigen“, Ablesezeile unter dem Verlauf`,
          rows.length > 10 &&
            visibleRows.length === 10 &&
            [...d.querySelectorAll("button")].some((b) => b.textContent.startsWith("Alle ")) &&
            !!line &&
            w.getComputedStyle(line).display !== "none" &&
            !d.querySelector("[data-card-readout]")?.offsetParent,
          `${visibleRows.length}/${rows.length}`
        )
        check(
          `Zeitraum, Telefon ${width} px: Sprungleiste mit vier gleichen Feldern`,
          w.getComputedStyle(nav).gridTemplateColumns.split(" ").length === 4
        )
        // eine Zeile Bedienung vor dem Ergebnis (U2, D3): die Familie und der Chip
        const controlsBox = d.querySelector("[data-period-controls]")
        // das Blatt hängt als geschlossenes <dialog> daneben und zählt nicht; auf dem Telefon darf der Chip unter die
        // Familie rutschen, es bleiben zwei Bedienelemente vor dem Ergebnis (Plan U2, Task 7)
        const controlItems = [...controlsBox.children].filter((c) => c.tagName !== "DIALOG")
        const controlTops = new Set(
          controlItems.map((c) => Math.round(c.getBoundingClientRect().top))
        )
        check(
          `Zeitraum, Telefon ${width} px: vor dem Ergebnis nur Familie und Chip`,
          controlItems.length === 2,
          `${controlItems.map((c) => Math.round(c.getBoundingClientRect().width)).join(" + ")} px in ${controlTops.size} Zeilen`
        )
        d.querySelector("[data-period-chip]").dispatchEvent(
          new w.MouseEvent("click", { bubbles: true })
        )
        await wait(200)
        const sheet = d.querySelector("[data-period-picker]").closest("dialog")
        const sheetRect = sheet.getBoundingClientRect()
        check(
          `Zeitraum, Telefon ${width} px: der Wähler kommt als Blatt von unten`,
          // volle Breite des Fensters ohne Scrollleiste
          sheet.open &&
            near(sheetRect.bottom, height, 2) &&
            near(sheetRect.width, d.documentElement.clientWidth, 2),
          `${Math.round(sheetRect.bottom)} ${Math.round(sheetRect.width)}`
        )
        sheet.close()
        if (width === 390) {
          const jump = await recordJump(f, "[data-card-line]")
          check(
            "Zeitraum, Telefon 390 px: „zeigen“ an einem Rekord springt zur gewählten Scheibe",
            jump.ok,
            jump.detail
          )
        }
        f.remove()
      }
      const desk2 = await openFrame(1280, 900, "#history")
      const d2 = desk2.contentDocument
      const w2 = desk2.contentWindow
      // die Liste füllt die Höhe der Spalte mit dem Verlauf (D1), mindestens 240 px wie die Schusstabelle
      const column = d2.querySelector('[data-section="history"]')
      const listCard = d2.querySelector("#card-list")
      const listBottom = listCard.getBoundingClientRect().bottom
      const columnBottom = column.getBoundingClientRect().bottom
      check(
        "Zeitraum, Desktop: die Liste reicht bis ans Ende der Spalte des Verlaufs",
        listBottom >= columnBottom - 3 &&
          (near(listBottom, columnBottom, 3) || listCard.getBoundingClientRect().height <= 260),
        `${Math.round(listBottom)} / ${Math.round(columnBottom)}`
      )
      const list = d2.querySelector("#card-list > div")
      check(
        "Zeitraum, Desktop: die Liste scrollt in sich, die Ablesung steht als Karte",
        !!list &&
          list.scrollHeight > list.clientHeight &&
          !!d2.querySelector("[data-card-readout]")?.offsetParent &&
          d2.documentElement.scrollWidth <= 1280
      )
      desk2.remove()
      const tallPeriod = await tallJump("#history", "Zahlen", "numbers", (f) =>
        recordJump(f, "[data-card-readout]")
      )
      check(
        "Zeitraum, hohes Fenster 1440 × 1400: „Zahlen“ erreicht die Leiste und ist aktiv",
        near(tallPeriod.top, 56, 3) && tallPeriod.active === "Zahlen",
        `${Math.round(tallPeriod.top)} ${tallPeriod.active}`
      )
      check(
        "Zeitraum, hohes Fenster 1440 × 1400: „zeigen“ an einem Rekord springt zur gewählten Scheibe",
        tallPeriod.after.ok,
        tallPeriod.after.detail
      )
      // ---------- Scheiben-Liste (Plan N2, Task 9)
      const Li = () => L().list
      const listRows = () => $$("[data-card-row]").map((r) => r.dataset.cardRow)
      await click(area("Scheiben"), 400)
      const evenings = Li().model.evenings
      // Art ohne Kürzel (U3, D7): Wettkampf als Pokal, Training ohne Zeichen, Training nur aus Probe als „Probe“; den
      // Namen hört der Screenreader einmal, der Tooltip steht am verborgenen Zeichen (Review U3)
      const kindMarks = $$("[data-card-row] [data-kind]")
      const seen = (mark) =>
        [...mark.childNodes]
          .filter((n) => !(n.classList && n.classList.contains("sr-only")))
          .map((n) => n.textContent)
          .join("")
          .trim()
      const byKind = (kind) => kindMarks.filter((m) => m.dataset.kind === kind)
      check(
        "Liste: Art als Pokal, ohne Zeichen oder „Probe“, keine Kürzel",
        byKind("competition").length > 0 &&
          byKind("competition").every(
            (m) =>
              !!$('[aria-hidden="true"][title="Wettkampf"] svg.lucide-trophy', m) && seen(m) === ""
          ) &&
          byKind("training").length > 0 &&
          byKind("training").every((m) => !$("svg", m) && seen(m) === "") &&
          byKind("probe").length > 0 &&
          byKind("probe").every((m) => seen(m) === "Probe") &&
          kindMarks.every((m) => !/^[TWP]$/.test(seen(m)) && !m.closest("td[title]")),
        `${byKind("competition").length} Wettkampf · ${byKind("training").length} Training · ${byKind("probe").length} nur Probe`
      )
      const listJargon = jargonIn($("main"))
      check("Liste: ohne Fachbegriffe", !listJargon, listJargon ?? "")
      // am Desktop stehen Familie und Chip in einer Zeile (U5, D6; Review U5: am Telefon prüft die Zeile nichts)
      const deskControls = [...$("[data-list-controls]").children].filter(
        (c) => c.tagName !== "DIALOG"
      )
      // Mitten statt Oberkanten: Segmente und Chip sind verschieden hoch und mittig ausgerichtet
      const rowOf = (c) => {
        const r = c.getBoundingClientRect()
        return Math.round((r.top + r.bottom) / 2)
      }
      const deskTops = new Set(deskControls.map(rowOf))
      check(
        "Liste, Desktop: Familie und Chip in einer Zeile",
        deskControls.length === 2 && deskTops.size === 1,
        `${deskControls.length} Elemente in ${deskTops.size} Zeilen`
      )
      // das Blatt „Filter“ der Liste setzt Art und Merkmal, der Chip fasst zusammen (U5, D6)
      const listSheet = () => $("[data-list-filter]").closest("dialog")
      await click($("[data-list-chip]"), 150)
      const sheetOpened = listSheet().open
      await click(button("Wettkampf", listSheet()), 200)
      // das Blatt wirkt sofort und bleibt offen (anders als „Übernehmen“ im Fortschritt)
      const stillOpen = listSheet().open
      const afterKind = [Li().query.kind, txt($("[data-list-chip]")).trim()]
      await click(button("Nur PDF", listSheet()), 200)
      const afterFlag = [Li().query.flag, txt($("[data-list-chip]")).trim()]
      await click(button("Alle", $('[role="radiogroup"][aria-label="Merkmal"]', listSheet())), 150)
      await click(button("Alle", $('[role="radiogroup"][aria-label="Art"]', listSheet())), 150)
      await click($('button[aria-label="Schließen"]', listSheet()), 100)
      check(
        "Liste: das Blatt „Filter“ setzt Art und Merkmal sofort, der Chip fasst zusammen, zurück auf „Alle Scheiben“",
        sheetOpened &&
          stillOpen &&
          !listSheet().open &&
          afterKind.join() === "competition,Wettkampf" &&
          afterFlag.join() === "nur-pdf,Wettkampf · Nur PDF" &&
          Li().query.kind === "all" &&
          Li().query.flag === null &&
          txt($("[data-list-chip]")).trim() === "Alle Scheiben",
        `${afterKind.join("/")} · ${afterFlag.join("/")} · ${txt($("[data-list-chip]")).trim()}`
      )
      check(
        "Liste: Abende neueste zuerst, die Scheiben eines Abends in zeitlicher Folge, wie im Modell",
        evenings.length > 20 &&
          $$("[data-evening]")
            .map((e) => e.dataset.evening)
            .join() === evenings.map((e) => e.day).join() &&
          evenings.every((e, i) => !i || evenings[i - 1].day > e.day) &&
          evenings.every((e) =>
            e.rows.every((r, i) => !i || e.rows[i - 1].startedAtMs <= r.startedAtMs)
          ) &&
          listRows().join() === evenings.flatMap((e) => e.rows.map((r) => r.id)).join(),
        `${evenings.length} Abende`
      )
      // Ergebnis, Ø und Abstand selbst nachgerechnet: Familie lg-freihand, alle Arten, Zehntel
      const familyCards = Li()
        .cards.filter((c) => Li().families[c.id] === Li().model.family)
        .sort((a, b) => a.startedAtMs - b.startedAtMs)
      const meanValues = tools.analysis.cardValues(
        familyCards,
        tools.metricByKey("result.decimalMean"),
        "decimal",
        { includeProbeOnly: true }
      )
      // mit Vorzeichen auf zwei Stellen, eine gerundete Null ohne (wie die Bausteine)
      const signed2 = (v) => `${Number(v.toFixed(2)) > 0 ? "+" : ""}${nf(v, 2)}`
      const wrongRows = []
      for (const row of evenings.slice(0, 12).flatMap((e) => e.rows)) {
        const card = familyCards.find((c) => c.id === row.id)
        const el = $(`[data-card-row="${row.id}"]`)
        const i = meanValues.findIndex((v) => v.id === row.id)
        const before = meanValues.slice(Math.max(0, i - 5), i)
        const delta = before.length
          ? meanValues[i].value - before.reduce((s, v) => s + v.value, 0) / before.length
          : null
        // beide Wertungen in eigenen Spalten, die amtliche fett (U5, D5); nur Probe prüft der Test des Modells
        const resultIn = (scoring) =>
          tools.computeMetric(
            tools.inScoring(tools.metricByKey("result.decimal"), scoring),
            card.shots
          )
        const shown = (scoring) => nf(resultIn(scoring), scoring === "rings" ? 0 : 1)
        const officialCell = $("[data-official]", el)
        const ok =
          (row.kind === "probe" ||
            (txt($("[data-rings]", el)) === shown("rings") &&
              txt($("[data-decimal]", el)) === shown("decimal") &&
              (card.official
                ? !!officialCell &&
                  officialCell.hasAttribute(
                    card.official === "rings" ? "data-rings" : "data-decimal"
                  )
                : !officialCell))) &&
          txt($("[data-mean]", el)) === nf(meanValues[i].value, 2) &&
          txt($("[data-delta]", el)) === (delta === null ? "–" : signed2(delta))
        if (!ok) wrongRows.push(row.id)
      }
      const shownRows = evenings.slice(0, 12).flatMap((e) => e.rows)
      check(
        "Liste: Ergebnis in beiden Wertungen mit Namen (amtlich fett), Ø und Abstand je Zeile wie im Fachkern",
        wrongRows.length === 0 &&
          shownRows.some((r) => r.resultScoring === "rings" && r.official) &&
          shownRows.some((r) => r.resultScoring === "decimal" && r.official),
        wrongRows.join(" ")
      )
      const listAddress = addr()
      check(
        "Liste: die Adresse nennt die Familie",
        listAddress === "/cards?family=lg-freihand" && routeOf(listAddress).page === "cards",
        listAddress
      )
      // Mischabend: der Hinweis wechselt die Familie und springt zum Abend; Art und Merkmal fallen dabei weg (Review)
      await click(button("Training", $("[data-list-controls]")), 300)
      const mixed = $("[data-other-family]")
      const mixedDay = mixed?.closest("[data-evening]")?.dataset.evening
      await click(mixed, 300)
      const mixedTop = document.getElementById(mixedDay)?.getBoundingClientRect().top ?? -1
      check(
        "Liste: ein Mischabend nennt die andere Familie, Antippen wechselt sie und zeigt den Abend",
        !!mixedDay &&
          Li().query.family === "lp-freihand" &&
          addr() === "/cards?family=lp-freihand" &&
          !!$(`[data-evening="${mixedDay}"]`) &&
          mixedTop >= 0 &&
          mixedTop < window.innerHeight,
        `${mixedDay} · ${addr()} · ${Math.round(mixedTop)}`
      )
      await click(button("Luftgewehr", $("[data-list-controls]")), 300)
      // Art: nur Wettkämpfe; öffnen und zurück behält die Art (Review)
      await click(button("Wettkampf", $("[data-list-controls]")), 300)
      const kinds = Li().model.evenings.flatMap((e) => e.rows.map((r) => r.kind))
      check(
        "Liste: Art „Wettkampf“ zeigt nur Wettkämpfe",
        kinds.length === 11 &&
          kinds.every((k) => k === "competition") &&
          addr().includes("kind=competition"),
        `${kinds.length} · ${addr()}`
      )
      const competitionAddress = addr()
      await click($(`[data-card-row="${Li().model.evenings[1].rows[0].id}"]`), 500)
      await click(link("Zurück zu „Scheiben“"), 500)
      check(
        "Liste: „Zurück“ aus einer gefilterten Liste behält die Art",
        !!$("[data-card-list-page]") &&
          addr() === competitionAddress &&
          Li().query.kind === "competition",
        addr()
      )
      await click(button("Alle", $("[data-list-controls]")), 300)
      // Öffnen und zurück: Filter und Scrollstelle bleiben
      // ein Abend weit unten, damit die Seite scrollen muss (das Fenster der Prüfung ist über 2000 px hoch)
      const openId = Li().model.evenings[40].rows[0].id
      $(`[data-card-row="${openId}"]`).scrollIntoView({ block: "center" })
      await wait(50)
      const listY = window.scrollY
      await click($(`[data-card-row="${openId}"]`), 500)
      check(
        "Liste: eine Zeile öffnet die Scheibe mit der Liste als Herkunft",
        addr().startsWith(`/cards/${openId}?from=list&family=lg-freihand`) &&
          routeOf(addr()).origin?.from === "list" &&
          !!link("Zurück zu „Scheiben“"),
        addr()
      )
      await click(link("Zurück zu „Scheiben“"), 500)
      check(
        "Liste: „Zurück“ stellt Filter und Scrollstelle wieder her",
        !!$("[data-card-list-page]") &&
          addr() === listAddress &&
          listY > 0 &&
          near(window.scrollY, listY, 5),
        `${addr()} · ${Math.round(window.scrollY)} / ${Math.round(listY)}`
      )
      // Querverweise: Liste → Zeitraum „Alles“, Zeitraum → Liste mit Zeitraum-Chip
      await click(link("Im Fortschritt zeigen"), 400)
      check(
        "Liste: „Im Fortschritt zeigen“ (im Blatt „Filter“) öffnet den Zeitraum „Alles“ der Familie",
        P()?.state.family === "lg-freihand" &&
          P().state.choice.type === "all" &&
          addr().startsWith("/progress?range=all&family=lg-freihand"),
        addr()
      )
      await choose("Neue Munition")
      // die Wertung des Zeitraums geht mit in die Liste und zurück (Review N2); sie kommt seit U2 aus Profil
      await deviceScoring("Ganze Ringe")
      await click(link("Alle in Scheiben zeigen"), 400)
      check(
        "Zeitraum: „Alle in Scheiben zeigen“ zeigt die Liste mit dem Zeitraum als Chip",
        !!$("[data-card-list-page]") &&
          txt($("[data-range-chip]")).startsWith("Neue Munition") &&
          addr().startsWith("/cards?range=") &&
          Li().model.evenings.every((e) => e.day >= "2026-08-01"),
        `${txt($("[data-range-chip]"))} · ${addr()}`
      )
      // ohne amtliche Wertung (nur Probe) ist keine fett, die ganzen Ringe stehen trotzdem in ihrer Spalte
      const probeFront = Li()
        .model.evenings.flatMap((e) => e.rows)
        .filter((r) => !r.official)
        .map((r) =>
          $(`[data-card-row="${r.id}"] [data-official]`)
            ? "fett"
            : txt($(`[data-card-row="${r.id}"] [data-rings]`))
        )
      const listScoring = Li().model.scoring
      await click(link("Im Fortschritt zeigen"), 400)
      check(
        "Liste: die Wertung des Zeitraums gilt in der Liste und im Rückweg „Im Fortschritt zeigen“",
        listScoring === "rings" &&
          probeFront.length > 0 &&
          probeFront.every((r) => r === "–" || /^\d+$/.test(r)) &&
          P()?.state.scoring === "rings" &&
          addr().includes("scoring=rings"),
        `${probeFront.slice(0, 3).join(" ")} · ${addr()}`
      )
      await deviceScoring("Zehntel")
      await click(link("Alle in Scheiben zeigen"), 400)
      await click($("[data-list-chip]"), 150)
      await click(button("Zeitraum entfernen"), 300)
      const rangeSheet = $("[data-list-filter]").closest("dialog")
      // der Knopf verschwindet, der Fokus bleibt im Blatt auf der gewählten Art (Review U5)
      const focusAfterRange = document.activeElement
      check(
        "Liste: „×“ entfernt den Zeitraum, der Fokus bleibt im offenen Blatt auf der gewählten Art",
        !$("[data-range-chip]") &&
          addr() === listAddress &&
          rangeSheet.open &&
          focusAfterRange?.getAttribute("aria-checked") === "true" &&
          !!focusAfterRange.closest('[role="radiogroup"][aria-label="Art"]'),
        `${addr()} · ${focusAfterRange?.textContent ?? "kein Fokus"}`
      )
      await click($('button[aria-label="Schließen"]', rangeSheet), 100)
      // die Disziplin bleibt beim Wechsel über die Leiste oben, in beide Richtungen (User, 9. Oktober 2026)
      await click(button("Luftpistole", $("[data-list-controls]")), 300)
      await click(area("Fortschritt"), 400)
      const periodFamily = P()?.state.family
      await click(button("Luftgewehr", $("[data-period-controls]")), 300)
      await click(area("Scheiben"), 400)
      check(
        "Liste ↔ Zeitraum über die Leiste: die gewählte Disziplin bleibt",
        periodFamily === "lp-freihand" &&
          Li().query.family === "lg-freihand" &&
          addr() === "/cards?family=lg-freihand",
        `${periodFamily} · ${Li().query.family} · ${addr()}`
      )

      // ---------- Rahmen der App (Plan N3)
      const shown = (el) =>
        !!el && el.ownerDocument.defaultView.getComputedStyle(el).display !== "none"
      const areasOf = (nav) => [...nav.querySelectorAll("a[data-area]")].map((a) => a.dataset.area)
      const roundTrips = (href) =>
        L().tools.nav.urlFromRoute(L().tools.nav.routeFromUrl(...urlParts(href))) === href
      // Bereiche merken sich ihren Zustand (D4): Art und Familie bleiben, der Link trägt die Familie
      await click(button("Luftpistole", $("[data-list-controls]")), 300)
      await click(button("Wettkampf", $("[data-list-controls]")), 300)
      const progressHref = area("Fortschritt")?.getAttribute("href") ?? ""
      await click(area("Fortschritt"), 400)
      const familyThere = P()?.state.family
      await click(area("Scheiben"), 400)
      check(
        "Rahmen: „Fortschritt“ trägt die Familie, „Scheiben“ kehrt mit Art und Familie zurück",
        progressHref.includes("family=lp-freihand") &&
          familyThere === "lp-freihand" &&
          Li().query.family === "lp-freihand" &&
          Li().query.kind === "competition",
        `${progressHref} · ${familyThere} · ${addr()}`
      )
      // und die Scrollstelle, wenn man zur selben Adresse zurückkehrt
      await click(button("Luftgewehr", $("[data-list-controls]")), 300)
      await click(button("Alle", $("[data-list-controls]")), 300)
      scrollTo(0, 800)
      await wait(50)
      const listScroll = window.scrollY
      await click(area("Fortschritt"), 400)
      await click(area("Scheiben"), 400)
      check(
        "Rahmen: zurück in „Scheiben“ an derselben Stelle",
        listScroll > 0 && near(window.scrollY, listScroll, 5),
        `${Math.round(window.scrollY)} / ${Math.round(listScroll)}`
      )
      // Blättern aus der Liste (D5): die zeitlichen Nachbarn unter den Wettkämpfen, das Ende ausgegraut
      await click(button("Wettkampf", $("[data-list-controls]")), 300)
      const competitionIds = Li()
        .model.evenings.flatMap((e) => e.rows)
        .sort((a, b) => a.startedAtMs - b.startedAtMs || (a.id < b.id ? -1 : 1))
        .map((r) => r.id)
      const middle = competitionIds[5]
      const rowTime = txt($(`[data-card-row="${middle}"]`)).match(/\d{2}:\d{2}/)?.[0]
      await click($(`[data-card-row="${middle}"]`), 500)
      // der Kopf der Scheibe nennt Art, Datum und dieselbe Uhrzeit wie die Zeile (User, 9. Oktober 2026)
      const headMeta = txt($("[data-card-header] p"))
      check(
        "Scheibe aus der Liste: der Kopf nennt Art, Wochentag mit Datum und die Uhrzeit der Zeile",
        !!rowTime &&
          headMeta.startsWith("Wettkampf · ") &&
          /· [A-Z][a-z] \d{2}\.\d{2}\.\d{4} · /.test(headMeta) &&
          headMeta.endsWith(`· ${rowTime}`),
        `${headMeta} · Zeile ${rowTime}`
      )
      const idOf = (el) => (el ? routeOf(el.getAttribute("href")).id : null)
      const prevId = idOf(link("Vorige Scheibe"))
      const nextId = idOf(link("Nächste Scheibe"))
      const contextLinks = $$("[data-card-context] a").map((a) => a.getAttribute("href"))
      // ein anderer Reiter als der erste, dann blättern: die nächste Scheibe beginnt mit „Überblick“ (User, 9. Oktober 2026)
      const themes = () => $('[role="radiogroup"][aria-label="Thema"]')
      const checkedTheme = () => txt($('[aria-checked="true"]', themes()))
      await click(button("Lage", themes()), 150)
      const before = checkedTheme()
      await click(link("Nächste Scheibe"), 500)
      const pagedTo = routeOf(addr())
      const afterPaging = checkedTheme()
      // auch eine Scheibe, die man aus der Liste neu öffnet, beginnt mit dem ersten Reiter
      await click(button("Präzision", themes()), 150)
      await click(link("Zurück zu „Scheiben“"), 500)
      check(
        "Blättern aus der Liste: vorige und nächste sind die zeitlichen Nachbarn mit denselben Filtern, zurück in die Liste",
        competitionIds.length === 11 &&
          prevId === competitionIds[4] &&
          nextId === competitionIds[6] &&
          pagedTo.id === competitionIds[6] &&
          pagedTo.origin?.query.kind === "competition" &&
          Li().query.kind === "competition" &&
          contextLinks.length === 3 &&
          contextLinks.every(roundTrips),
        `${prevId} ‹ ${middle} › ${nextId} · ${addr()}`
      )
      await click($(`[data-card-row="${competitionIds.at(-1)}"]`), 500)
      check(
        "Reiter: blättern und eine andere Scheibe öffnen beginnt immer mit dem ersten Reiter, ohne Reiter in der Adresse",
        before === "Lage" &&
          afterPaging === "Überblick" &&
          !pagedTo.anchor?.tab &&
          checkedTheme() === "Überblick" &&
          !routeOf(addr()).anchor?.tab,
        `${before} → ${afterPaging}, geöffnet ${checkedTheme()}`
      )
      check(
        "Blättern: bei der neuesten Scheibe ist „nächste“ ausgegraut",
        !link("Nächste Scheibe") &&
          !!$('[data-card-context] [data-pager="next"][aria-disabled="true"]') &&
          idOf(link("Vorige Scheibe")) === competitionIds.at(-2)
      )
      await click(link("Zurück zu „Scheiben“"), 500)
      await click(button("Alle", $("[data-list-controls]")), 300)
      // Desktop 1280 px: Seitenleiste mit allen Bereichen, Admin zuletzt, Zähler, die Seite daneben
      const deskFrame = await openFrame(1280, 900)
      const fd = deskFrame.contentDocument
      const sidebar = fd.querySelector("[data-app-sidebar]")
      const pageLeft = fd.querySelector("[data-app-content] > *")?.getBoundingClientRect().left ?? 0
      check(
        "Rahmen 1280 px: Seitenleiste mit Start, Scheiben, Fortschritt, QR scannen, Profil, Admin; Zähler; Seite daneben",
        shown(sidebar) &&
          areasOf(sidebar).join() === "start,cards,progress,scan,profile,admin" &&
          txt(sidebar.querySelector("[data-badge]")) === "2" &&
          sidebar.querySelector('[aria-current="page"]')?.dataset.area === "cards" &&
          !shown(fd.querySelector("[data-app-bar]")) &&
          !shown(fd.querySelector("[data-app-rail]")) &&
          pageLeft >= 224 &&
          [...sidebar.querySelectorAll("a")].every((a) => roundTrips(a.getAttribute("href"))),
        `${areasOf(sidebar).join()} · Seite ab ${Math.round(pageLeft)}`
      )
      deskFrame.remove()
      // Telefon 390 px: untere Leiste, Scannen erhaben in der Mitte, kein Admin, die letzte Zeile über der Leiste
      const barFrame = await openFrame(390, 844)
      const bd = barFrame.contentDocument
      const bw = barFrame.contentWindow
      const bar = bd.querySelector("[data-app-bar]")
      const barTops = [...bar.querySelectorAll("a[data-area]")].map(
        (a) => a.getBoundingClientRect().top
      )
      bw.scrollTo(0, bd.documentElement.scrollHeight)
      await wait(100)
      const lastRow = [...bd.querySelectorAll("[data-card-row]")].at(-1)
      const lastBottom = lastRow?.getBoundingClientRect().bottom ?? 9999
      // der Rahmen hält unten den Platz der Leiste frei, unabhängig vom Abstand der Seite selbst
      const contentPad = parseFloat(
        bw.getComputedStyle(bd.querySelector("[data-app-content]")).paddingBottom
      )
      check(
        "Rahmen 390 px: untere Leiste mit fünf Bereichen, Scannen erhaben in der Mitte, kein Admin; nichts unter ihr versteckt",
        shown(bar) &&
          areasOf(bar).join() === "start,cards,scan,progress,profile" &&
          barTops[2] < Math.min(barTops[0], barTops[1], barTops[3], barTops[4]) - 8 &&
          !shown(bd.querySelector("[data-app-sidebar]")) &&
          lastBottom <= 844 - 72 &&
          contentPad >= 72 &&
          bd.documentElement.scrollWidth <= 390,
        `${areasOf(bar).join()} · Scannen ${Math.round(barTops[2])} · letzte Zeile bis ${Math.round(lastBottom)} · Abstand ${contentPad}`
      )
      barFrame.remove()
      // Telefon quer: die schmale Leiste links statt der unteren (D1)
      const railFrame = await openFrame(812, 375)
      const rd2 = railFrame.contentDocument
      const rail = rd2.querySelector("[data-app-rail]")
      const railMain = rd2.querySelector("[data-app-content]")
      const railLeft =
        rd2.querySelector("[data-app-content] > *")?.getBoundingClientRect().left ?? 0
      const railPad = parseFloat(railFrame.contentWindow.getComputedStyle(railMain).paddingBottom)
      check(
        "Rahmen 812 × 375: schmale Leiste links, die Seite rechts davon, unten kein Platz für eine Leiste",
        shown(rail) &&
          areasOf(rail).join() === "start,cards,scan,progress,profile" &&
          !shown(rd2.querySelector("[data-app-bar]")) &&
          railLeft >= 64 &&
          railPad === 0 &&
          rd2.documentElement.scrollWidth <= 812,
        `${areasOf(rail).join()} · Seite ab ${Math.round(railLeft)} · unten ${railPad} · ${rd2.documentElement.scrollWidth}`
      )
      railFrame.remove()

      // ---------- Start (Plan N5)
      await click(area("Start"), 500)
      const St = () => L().start
      const startBlock = St()?.model.blocks[0]
      const blockEl = startBlock ? $(`[data-evening-block="${startBlock.family}"]`) : null
      // die große Zahl selbst nachgerechnet: Ø je Schuss über alle Wertungsschüsse des Abends dieser Familie
      const eveningIds = new Set(startBlock?.rows.map((r) => r.id) ?? [])
      const eveningShots = (St()?.cards ?? [])
        .filter((c) => eveningIds.has(c.id))
        .flatMap((c) => c.shots.filter((x) => x.kind === "match"))
      const eveningMean = tools.computeMetric(
        tools.inScoring(tools.metricByKey("result.decimalMean"), "decimal"),
        eveningShots
      )
      const lead = {
        within: "Im Formband",
        above: "Über dem Formband",
        below: "Unter dem Formband",
      }
      const sentenceText = txt($("[data-evening-sentence]", blockEl)).trim()
      check(
        "Start: der letzte Abend mit seiner Zahl, nachgerechnet, und dem Satz, der zum Urteil passt",
        !!$("[data-start-page]") &&
          !txt($("header")).includes("Platzhalter") &&
          !!blockEl &&
          eveningMean !== null &&
          txt($("[data-evening-mean]", blockEl)) === tools.formatValue(eveningMean, 2) &&
          (startBlock.verdict
            ? sentenceText.startsWith(lead[startBlock.verdict])
            : !Object.values(lead).some((l) => sentenceText.startsWith(l))),
        `${startBlock?.day} ${startBlock?.family} · ${txt($("[data-evening-mean]", blockEl))} · ${sentenceText}`
      )
      const startJargon = jargonIn($("[data-start-page]"))
      check("Start: ohne Fachbegriffe", !startJargon, startJargon ?? "")
      // Formband als kleiner Verlauf (U5, D1): Scheiben in zeitlicher Folge, das Datum des Abends statt „Abend“, die
      // Legende erklärt Punkte und Linie, den Satz zum Band nur mit Band
      const stripDots = $$("[data-strip-dot]", blockEl).map((c) => ({
        id: c.dataset.stripDot,
        x: Number(c.getAttribute("cx")),
      }))
      const stripDate = txt($("[data-evening-label]", blockEl))
      check(
        "Start: Formband als Verlauf, Scheiben von links nach rechts in zeitlicher Folge, Datum des Abends",
        stripDots.map((d) => d.id).join() === startBlock.strip.map((s) => s.id).join() &&
          stripDots.every((d, i) => !i || d.x > stripDots[i - 1].x) &&
          /^(Mo|Di|Mi|Do|Fr|Sa|So) \d\d\.\d\d\.$/.test(stripDate) &&
          !!$("[data-mean]", blockEl) &&
          !$("[data-average]", blockEl),
        `${stripDots.length} Punkte · ${stripDate}`
      )
      check(
        "Start: Legende unter dem Verlauf, „gestrichelt“ nur mit gestricheltem Stück, der Satz zum Band nur mit Band",
        St().model.blocks.every((b) => {
          const legend = txt($(`[data-evening-block="${b.family}"] [data-form-legend]`))
          return (
            legend.startsWith(
              "Grau: deine letzten Scheiben. Die Linie ist der Schnitt der jeweils letzten fünf"
            ) &&
            legend.includes("gestrichelt") === b.strip.some((x) => x.partial) &&
            legend.includes("Das Band zeigt deine übliche Schwankung.") === !!b.band
          )
        })
      )
      // die Kacheln brechen nur zwischen den Wertungen um, nie in „ganze / Ringe“ (Review U5; 1280 px wie gemeldet)
      const resultSpans = $$("[data-start-result] span", $("[data-start-page]"))
      const brokenSpans = resultSpans.filter((sp) => sp.getClientRects().length > 1)
      check(
        "Start: Ergebnis in den Kacheln ohne Umbruch mitten in einer Wertung",
        resultSpans.length > 0 && brokenSpans.length === 0,
        `${brokenSpans.length} von ${resultSpans.length} umbrochen · ${brokenSpans.map((sp) => txt(sp)).join(" | ")}`
      )
      check(
        "Start: der Streifen zeigt die letzten Scheiben, die des Abends hervorgehoben",
        $$("[data-strip-dot]", blockEl).length === startBlock.strip.length &&
          $$('[data-strip-dot][data-tonight="true"]', blockEl).length ===
            startBlock.strip.filter((x) => x.tonight).length &&
          startBlock.strip.filter((x) => x.tonight).length === startBlock.rows.length,
        `${startBlock.strip.length} Punkte`
      )
      const startLinks = $$("[data-start-page] a[href]").map((a) => a.getAttribute("href"))
      check(
        "Start: Offen mit zwei Einträgen und dem Zähler am Rahmen; jede Adresse übersteht Lesen und Schreiben",
        $$("[data-open-item]").length === 2 &&
          txt($("[data-app-sidebar] [data-badge]")) === "2" &&
          startLinks.length > 0 &&
          startLinks.every(roundTrips),
        `${startLinks.length} Links`
      )
      // der letzte Abend ist ein Mischabend (Review N5): zwei Blöcke, die Kacheln der Luftpistole nebeneinander
      const blocks = St().model.blocks
      const tilesOf = (root, family) =>
        [...root.querySelectorAll(`[data-evening-block="${family}"] [data-start-card]`)].map((a) =>
          a.getBoundingClientRect()
        )
      const pistolTiles = tilesOf(document, "lp-freihand")
      check(
        "Start: der Mischabend in zwei Blöcken, die beiden Kacheln der Luftpistole nebeneinander",
        blocks.map((b) => b.family).join() === "lg-freihand,lp-freihand" &&
          // die Disziplin als Überschrift jedes Blocks (Rückmeldung des Users)
          $$("[data-evening-block] h2")
            .map((h) => txt(h).trim())
            .join() === "Luftgewehr,Luftpistole" &&
          pistolTiles.length === 2 &&
          Math.abs(pistolTiles[0].top - pistolTiles[1].top) < 1 &&
          pistolTiles[1].left > pistolTiles[0].right,
        `${blocks.map((b) => `${b.family}:${b.rows.length}`).join(" ")}`
      )
      // Telefon 390 px: kein seitliches Scrollen, die Kacheln mindestens 56 px hoch
      const startPhone = await openFrame(390, 844)
      const sp = startPhone.contentDocument
      const tile = sp.querySelector("[data-start-card]")
      const phoneTiles = tilesOf(sp, "lp-freihand")
      check(
        "Start, Telefon 390 px: kein seitliches Scrollen, die Kachel mit kleiner Scheibe von 56 px, keine Kachel zu schmal",
        !!sp.querySelector("[data-start-page]") &&
          sp.documentElement.scrollWidth <= 390 &&
          (tile?.getBoundingClientRect().height ?? 0) >= 56 &&
          // nebeneinander, wo zwei passen, sonst untereinander (Plan N5, Task 8); jede mindestens 12,5 rem, keine
          // überlappt die andere (die Breite hängt am Scrollbalken des Prüffensters)
          phoneTiles.length === 2 &&
          phoneTiles.every((r) => r.width >= 200) &&
          (phoneTiles[1].top >= phoneTiles[0].bottom - 1 ||
            phoneTiles[1].left >= phoneTiles[0].right),
        `${sp.documentElement.scrollWidth} · Kachel ${Math.round(tile?.getBoundingClientRect().height ?? 0)}`
      )
      startPhone.remove()
      // eine Kachel öffnet die Scheibe mit Start als Herkunft; Blättern im Abend, zurück nach Start
      const startOrder = St()
        .model.blocks.flatMap((b) => b.rows)
        .sort((a, b) => a.startedAtMs - b.startedAtMs || (a.id < b.id ? -1 : 1))
        .map((r) => r.id)
      const firstTile = startBlock.rows[0].id
      await click($(`[data-start-card="${firstTile}"]`), 500)
      const fromStart = addr()
      const at0 = startOrder.indexOf(firstTile)
      const pageId = (el) => (el ? routeOf(el.getAttribute("href")).id : null)
      check(
        "Start: eine Kachel öffnet die Scheibe mit Start als Herkunft; Blättern durch den Abend; zurück heißt „Start“",
        fromStart.startsWith(`/cards/${firstTile}?from=start`) &&
          startOrder.length === 3 &&
          !!$('[data-card-context] [data-pager="prev"]') &&
          !!$('[data-card-context] [data-pager="next"]') &&
          pageId(link("Nächste Scheibe")) === startOrder[1] &&
          pageId(link("Vorige Scheibe")) === (startOrder[at0 - 1] ?? null) &&
          pageId(link("Nächste Scheibe")) === (startOrder[at0 + 1] ?? null) &&
          !!link("Zurück zu „Start“"),
        `${fromStart} · ${startOrder.join(" ")}`
      )
      await click(link("Zurück zu „Start“"), 500)
      const formHref = $("[data-form-line]")?.getAttribute("href") ?? ""
      const formRoute = formHref ? routeOf(formHref) : null
      await click($("[data-form-line]"), 500)
      check(
        "Start: zurück nach Start; die Form-Zeile führt in den Fortschritt mit Familie und Vergleich mit davor",
        formRoute?.page === "progress" &&
          formRoute.query.compare.type === "previous" &&
          P()?.state.compare.type === "previous" &&
          P()?.state.family === formRoute.query.family,
        `${formHref} · ${P()?.state.family}`
      )
      await click(area("Scheiben"), 400)

      // ---------- Labor näher an der App: Werkzeuge im Blatt, Darstellung an der Seite
      const laborDialog = () => $("[data-labor-panel]").closest("dialog")
      await click($("[data-labor-button]"), 200)
      const laborOpen = laborDialog().open
      const laborText = txt($("[data-labor-panel]"))
      await click($('button[aria-label="Schließen"]', laborDialog()), 200)
      check(
        "Labor: der Knopf „Labor-Werkzeuge“ öffnet das Blatt mit Stand, Adresse und Beispielscheiben, Schließen schließt",
        $("[data-labor-button]")?.getAttribute("aria-label") === "Labor-Werkzeuge" &&
          laborOpen &&
          /Stand [0-9a-f]{7}/.test(laborText) &&
          laborText.includes("Adresse in der App") &&
          !!button("Beispielscheiben öffnen", $("[data-labor-panel]")) &&
          !laborDialog().open,
        laborText.slice(0, 60)
      )
      // keine Ansicht hat einen Labor-Kopf: der Kopf der Seite steht oben (Labor näher an der App, D1)
      const tops = {}
      for (const [name, selector] of [
        ["Start", "[data-start-page]"],
        ["Scheiben", "[data-list-header]"],
        ["Fortschritt", "[data-period-header]"],
      ]) {
        await click(area(name), 300)
        tops[name] = pageHeadTop(selector)
        if (name === "Fortschritt") tops.catalog = catalogHeads(document).length
      }
      await click(area("Scheiben"), 300)
      check(
        "Labor: Start, Scheiben und Fortschritt beginnen oben mit ihrem Kopf, kein Labor-Kopf davor; im Fortschritt keine Katalog-Verweise",
        Object.keys(tops).length === 4 &&
          ["Start", "Scheiben", "Fortschritt"].every((name) => tops[name] < 80) &&
          tops.catalog === 0,
        JSON.stringify(tops)
      )
      const themeIn = (root) => $("[data-theme-switch]", root)
      // der Umschalter passt in die Seitenleiste (innen 12 px Rand), nichts steht über
      const sideBox = $("[data-app-sidebar]").getBoundingClientRect()
      const sideSwitch = $('[role="radiogroup"]', themeIn($("[data-app-sidebar]")))
      const sideSwitchBox = sideSwitch?.getBoundingClientRect()
      check(
        "Darstellung: der Umschalter passt in die Seitenleiste, kein Knopf steht über",
        !!sideSwitchBox &&
          sideSwitchBox.right <= sideBox.right - 12 &&
          sideSwitch.scrollWidth <= sideSwitch.clientWidth,
        `${Math.round(sideSwitchBox?.right ?? 0)} ≤ ${Math.round(sideBox.right - 12)}`
      )
      const wasTheme = txt($('[aria-checked="true"]', themeIn($("[data-app-sidebar]"))))
      await click(button("Dunkel", themeIn($("[data-app-sidebar]"))), 150)
      const dark = document.documentElement.classList.contains("dark")
      await click(button("Hell", themeIn($("[data-app-sidebar]"))), 150)
      const light = !document.documentElement.classList.contains("dark")
      // genau die Wahl davor zurück (auch „System“), sonst bliebe sie für die späteren Rahmen gespeichert
      await click(button(wasTheme, themeIn($("[data-app-sidebar]"))), 150)
      await click(area("Profil"), 300)
      const themeInProfile = !!themeIn($('[data-placeholder="profile"]'))
      await click(area("Scheiben"), 300)
      check(
        "Darstellung: unten in der Seitenleiste wechselt sie Hell und Dunkel, in Profil gibt es sie auch",
        dark && light && themeInProfile,
        `${dark} ${light} ${themeInProfile}`
      )
      // Fehler (Review U2): Die Wertung, die eine Scheibe umschaltet, ist die des Geräts; der Fortschritt folgt ihr, auch
      // wenn man über die Navigation hinkommt (er hat keinen Schalter mehr und zeigt nicht, welche gilt)
      await click(area("Start"), 300)
      await click($("[data-start-card]"), 500)
      await click(button("Ganze Ringe"), 150)
      await click(area("Fortschritt"), 400)
      const followedScoring = P().state.scoring
      const followedAddress = addr()
      await deviceScoring("Zehntel")
      check(
        "Wertung: „Ganze Ringe“ auf einer Scheibe, dann über die Navigation in den Fortschritt: ganze Ringe",
        followedScoring === "rings" && followedAddress.includes("scoring=rings"),
        `${followedScoring} · ${followedAddress}`
      )
      // Fehler (User, 9. Oktober 2026): Die Sprungleiste schreibt #analysis in die Adresse; die Beispielscheibe las ihn
      // beim Öffnen wie einen Anker beim Laden und begann bei der Analyse. Sie beginnt oben mit dem ersten Reiter
      await click(area("Fortschritt"), 300)
      await click(link("Analyse", $('nav[aria-label="Abschnitte"]')), 200)
      const staleHash = location.hash
      await click($("[data-labor-button]"), 200)
      await click(inLabor("Beispielscheiben öffnen"), 400)
      const sampleHead = Math.round($("[data-card-header]")?.getBoundingClientRect().top ?? 999)
      const sampleTab = txt(
        $('[role="radiogroup"][aria-label="Thema"] [aria-checked="true"]') ?? document.body
      ).slice(0, 20)
      const sampleScroll = Math.round(scrollY)
      await click($("[data-labor-button]"), 200)
      await click(inLabor("Zurück zur App"), 400)
      check(
        "Labor: nach der Sprungleiste (#analysis) beginnt die Beispielscheibe oben mit „Überblick“",
        staleHash === "#analysis" &&
          sampleScroll < 40 &&
          sampleHead >= 0 &&
          sampleHead < 80 &&
          sampleTab === "Überblick",
        `${staleHash} · scrollY ${sampleScroll} · Kopf ${sampleHead} · ${sampleTab}`
      )
      // derselbe Fehler auf dem zweiten Weg: mit einem Anker der Scheibe geladen (#position), zuerst eine andere Ansicht
      // (hier der Fortschritt), dann die Beispielscheibe; der Anker beim Laden gilt nur für die erste Ansicht
      const loaded = await openFrame(1280, 900, "#position")
      const ld = loaded.contentDocument
      const firstIsPeriod = !!ld.querySelector("[data-period-header]")
      await frameClick(loaded, ld.querySelector("[data-labor-button]"), 200)
      await frameClick(
        loaded,
        [...ld.querySelectorAll("[data-labor-panel] button")].find(
          (b) => txt(b) === "Beispielscheiben öffnen"
        ),
        400
      )
      const loadedTab = txt(
        ld.querySelector('section[aria-label="Analyse"] [role="radio"][aria-checked="true"]') ??
          ld.body
      ).slice(0, 20)
      loaded.remove()
      check(
        "Labor: mit #position geladen, erst der Fortschritt, dann die Beispielscheibe: Reiter „Überblick“",
        firstIsPeriod && loadedTab === "Überblick",
        `${firstIsPeriod} · ${loadedTab}`
      )
      try {
        history.replaceState(null, "", "#pruefen")
      } catch {
        // ohne Verlauf bleibt der Anker; die folgenden Prüfungen lesen ihn nicht
      }
      await click(area("Scheiben"), 300)
      // die Beispielscheiben über das offene Blatt, zurück zur App in den letzten Bereich; danach kein Blatt mehr offen
      // und der Fokus auf dem neuen Knopf (Review)
      await click($("[data-labor-button]"), 200)
      const sheetOpen = !!$(":modal")
      await click(inLabor("Beispielscheiben öffnen"), 400)
      const inSamples = !!$("[data-card-header]") && !!inLabor("Zurück zur App") && !$(":modal")
      const focusInSamples = document.activeElement?.hasAttribute("data-labor-button")
      await click($("[data-labor-button]"), 200)
      await click(inLabor("Zurück zur App"), 400)
      check(
        "Labor: „Beispielscheiben öffnen“ zeigt die Beispiele, „Zurück zur App“ kehrt in die Liste zurück, Blatt zu, Fokus am Knopf",
        sheetOpen &&
          inSamples &&
          focusInSamples &&
          !!$("[data-card-list-page]") &&
          !$(":modal") &&
          document.activeElement?.hasAttribute("data-labor-button"),
        `${sheetOpen} ${inSamples} ${focusInSamples} ${document.activeElement?.tagName} · ${addr()}`
      )
      // Telefon 390 px: der Knopf steht über der unteren Leiste
      const laborPhone = await openFrame(390, 844)
      const laborButton = laborPhone.contentDocument
        .querySelector("[data-labor-button]")
        ?.getBoundingClientRect()
      check(
        "Labor, Telefon 390 px: der Knopf steht über der unteren Leiste",
        !!laborButton && laborButton.bottom <= 844 - 72 && laborButton.right <= 390,
        `${Math.round(laborButton?.top ?? 0)}–${Math.round(laborButton?.bottom ?? 0)}`
      )
      laborPhone.remove()
      // Telefon 375 px mit einem Abend als Anker: kein seitliches Scrollen, ohne Uhrzeit, Abstand und Schuss
      const phoneDay = Li().model.evenings[2].day
      const phone = await openFrame(375, 812, `#${phoneDay}`)
      const pd = phone.contentDocument
      const pw = phone.contentWindow
      const phoneRow = pd.querySelector("[data-card-row]")
      const hiddenCells = phoneRow
        ? [...phoneRow.children].filter((c) => pw.getComputedStyle(c).display === "none").length
        : -1
      const phoneDayTop = pd.getElementById(phoneDay)?.getBoundingClientRect().top ?? -1
      // die Tabelle passt in ihre Karte: kein Scrollen in der Karte, das Datum bleibt sichtbar
      const tableBoxes = [...pd.querySelectorAll("[data-month] table")].map((t) => t.parentElement)
      const overflowing = tableBoxes.filter((box) => box.scrollWidth > box.clientWidth + 1).length
      check(
        "Liste, Telefon 375 px: der Anker eines Abends öffnet die Liste am Abend, kein seitliches Scrollen, auch nicht in einer Karte, drei Spalten weniger",
        !!pd.querySelector("[data-card-list-page]") &&
          pd.documentElement.scrollWidth <= 375 &&
          hiddenCells === 3 &&
          tableBoxes.length > 0 &&
          overflowing === 0 &&
          pw.scrollY > 0 &&
          phoneDayTop >= 0 &&
          phoneDayTop < 812,
        `${pd.documentElement.scrollWidth} · ${hiddenCells} · ${Math.round(phoneDayTop)} · ${overflowing} von ${tableBoxes.length} Karten zu breit`
      )
      // Filter in einer Zeile wie im Fortschritt (U5, D6): vor der Liste nur Familie und Chip, Art und Merkmal im Blatt
      const listControls = [...pd.querySelector("[data-list-controls]").children].filter(
        (c) => c.tagName !== "DIALOG"
      )
      const listControlTops = new Set(
        listControls.map((c) => {
          const r = c.getBoundingClientRect()
          return Math.round((r.top + r.bottom) / 2)
        })
      )
      // mit längerer Zusammenfassung darf der Chip unter die Familie rutschen (mit „Alle Scheiben“ füllen beide die 343 px
      // genau); geprüft wird die Zahl der Bedienelemente (mit Art in der Zeile wären es drei), die eine Zeile am Desktop
      check(
        "Liste, Telefon 375 px: vor der Liste nur zwei Bedienelemente, Familie und Chip; Art und Merkmal im Blatt „Filter“",
        listControls.length === 2 &&
          listControlTops.size <= 2 &&
          listControls.includes(pd.querySelector("[data-list-chip]")) &&
          !!pd.querySelector('dialog [aria-label="Art"]'),
        `${listControls.length} Elemente in ${listControlTops.size} Zeilen · ${listControls.map((c) => Math.round(c.getBoundingClientRect().width)).join("+")} in ${Math.round(pd.querySelector("[data-list-controls]").getBoundingClientRect().width)}`
      )
      phone.remove()
      await click(area("Fortschritt"), 300)
      await click(button("Beispielscheiben öffnen", $("[data-labor-panel]")), 300)
      // #numbers hat seit U1 nur noch die Seite eines Zeitraums: Er öffnet sie, auch wenn zuletzt die Scheibe gewählt war
      const reload = await openFrame(1280, 900, "#numbers")
      check(
        "Labor: der Anker #numbers öffnet die Seite eines Zeitraums (U1: nur sie hat „Zahlen“)",
        !reload.contentDocument.querySelector("[data-card-header]") &&
          !!reload.contentDocument.querySelector("[data-period-header]")
      )
      reload.remove()
      const tallCard = await tallJump("", "Analyse", "analysis")
      check(
        "Scheibe, hohes Fenster 1440 × 1400: „Analyse“ erreicht die Leiste und ist aktiv",
        near(tallCard.top, 56, 3) && tallCard.active === "Analyse",
        `${Math.round(tallCard.top)} ${tallCard.active}`
      )
    }

    check("Keine Skriptfehler", window.__errors.length === 0, window.__errors.join(" | "))
  } catch (error) {
    log.push(`FAIL Skriptprüfung abgebrochen — ${error?.stack ?? error}`)
  }

  const pre = document.createElement("pre")
  pre.id = "dbg"
  pre.textContent = log.join("\n")
  document.body.appendChild(pre)
})
