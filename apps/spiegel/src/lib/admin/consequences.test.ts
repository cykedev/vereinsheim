import { describe, expect, it } from "vitest"

import {
  accountChange,
  accountChangesOf,
  bridgeRemove,
  bridgeRevoke,
  cardDelete,
  cardPurgeNow,
  consentConfirm,
  consentReject,
  consentRemove,
  notMine,
  notMineLift,
  OLD_WORDS,
  ownConsentRevoke,
  ownRejectionRemove,
  rankingKind,
  type Decision,
} from "./consequences"

const who = "Max Muster"
const sportpassId = "12345678"

/** jeder Entscheid sagt, worum es geht, was passiert und wie es zurückgeht; kein Platzhalter bleibt stehen */
function wellFormed(decision: Decision) {
  expect(decision.title).not.toBe("")
  expect(decision.about).not.toBe("")
  expect(decision.happens.length).toBeGreaterThan(0)
  expect(decision.undo).not.toBe("")
  expect(JSON.stringify(decision)).not.toMatch(/[<>]|undefined|null/)
}

describe("Folgen der Sportpassnummern (Admin, Wortlaut aus dem Textbuch, P2f)", () => {
  it("bestätigen: was Spiegel holt, auch ältere, die jüngste zur Kontrolle, was nie geholt wird", () => {
    const d = consentConfirm({ who, sportpassId })
    wellFormed(d)
    expect(d).toEqual({
      title: "Sportpassnummer von Max Muster bestätigen?",
      about:
        "Max Muster hat die Sportpassnummer 12345678 eingetragen und möchte die eigenen Scheiben automatisch in Spiegel bekommen.",
      check:
        "Gehört 12345678 in der Meyton-Schützenverwaltung zu Max Muster? Wenn nicht: ablehnen.",
      happens: [
        "Spiegel holt ab jetzt jede Scheibe, die unter dieser Nummer geschossen wird. Läuft die Brücke gerade, dauert das wenige Minuten.",
        "Auch ältere Scheiben unter dieser Nummer holt Spiegel, soweit die Meyton-Anlage sie noch hat. Das passiert, wenn dort niemand schießt.",
        "Max Muster bestätigt die jüngste Scheibe einmal in der App unter „Offen“. Erst danach erscheinen alle im Konto.",
      ],
      notHappening: [
        "Du siehst die Schüsse von Max Muster nicht.",
        "Scheiben mit verdeckter Wertung (etwa beim Königsschießen) holt Spiegel nie.",
        "Was Max Muster gelöscht hat, kommt nicht wieder.",
      ],
      undo: "Jederzeit mit „Entfernen“. Scheiben, die schon da sind, bleiben bei Max Muster.",
      confirmLabel: "Nummer bestätigen",
      destructive: false,
    })
  })

  it("nach „nicht meine“, bei deaktiviertem Konto, nach dem Holen, mit zurückgewiesenen", () => {
    const returned = consentConfirm({ who, sportpassId, returned: true })
    wellFormed(returned)
    expect(returned.about).toBe(
      "Max Muster hat die jüngste Scheibe unter der Sportpassnummer 12345678 als „nicht meine“ zurückgewiesen. Spiegel hat die wartenden Scheiben gelöscht und die Nummer wieder dir zur Prüfung gegeben."
    )
    expect(returned.check).toBe(
      "Gehört 12345678 wirklich zu Max Muster? Vielleicht hat jemand am Stand einen fremden Namen gewählt. Wenn die Nummer nicht passt: ablehnen."
    )
    // deaktiviert: kein „holt ab jetzt“ davor, das dem widerspräche (Review P2f)
    const inactive = consentConfirm({ who, sportpassId, accountActive: false })
    expect(inactive.happens[0]).toBe(
      "Das Konto von Max Muster ist deaktiviert. Solange das so bleibt, holt Spiegel nichts. Danach holt Spiegel jede Scheibe, die unter dieser Nummer geschossen wird."
    )
    expect(inactive.happens.join(" ")).not.toContain("ab jetzt")
    const loaded = consentConfirm({ who, sportpassId, historyOpen: false, notMine: 2 })
    expect(loaded.happens.join(" ")).not.toContain("ältere Scheiben")
    expect(loaded.notHappening).toContain(
      "Die 2 zurückgewiesenen Scheiben („nicht meine“) kommen nicht wieder, außer du lässt sie wieder zu."
    )
    expect(consentConfirm({ who, sportpassId, notMine: 1 }).notHappening).toContain(
      "Die 1 zurückgewiesene Scheibe („nicht meine“) kommt nicht wieder, außer du lässt sie wieder zu."
    )
  })

  it("ablehnen und entfernen", () => {
    const reject = consentReject({ who, sportpassId })
    wellFormed(reject)
    expect(reject).toEqual({
      title: "Sportpassnummer von Max Muster ablehnen?",
      about: "Max Muster hat die Sportpassnummer 12345678 eingetragen.",
      happens: [
        "Spiegel holt unter dieser Nummer keine Scheiben.",
        "Max Muster sieht im Profil „abgelehnt“. Danach kann Max Muster die Zeile entfernen und die Nummer neu eintragen.",
      ],
      notHappening: ["Es wird nichts gelöscht."],
      undo: "Trägt Max Muster die Nummer neu ein, kannst du sie bestätigen.",
      confirmLabel: "Ablehnen",
      destructive: true,
    })
    const remove = consentRemove({ who, sportpassId })
    wellFormed(remove)
    expect(remove).toEqual({
      title: "Sportpassnummer von Max Muster entfernen?",
      about: "Die Sportpassnummer 12345678 wird vom Konto von Max Muster getrennt.",
      happens: [
        "Ab sofort holt Spiegel unter dieser Nummer nichts mehr.",
        "Die Nummer ist wieder frei. Jedes Konto kann sie neu eintragen.",
      ],
      notHappening: [
        "Scheiben, die schon da sind, bleiben bei Max Muster. Löschen kann sie nur Max Muster selbst.",
      ],
      undo: "Max Muster trägt die Nummer im Profil neu ein, und du bestätigst sie.",
      confirmLabel: "Entfernen",
      destructive: true,
    })
  })

  it("wieder zulassen: Vorgeschichte, wer es sagen muss, was Spiegel holt, wo es wartet", () => {
    const d = notMineLift({ who, sportpassId, cards: 2, consentActive: true })
    wellFormed(d)
    expect(d).toEqual({
      title: "Zurückgewiesene Scheiben wieder zulassen?",
      about:
        "Unter der Sportpassnummer 12345678 wurden 2 Scheiben als „nicht meine“ zurückgewiesen. Spiegel hat sie deshalb gelöscht und nimmt sie nicht mehr an.",
      check: "Mach das nur, wenn Max Muster dir sagt: Das waren doch meine Scheiben.",
      happens: [
        "Spiegel holt die 2 Scheiben noch einmal aus der Meyton-Anlage. Das passiert, sobald dort niemand schießt.",
        "Hat die Anlage sie inzwischen gelöscht, kommen sie nicht mehr.",
        "Max Muster muss sie in der App unter „Offen“ bestätigen. Bis dahin landen auch neue Scheiben von Max Muster zuerst dort.",
      ],
      notHappening: ["Du siehst die Schüsse von Max Muster nicht."],
      undo: "Max Muster kann sie unter „Offen“ wieder als „nicht meine“ zurückweisen.",
      confirmLabel: "Wieder zulassen",
      destructive: false,
    })
    const later = notMineLift({ who, sportpassId, cards: 1, consentActive: false })
    expect(later.about).toContain("wurde 1 Scheibe als „nicht meine“ zurückgewiesen")
    expect(later.happens[0]).toBe(
      "Die Scheibe kommt erst, wenn du die Sportpassnummer wieder bestätigt hast."
    )
  })
})

