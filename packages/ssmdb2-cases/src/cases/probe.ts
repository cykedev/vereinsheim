// Fälle zur Probe: nur Probe, lange Probe, Probe weg mit der Wertung, zurück auf Probe, Umschalten vergessen, Neustart.

import { numbers } from "../expected"
import { defineCase, evening, idAt } from "./case"
import { away, fire, group, LG40, LP20, LP40 } from "./helpers"

const SF01_START = evening(1)
const SF01_ID = idAt(SF01_START)

export const SF_01 = defineCase({
  id: "SF-01",
  title: "Nur Probe",
  description:
    "Ein Training nur aus Probe: 20 Schuss in zwei Serien, dann ist der Stand frei. Die Kopfzeile zählt 0 Treffer und 0 Ringe; Spiegel nimmt es trotzdem als Training.",
  start: SF01_START,
  run(sim) {
    const card = sim.card({ ...LP40, scheibenId: SF01_ID, standNr: 4 })
    fire(sim, card, 0, group(10, 101, 900))
    sim.read("10 Probeschüsse")
    fire(sim, card, 0, group(10, 102, 900))
    sim.read("20 Probeschüsse")
    away(sim, 6 * 60_000)
    sim.read("Stand frei, nichts geändert")
  },
  expected: [
    {
      scheibenId: SF01_ID,
      bridge: "senden",
      sentReadings: [1, 2],
      shots: [
        [10, 0],
        [20, 0],
        [20, 0],
      ],
      flags: ["nur-probe"],
      completeness: "nur-probe",
      counted: { stellung: 0, numbers: numbers(1, 20) },
      notes: ["Kein Filter auf `Trefferzahl` oder `TotalRing`: Beide sind 0."],
    },
  ],
})

const SF02_START = evening(2)
const SF02_ID = idAt(SF02_START)

export const SF_02 = defineCase({
  id: "SF-02",
  title: "Lange Probe vor LP 40",
  description:
    "60 Probeschüsse, dann 40 Wertung. Nach der Probe ist die Scheibe nicht fertig: Gegen die Schusszahl der Disziplin zählt nur Wertung.",
  start: SF02_START,
  run(sim) {
    const card = sim.card({ ...LP40, scheibenId: SF02_ID, standNr: 7 })
    fire(sim, card, 0, group(60, 201, 1000), 30_000)
    sim.read("60 Probeschüsse, noch keine Wertung")
    fire(sim, card, 1, group(20, 202, 800))
    sim.read("20 Wertungsschüsse, die Probe ist weg")
    fire(sim, card, 1, group(20, 203, 800))
    sim.read("40 Wertungsschüsse")
  },
  expected: [
    {
      scheibenId: SF02_ID,
      bridge: "senden",
      sentReadings: [1, 2, 3],
      shots: [
        [60, 0],
        [0, 20],
        [0, 40],
      ],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 40) },
      blocks: [
        { stellung: 0, numbers: numbers(1, 60) },
        { stellung: 1, numbers: numbers(1, 40) },
      ],
      notes: [
        "Lesung 1: 60 Probe und keine Wertung ist „nur Probe“, nicht fertig.",
        "Lesung 2: 20 von 40 Wertung ist unvollständig, solange das Lebenszeichen läuft offen.",
      ],
    },
  ],
})

const SF03_START = evening(3)
const SF03_ID = idAt(SF03_START)

export const SF_03 = defineCase({
  id: "SF-03",
  title: "Probe weg mit dem ersten Wertungsschuss",
  description:
    "Fünf Probeschüsse, dann Wertung: Meyton löscht die Probe in derselben Lesung, in der der erste Wertungsschuss steht. Das ist der Normalfall, keine Korrektur.",
  start: SF03_START,
  run(sim) {
    const card = sim.card({ ...LP20, scheibenId: SF03_ID, standNr: 2 })
    fire(sim, card, 0, group(5, 301, 900))
    sim.read("5 Probeschüsse")
    fire(sim, card, 1, group(1, 302, 800))
    sim.read("1 Wertungsschuss, die Probe ist weg")
    fire(sim, card, 1, group(19, 303, 800))
    sim.read("20 Wertungsschüsse")
  },
  expected: [
    {
      scheibenId: SF03_ID,
      bridge: "senden",
      sentReadings: [1, 2, 3],
      shots: [
        [5, 0],
        [0, 1],
        [0, 20],
      ],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      blocks: [
        { stellung: 0, numbers: numbers(1, 5) },
        { stellung: 1, numbers: numbers(1, 20) },
      ],
      notes: [
        "Die Probe steht nur in Lesung 1; in Spiegel ist sie eine eigene Scheibe vor der Wertung.",
        "Lesung 2 ist keine Korrektur: Probe verschwindet, Wertung kommt dazu.",
      ],
    },
  ],
})

