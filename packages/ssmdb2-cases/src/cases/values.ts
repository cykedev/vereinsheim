// Fälle zu den Werten: Fehlschuss, Handeintrag, falsche Disziplin, unbekannte Disziplin, Ganzring-Disziplin,
// verdeckte Wertung, Wertungsmodus 0.

import { LG_10M, LP_10M } from "@vereinsheim/shot-core/targets"

import { numbers } from "../expected"
import { defineCase, evening, idAt } from "./case"
import { fire, group, LG20, LP20 } from "./helpers"

const SF14_START = evening(12)
const SF14_ID = idAt(SF14_START)

export const SF_14 = defineCase({
  id: "SF-14",
  title: "Fehlschuss und Treffer weit außen",
  description:
    "LG 20 mit einem Fehlschuss (Schuss 7, 26 mm neben der Mitte, Wert 0) und einem Treffer weit außen (Schuss 15). Zoom und Streukreis dürfen daran nicht explodieren.",
  start: SF14_START,
  run(sim) {
    const card = sim.card({ ...LG20, scheibenId: SF14_ID, standNr: 4 })
    const positions = group(20, 1401, 150)
    positions[6] = [2600, 0]
    positions[14] = [1800, -900]
    fire(sim, card, 1, positions)
    sim.read("20 Schuss")
  },
  expected: [
    {
      scheibenId: SF14_ID,
      bridge: "senden",
      shots: [[0, 20]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      shotFlags: { "1/7": ["fehlschuss"] },
      notes: [
        "Schuss 15 ist ein Treffer (2,9), kein Fehlschuss; Ausreißer erkennt die Analyse, nicht das Einlesen.",
      ],
    },
  ],
})

const SF15_START = evening(13)
const SF15_ID = idAt(SF15_START)

export const SF_15 = defineCase({
  id: "SF-15",
  title: "Handeintrag",
  description:
    "LG 20, Schuss 12 von Hand eingetragen: 9,5 bei Lage 0/0 und Teiler 0. Die Gegenprobe aus der Lage ergäbe 10,9: Der Schuss ist verdächtig.",
  start: SF15_START,
  run(sim) {
    const card = sim.card({ ...LG20, scheibenId: SF15_ID, standNr: 5 })
    fire(sim, card, 1, group(11, 1501, 150))
    card.handEntry(1, 95)
    sim.advance(45_000)
    fire(sim, card, 1, group(8, 1502, 150))
    sim.read("20 Schuss, Schuss 12 von Hand")
  },
  expected: [
    {
      scheibenId: SF15_ID,
      bridge: "senden",
      shots: [[0, 20]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      shotFlags: { "1/12": ["verdaechtig"] },
      notes: [
        "Verdächtig: nicht gezeichnet, kein Rekord; die Scheibe zählt weiter.",
        "Der beste Teiler der Kopfzeile ist 0 (vom Handeintrag) und taugt nicht als Rekord.",
      ],
    },
  ],
})

const SF16_START = evening(14)
const SF16_ID = idAt(SF16_START)

export const SF_16 = defineCase({
  id: "SF-16",
  title: "Falsche Disziplin gewählt",
  description:
    "Ein Luftgewehr-Schütze auf LP 20: Die enge Gruppe ergibt auf der Pistolenscheibe lauter Zehnen. Werte und Lage passen zueinander, die Gegenprobe ist grün, der Verlauf wäre trotzdem falsch.",
  start: SF16_START,
  run(sim) {
    const card = sim.card({ ...LP20, scheibenId: SF16_ID, standNr: 6 })
    fire(sim, card, 1, group(20, 1601, 150))
    sim.read("20 Schuss")
  },
  expected: [
    {
      scheibenId: SF16_ID,
      bridge: "senden",
      shots: [[0, 20]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      notes: [
        "Das Einlesen erkennt das nicht; „Disziplin korrigieren“ wertet aus x/y als Luftgewehr neu (Merkmal `neu-gewertet`, nicht amtlich).",
      ],
    },
  ],
})

const SF17_START = evening(15)
const SF17_ID = idAt(SF17_START)

export const SF_17 = defineCase({
  id: "SF-17",
  title: "Unbekannte Disziplin",
  description:
    "Eine erfundene Vereinsdisziplin (10198020, „Vereinsdisziplin“) ohne LG oder LP im Namen, geschossen auf der Luftgewehrscheibe.",
  start: SF17_START,
  run(sim) {
    const card = sim.card({
      disziplinId: 10198020,
      disziplin: "Vereinsdisziplin",
      target: LG_10M,
      display: 1,
      scheibenId: SF17_ID,
      standNr: 7,
    })
    fire(sim, card, 1, group(20, 1701, 150))
    sim.read("20 Schuss")
  },
  expected: [
    {
      scheibenId: SF17_ID,
      bridge: "senden",
      shots: [[0, 20]],
      flags: ["disziplin-unbekannt"],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      notes: [
        "Kein Scheibenbild aus Katalog oder Name; die Gegenprobe schlägt die Luftgewehrscheibe vor, der Admin bestätigt, bis dahin ein neutrales Raster.",
      ],
    },
  ],
})

const SF18_START = evening(16)
const SF18_ID = idAt(SF18_START)

export const SF_18 = defineCase({
  id: "SF-18",
  title: "Ganzring-Disziplin",
  description:
    "LP 20 nach DSB-Regel 2.10, gewertet in ganzen Ringen; die Ablage hat dazu die Zehntel (`Ring01`).",
  start: SF18_START,
  run(sim) {
    const card = sim.card({ ...LP20, scheibenId: SF18_ID, standNr: 8 })
    fire(sim, card, 1, group(20, 1801, 800))
    sim.read("20 Schuss")
  },
  expected: [
    {
      scheibenId: SF18_ID,
      bridge: "senden",
      shots: [[0, 20]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      notes: [
        "Amtlich ganze Ringe aus der Disziplin, nie aus `Treffer.Wertung` (SF-74); die Zehntel stehen daneben.",
      ],
    },
  ],
})

const SF19_START = evening(17)
const SF19_ID = idAt(SF19_START)

export const SF_19 = defineCase({
  id: "SF-19",
  title: "Verdeckte Wertung beim Königsschießen",
  description:
    "„König LP“ mit einem Schuss, komplett verdeckt (Anzeigeart 5): „***“, Ring und Zehntel 0, der Teiler steht trotzdem in der Ablage (so beobachtet).",
  start: SF19_START,
  run(sim) {
    const card = sim.card({
      disziplinId: 19100001,
      disziplin: "König LP",
      target: LP_10M,
      display: 5,
      scheibenId: SF19_ID,
      standNr: 9,
      person: { Rangliste: "König-LP" },
    })
    fire(sim, card, 1, [[310, -120]])
    sim.read("ein verdeckter Schuss")
  },
  expected: [
    {
      scheibenId: SF19_ID,
      bridge: "zurueckhalten",
      reason:
        "verdeckt ab dem ersten Schuss: Die Scheibe bleibt samt Kopfzeile in der Brücke, bis der Admin freigibt",
      shots: [[0, 1]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: [1] },
    },
  ],
})

const SF20_START = evening(18)
const SF20_ID = idAt(SF20_START)

export const SF_20 = defineCase({
  id: "SF-20",
  title: "Wertungsmodus 0",
  description:
    "LP 20 mit der Anzeigeart 0 (unbekannt) an jedem Schuss, `Text` leer. In zwei Jahren nie beobachtet; Annahme für den Fall, dass es vorkommt.",
  start: SF20_START,
  run(sim) {
    const card = sim.card({ ...LP20, display: 0, scheibenId: SF20_ID, standNr: 10 })
    fire(sim, card, 1, group(20, 2001, 800))
    sim.read("20 Schuss im Modus 0")
  },
  expected: [
    {
      scheibenId: SF20_ID,
      bridge: "zurueckhalten",
      reason:
        "Wertungsmodus 0: Der Admin gibt ihn je Disziplin frei, das Lebenszeichen zählt, was wartet",
      shots: [[0, 20]],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
    },
  ],
})

export const VALUE_CASES = [SF_14, SF_15, SF_16, SF_17, SF_18, SF_19, SF_20]