describe("Folgen an Brücke und Listen", () => {
  it("Brücke trennen: sofort, nichts gelöscht, nicht rückgängig", () => {
    const d = bridgeRevoke({ device: "Pi im Schützenhaus" })
    wellFormed(d)
    expect(d).toEqual({
      title: "Brücke „Pi im Schützenhaus“ trennen?",
      about: "Das Gerät „Pi im Schützenhaus“ schickt Scheiben an Spiegel.",
      happens: ["Ab sofort nimmt Spiegel von diesem Gerät nichts mehr an."],
      notHappening: ["Es wird keine Scheibe gelöscht.", "Andere Brücken laufen weiter."],
      undo: "Nicht möglich. Um das Gerät wieder zu nutzen, verbinde es mit einem neuen Code.",
      confirmLabel: "Trennen",
      destructive: true,
    })
  })

  it("getrennte Brücke entfernen: aus der Liste, nichts gelöscht, nicht rückgängig (Textbuch rev 20)", () => {
    const d = bridgeRemove({ device: "Mac (Kopie 9.10.)" })
    wellFormed(d)
    expect(d).toEqual({
      title: "Getrennte Brücke „Mac (Kopie 9.10.)“ entfernen?",
      about: "Das Gerät „Mac (Kopie 9.10.)“ ist getrennt und schickt nichts mehr.",
      happens: ["Es verschwindet aus dieser Liste."],
      notHappening: [
        "Es wird keine Scheibe gelöscht.",
        "Was das Gerät geschickt hat, bleibt in Spiegel.",
      ],
      undo: "Nicht möglich. Das Gerät lässt sich mit einem neuen Code wieder verbinden.",
      confirmLabel: "Entfernen",
      destructive: true,
    })
  })

  it("Liste: Scheiben in Spiegel, das Ergebnis kann wechseln, Schüsse nicht", () => {
    const d = rankingKind({ ranking: "RWK_LP", cards: 23, kind: "competition" })
    wellFormed(d)
    expect(d).toEqual({
      title: "„RWK_LP“ als Wettkampf zählen?",
      about: "In Spiegel gehören 23 Scheiben zur Liste „RWK_LP“.",
      happens: [
        "Diese 23 Scheiben und alle neuen dieser Liste zählen als Wettkampf, in den Scheiben und im Fortschritt.",
        "Spiegel zeigt das Ergebnis dann so, wie die Disziplin im Wettkampf gewertet wird, etwa in ganzen Ringen statt Zehnteln.",
      ],
      notHappening: [
        "Hat ein Schütze eine Scheibe selbst umgestellt, bleibt es dabei.",
        "Eine Scheibe nur mit Probeschüssen bleibt Training.",
        "An den Schüssen ändert sich nichts.",
      ],
      undo: "Jederzeit hier wieder umstellen.",
      confirmLabel: "Als Wettkampf zählen",
      destructive: false,
    })
    expect(rankingKind({ ranking: "Training-LP", cards: 1, kind: "training" })).toMatchObject({
      title: "„Training-LP“ als Training zählen?",
      about: "In Spiegel gehört 1 Scheibe zur Liste „Training-LP“.",
      confirmLabel: "Als Training zählen",
    })
    const open = rankingKind({ ranking: "X", cards: 0, kind: "open" })
    expect(open).toMatchObject({
      title: "„X“ nicht festlegen?",
      about: "Noch keine Scheibe in Spiegel gehört zur Liste „X“.",
      confirmLabel: "Nicht festlegen",
    })
    expect(open.happens[0]).toBe(
      "Ihre Scheiben und alle neuen dieser Liste zählen dann so, wie Meyton sie vermerkt. Meist ist das Training."
    )
  })
})