const SF04_START = evening(4)
const SF04_ID = idAt(SF04_START)

export const SF_04 = defineCase({
  id: "SF-04",
  title: "Zurück von Wertung auf Probe",
  description:
    "Zehn Wertungsschüsse, dann drei Probeschüsse, dann wieder Wertung. Angenommen, nicht beobachtet (Schießprotokoll SP-0.6): Die Probe nach der Wertung beginnt wieder bei 1 und verschwindet mit Wertungsschuss 11.",
  start: SF04_START,
  run(sim) {
    const card = sim.card({ ...LP20, scheibenId: SF04_ID, standNr: 5 })
    fire(sim, card, 0, group(3, 401, 900))
    fire(sim, card, 1, group(10, 402, 800))
    fire(sim, card, 0, group(3, 403, 900))
    sim.read("10 Wertung, danach 3 Probe")
    fire(sim, card, 1, group(10, 404, 800))
    sim.read("20 Wertung, die Probe ist wieder weg")
  },
  expected: [
    {
      scheibenId: SF04_ID,
      bridge: "senden",
      sentReadings: [1, 2],
      shots: [
        [3, 10],
        [0, 20],
      ],
      flags: [],
      completeness: "vollstaendig",
      counted: { stellung: 1, numbers: numbers(1, 20) },
      notes: [
        "Lesung 1: zwischen Probe und Wertung zählt die Zeit, je Stellung die Nummer (Leitregel 2).",
        "Abstände von Wertungsschuss 10 zu 11 gelten trotz der Probe dazwischen (keine Lücke, `stepsInOrder`).",
      ],
    },
  ],
})

const SF05_START = evening(5)
const SF05_ID = idAt(SF05_START)

export const SF_05 = defineCase({
  id: "SF-05",
  title: "Umschalten vergessen",
  description:
    "40 Schuss Luftgewehr, alle in der Probe: Der Schütze hat vergessen, auf Wertung zu schalten. Die Ablage zeigt ein Training nur aus Probe.",
  start: SF05_START,
  run(sim) {
    const card = sim.card({ ...LG40, scheibenId: SF05_ID, standNr: 9 })
    fire(sim, card, 0, group(40, 501, 150))
    sim.read("40 Probeschüsse")
    away(sim, 10 * 60_000)
    sim.read("Stand frei")
  },
  expected: [
    {
      scheibenId: SF05_ID,
      bridge: "senden",
      sentReadings: [1],
      shots: [
        [40, 0],
        [40, 0],
      ],
      flags: ["nur-probe"],
      completeness: "nur-probe",
      counted: { stellung: 0, numbers: numbers(1, 40) },
      notes: [
        "„Als Wertung zählen“ (Merkmal `als-wertung-gezaehlt`) ist eine Aktion des Schützen in Spiegel, nicht des Einlesens.",
      ],
    },
  ],
})

const SF72_START = evening(6)
const SF72_ID = idAt(SF72_START)

export const SF_72 = defineCase({
  id: "SF-72",
  title: "Neustart der Probe",
  description:
    "Acht Probeschüsse, dann ein Neustart der Probe: Mit dem ersten neuen Schuss sind die alten weg, die Nummern beginnen wieder bei 1, die ScheibenID bleibt.",
  start: SF72_START,
  run(sim) {
    const card = sim.card({ ...LP40, scheibenId: SF72_ID, standNr: 3 })
    fire(sim, card, 0, group(8, 721, 1100))
    sim.read("8 Probeschüsse")
    card.restartProbe()
    sim.advance(90_000)
    sim.read("Neustart, noch kein neuer Schuss: die alte Probe steht noch")
    fire(sim, card, 0, group(5, 722, 900))
    sim.read("5 neue Probeschüsse, die alten sind weg")
  },
  expected: [
    {
      scheibenId: SF72_ID,
      bridge: "senden",
      sentReadings: [1, 3],
      shots: [
        [8, 0],
        [8, 0],
        [5, 0],
      ],
      flags: ["nur-probe"],
      completeness: "nur-probe",
      counted: { stellung: 0, numbers: numbers(1, 5) },
      blocks: [
        { stellung: 0, numbers: numbers(1, 8) },
        { stellung: 0, numbers: numbers(1, 5) },
      ],
      notes: [
        "Jeder Block ist eine eigene Scheibe in Spiegel; am Ausdruck steht nur der letzte.",
        "Schuss 1 nach dem Neustart ist ein anderer Schuss als Schuss 1 davor: Abgleich über den Fingerabdruck (Zeit, Millisekunden, Lage), nicht die Nummer.",
      ],
    },
  ],
})

export const PROBE_CASES = [SF_01, SF_02, SF_03, SF_04, SF_05, SF_72]