describe("Konto ändern", () => {
  it("was das Formular ändert: nur Rolle, Status, Passwort", () => {
    const saved = { role: "USER" as const, isActive: true }
    expect(accountChangesOf(saved, { role: "USER", active: true, password: "" })).toEqual({})
    expect(accountChangesOf(saved, { role: "ADMIN", active: false, password: "x" })).toEqual({
      role: "ADMIN",
      active: false,
      password: true,
    })
    expect(accountChange({ who, changes: {} })).toBeNull()
  })

  it("nur die Folgen der geänderten Felder; abgemeldet genau einmal", () => {
    const deactivate = accountChange({ who, changes: { active: false } })!
    wellFormed(deactivate)
    expect(deactivate.about).toBe("Du änderst bei Max Muster: Status.")
    expect(deactivate.happens).toEqual([
      "Max Muster kann sich nicht mehr anmelden.",
      "Spiegel holt keine Scheiben mehr für Max Muster.",
      "Max Muster wird abgemeldet.",
    ])
    expect(deactivate.notHappening).toEqual([
      "Scheiben und Sportpassnummern bleiben. Es wird nichts gelöscht.",
    ])
    expect(deactivate.undo).toBe("Das Konto wieder aktivieren.")
    expect(deactivate.confirmLabel).toBe("Speichern")

    const all = accountChange({ who, changes: { role: "ADMIN", active: false, password: true } })!
    expect(all.about).toBe("Du änderst bei Max Muster: Rolle, Status, Passwort.")
    expect(all.happens.filter((line) => line.includes("abgemeldet"))).toHaveLength(1)
    expect(all.happens[0]).toBe(
      "Max Muster kann dann Konten, Sportpassnummern und die Brücke verwalten. Fremde Schüsse sieht auch ein Admin nie."
    )
    expect(all.check).toBe("Gib das neue Passwort persönlich weiter, nicht per Mail.")
    expect(all.undo).toBe(
      "Das Konto wieder aktivieren. Die Rolle hier zurückstellen. Das alte Passwort lässt sich nicht zurückholen. Du kannst jederzeit ein neues setzen."
    )
    expect(accountChange({ who, changes: { role: "USER" } })!.happens).toEqual([
      "Max Muster kommt nicht mehr in den Admin-Bereich.",
      "Max Muster wird abgemeldet.",
    ])
  })

  it("Passwort und Reaktivieren", () => {
    const password = accountChange({ who, changes: { password: true } })!
    expect(password.happens).toEqual([
      "Max Muster wird abgemeldet. Bei der nächsten Anmeldung muss Max Muster das neue Passwort durch ein eigenes ersetzen. Vorher ist nichts zu sehen.",
    ])
    const reactivate = accountChange({ who, changes: { active: true } })!
    expect(reactivate.happens).toEqual([
      "Max Muster kann sich wieder anmelden. Bestätigte Sportpassnummern gelten wieder.",
    ])
    expect(reactivate.undo).toBe("Das Konto wieder deaktivieren.")
  })
})

describe("Folgen beim Schützen", () => {
  const evening = "Di 13.10.2026 · 19:12"

  it("eigene Zustimmung widerrufen, abgelehnte Nummer entfernen", () => {
    const revoke = ownConsentRevoke({ sportpassId })
    wellFormed(revoke)
    expect(revoke).toEqual({
      title: "Zustimmung für 12345678 widerrufen?",
      about: "Scheiben mit der Sportpassnummer 12345678 kommen bisher von selbst in dein Konto.",
      happens: ["Ab sofort kommen keine neuen Scheiben mehr unter dieser Nummer."],
      notHappening: ["Scheiben, die schon da sind, bleiben, bis du sie löschst."],
      undo: "Neu zustimmen. Ein Admin prüft die Nummer dann noch einmal.",
      confirmLabel: "Widerrufen",
      destructive: true,
    })
    // nur eine aktive hat schon Scheiben gebracht (Review P2f)
    expect(ownConsentRevoke({ sportpassId, status: "requested" }).about).toBe(
      "Du hast für die Sportpassnummer 12345678 zugestimmt. Ein Admin hat die Nummer noch nicht geprüft."
    )
    expect(ownConsentRevoke({ sportpassId, status: "returned" }).about).toBe(
      "Ein Admin prüft die Sportpassnummer 12345678 gerade noch einmal."
    )
    const remove = ownRejectionRemove()
    wellFormed(remove)
    expect(remove).toMatchObject({
      title: "Abgelehnte Nummer entfernen?",
      about: "Ein Admin hat diese Sportpassnummer abgelehnt.",
      happens: ["Die Zeile verschwindet. Danach kannst du die Nummer neu eintragen."],
      notHappening: ["Scheiben kommen erst, wenn ein Admin die neu eingetragene Nummer bestätigt."],
      undo: "Nicht nötig.",
    })
  })

  it("nicht meine: eine, mehrere, ohne Nummer", () => {
    const one = notMine({ evening, more: 0, sportpassId })
    wellFormed(one)
    expect(one).toEqual({
      title: "Nicht deine Scheibe?",
      about: "Die Scheibe vom Di 13.10.2026 um 19:12 kam unter deiner Sportpassnummer 12345678.",
      happens: [
        "Spiegel löscht diese Scheibe. Sie kommt nicht von selbst wieder.",
        "Ein Admin prüft deine Sportpassnummer noch einmal. Bis dahin kommen keine Scheiben unter dieser Nummer.",
      ],
      notHappening: ["Deine anderen Scheiben bleiben."],
      undo: "Ein Admin kann sie wieder zulassen, solange die Nummer in deinem Profil steht. Sag dem Admin dann Bescheid.",
      confirmLabel: "Nicht meine",
      destructive: true,
    })
    const several = notMine({ evening, more: 35, sportpassId })
    expect(several.about).toBe(
      "Die Scheibe vom Di 13.10.2026 um 19:12 kam unter deiner Sportpassnummer 12345678. Mit ihr warten 35 weitere."
    )
    expect(several.happens[0]).toBe(
      "Spiegel löscht diese Scheibe und die 35 weiteren. Sie kommen nicht von selbst wieder."
    )
    expect(notMine({ evening, more: 1, sportpassId }).about).toContain("Mit ihr wartet 1 weitere.")
    // ohne Nummer geht keine Zustimmung zurück, und es gibt nichts wieder zuzulassen (Review)
    const without = notMine({ evening, more: 0, sportpassId: null })
    wellFormed(without)
    expect(without.about).toBe("Die Scheibe vom Di 13.10.2026 um 19:12 kam ohne Sportpassnummer.")
    expect(without.happens).toHaveLength(1)
    expect(without.undo).toBe("Nicht möglich.")
  })
})

describe("Löschen und Papierkorb", () => {
  const evening = "Di 13.10.2026 · 19:12"

  it("löschen: 30 Tage Papierkorb, zählt nirgends, danach endgültig", () => {
    const d = cardDelete({ evening })
    wellFormed(d)
    expect(d).toEqual({
      title: "Scheibe löschen?",
      about: "Du löschst die Scheibe vom Di 13.10.2026 um 19:12.",
      happens: [
        "Sie liegt 30 Tage im Papierkorb (im Profil). So lange zählt sie nirgends mit, auch nicht in Rekorden und Verläufen.",
        "Danach löscht Spiegel sie endgültig, mit allen Schüssen. Sie kommt nicht von selbst wieder.",
      ],
      notHappening: ["Deine anderen Scheiben bleiben.", "An der Meyton-Anlage ändert sich nichts."],
      undo: "30 Tage lang im Papierkorb wiederherstellen.",
      confirmLabel: "Löschen",
      destructive: true,
    })
  })

  it("endgültig löschen: sofort, Spiegel merkt sich nur, dass es sie gab", () => {
    const d = cardPurgeNow({ evening })
    wellFormed(d)
    expect(d).toEqual({
      title: "Endgültig löschen?",
      about: "Die Scheibe vom Di 13.10.2026 um 19:12 liegt im Papierkorb.",
      happens: [
        "Spiegel löscht sie sofort, mit allen Schüssen.",
        "Spiegel merkt sich nur, dass es sie gab. So holt Spiegel sie nicht von selbst wieder.",
      ],
      notHappening: ["An der Meyton-Anlage ändert sich nichts."],
      undo: "Nicht möglich.",
      confirmLabel: "Endgültig löschen",
      destructive: true,
    })
  })
})

/**
 * Schreibregeln als Leitplanke (P2f, D5; Lektion [[spiegel-dialog-texts-not-understood]]): keine Semikolons und keines der
 * alten Wörter des Codes. Ob ein Text verständlich ist, prüft ein Mensch; dieser Test hält nur fest, dass die alten
 * Fehler nicht zurückkommen.
 */
/** jeder Text eines Entscheids, ohne die Felder, die nur Code sind */
const textsOf = (decision: Decision) =>
  [
    decision.title,
    decision.about,
    decision.check ?? "",
    ...decision.happens,
    ...decision.notHappening,
    decision.undo,
    decision.confirmLabel,
  ].filter(Boolean)

describe("Schreibregeln (P2f)", () => {
  const evening = "Di 13.10.2026 um 19:12"
  const decisions: [string, Decision][] = [
    ["bestätigen", consentConfirm({ who, sportpassId })],
    [
      "bestätigen nach „nicht meine“",
      consentConfirm({ who, sportpassId, returned: true, notMine: 2 }),
    ],
    ["bestätigen, Konto deaktiviert", consentConfirm({ who, sportpassId, accountActive: false })],
    ["bestätigen, älteres geholt", consentConfirm({ who, sportpassId, historyOpen: false })],
    ["ablehnen", consentReject({ who, sportpassId })],
    ["entfernen", consentRemove({ who, sportpassId })],
    ["Brücke trennen", bridgeRevoke({ device: "Pi im Schützenhaus" })],
    ["Brücke entfernen", bridgeRemove({ device: "Mac (Kopie 9.10.)" })],
    ...(["competition", "training", "open"] as const).flatMap((kind) =>
      [0, 23].map(
        (cards) =>
          [`Liste ${kind} ${cards}`, rankingKind({ ranking: "RWK_LP", cards, kind })] as [
            string,
            Decision,
          ]
      )
    ),
    [
      "Konto ändern, alles",
      accountChange({ who, changes: { role: "ADMIN", active: false, password: true } })!,
    ],
    ["Konto ändern, Schütze", accountChange({ who, changes: { role: "USER" } })!],
    ["Konto ändern, aktivieren", accountChange({ who, changes: { active: true } })!],
    ["eigene Zustimmung widerrufen", ownConsentRevoke({ sportpassId })],
    ["abgelehnte Nummer entfernen", ownRejectionRemove()],
    ["nicht meine", notMine({ evening, more: 0, sportpassId })],
    ["nicht meine, mehrere", notMine({ evening, more: 35, sportpassId })],
    ["nicht meine, ohne Nummer", notMine({ evening, more: 0, sportpassId: null })],
    ["löschen", cardDelete({ evening })],
    ["endgültig löschen", cardPurgeNow({ evening })],
    ["wieder zulassen", notMineLift({ who, sportpassId, cards: 2, consentActive: true })],
    [
      "wieder zulassen, Nummer nicht aktiv",
      notMineLift({ who, sportpassId, cards: 1, consentActive: false }),
    ],
  ]

  it.each(decisions)("%s: keine Semikolons, keine alten Wörter", (_name, decision) => {
    for (const text of textsOf(decision)) expect(text).not.toMatch(OLD_WORDS)
  })

  it("„widerrufen“ nur bei der eigenen Zustimmung des Schützen", () => {
    for (const [name, decision] of decisions)
      if (name !== "eigene Zustimmung widerrufen")
        for (const text of textsOf(decision)) expect(text).not.toMatch(/widerruf/i)
  })
})
