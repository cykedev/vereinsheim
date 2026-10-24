import { describe, expect, it } from "vitest"

import {
  accountChange,
  accountChangesOf,
  bridgeRemove,
  bridgeRevoke,
  cardDelete,
  cardDiscipline,
  cardPurgeNow,
  cardShare,
  cardShareStop,
  consentConfirm,
  consentReject,
  consentRemove,
  disciplineChange,
  disciplineIgnore,
  disciplineRecalculates,
  disciplineShow,
  familyRemove,
  notMine,
  notMineLift,
  OLD_WORDS,
  type DisciplineMapping,
  ownConsentRevoke,
  ownRejectionRemove,
  rankingKind,
  type Decision,
} from "./consequences"

const who = "Max Muster"

const mapping = (over: Partial<DisciplineMapping> = {}): DisciplineMapping => ({
  targetId: "lg-10m",
  familyId: 1,
  officialScoring: null,
  plannedShots: null,
  confirmed: false,
  ...over,
})
const change = (
  before: Partial<DisciplineMapping>,
  after: Partial<DisciplineMapping>,
  cards = 12
) =>
  disciplineChange({
    name: "LG 40 alt",
    cards,
    before: mapping(before),
    after: mapping({ confirmed: true, ...after }),
    targetLabel: after.targetId === null ? null : "Luftgewehr 10 m",
    familyName: after.familyId === null ? null : "Luftgewehr",
    plannedShotsFromId: 40,
  })
const sportpassId = "12345678"

/** jeder Entscheid sagt, worum es geht, was passiert und wie es zurückgeht; kein Platzhalter bleibt stehen */
function wellFormed(decision: Decision) {
  expect(decision.title).not.toBe("")
  expect(decision.about).not.toBe("")
  expect(decision.happens.length).toBeGreaterThan(0)
  expect(decision.undo).not.toBe("")
  expect(JSON.stringify(decision)).not.toMatch(/[<>]|undefined|null/)
}

describe("Folgen der Sportpassnummern (Admin)", () => {
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
    // deaktiviert: kein „holt ab jetzt“ davor, das dem widerspräche
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

  it("getrennte Brücke entfernen: nicht mehr unter der Brücke, nichts gelöscht, nicht rückgängig", () => {
    const d = bridgeRemove({ device: "Mac (Kopie 9.10.)" })
    wellFormed(d)
    expect(d).toEqual({
      title: "Getrennte Brücke „Mac (Kopie 9.10.)“ entfernen?",
      about: "Das Gerät „Mac (Kopie 9.10.)“ ist getrennt und schickt nichts mehr.",
      // „Liste“ hieße auf dieser Seite auch die Listen aus Meyton
      happens: ["Es steht dann nicht mehr unter „Brücke im Schützenhaus“."],
      notHappening: [
        "Es wird keine Scheibe gelöscht.",
        "Was das Gerät geschickt hat, bleibt in Spiegel.",
      ],
      undo: "Nicht möglich. Das Gerät lässt sich mit einem neuen Code wieder verbinden.",
      confirmLabel: "Entfernen",
      destructive: true,
    })
  })

  it("Liste: Scheiben in Spiegel, die Art, nichts zur Wertung (sie hängt nicht an der Art), Schüsse nicht", () => {
    const d = rankingKind({ ranking: "RWK_LP", cards: 23, kind: "competition" })
    wellFormed(d)
    expect(d).toEqual({
      title: "„RWK_LP“ als Wettkampf zählen?",
      about: "In Spiegel gehören 23 Scheiben zur Liste „RWK_LP“.",
      happens: [
        "Diese 23 Scheiben und alle neuen dieser Liste zählen als Wettkampf, in den Scheiben und im Fortschritt.",
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
    expect(open.happens).toEqual([
      "Ihre Scheiben und alle neuen dieser Liste zählen dann so, wie Meyton sie vermerkt. Meist ist das Training.",
    ])
    expect(
      rankingKind({ ranking: "Training-LP", cards: 1, kind: "training" }).happens
    ).toHaveLength(1)
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
    // nur eine aktive hat schon Scheiben gebracht
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
    // ohne Nummer geht keine Zustimmung zurück, und es gibt nichts wieder zuzulassen
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

  it("löschen einer geteilten Scheibe: der Link geht nicht mehr, auch nicht nach dem Wiederherstellen", () => {
    const d = cardDelete({ evening, shared: true })
    wellFormed(d)
    expect(d.happens).toEqual([
      ...cardDelete({ evening }).happens,
      "Der geteilte Link geht nicht mehr. Auch nach dem Wiederherstellen bleibt er aus.",
    ])
    expect({ ...d, happens: [] }).toEqual({ ...cardDelete({ evening }), happens: [] })
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

describe("Teilen", () => {
  const evening = "Di 13.10.2026 · 19:12"

  it("teilen: wer den Link hat, sieht diese eine Scheibe ohne Anmeldung, ohne Namen, ohne etwas zu ändern", () => {
    const d = cardShare({ evening })
    wellFormed(d)
    expect(d).toEqual({
      title: "Scheibe teilen?",
      about: "Du teilst die Scheibe vom Di 13.10.2026 um 19:12.",
      check: "Den Link bekommt nur, wem du ihn schickst. Wer ihn hat, kann ihn weitergeben.",
      happens: [
        "Spiegel erstellt einen Link zu dieser einen Scheibe.",
        "Wer den Link öffnet, sieht die Scheibe mit allen Schüssen und Zahlen. Eine Anmeldung braucht es dafür nicht.",
      ],
      notHappening: [
        "Dein Name und deine Sportpassnummer stehen nicht dabei.",
        "Deine anderen Scheiben bleiben privat.",
        "Wer den Link öffnet, kann nichts ändern und nichts löschen.",
      ],
      undo: "Hier auf der Seite der Scheibe jederzeit „Teilen beenden“. Danach geht der Link nicht mehr.",
      confirmLabel: "Link erstellen",
      destructive: false,
    })
  })

  it("teilen beenden: der Link geht sofort nicht mehr, neu teilen gibt einen neuen", () => {
    const d = cardShareStop({ evening })
    wellFormed(d)
    expect(d).toEqual({
      title: "Teilen beenden?",
      about: "Die Scheibe vom Di 13.10.2026 um 19:12 ist geteilt.",
      happens: [
        "Der Link geht sofort nicht mehr. Wer ihn öffnet, sieht einen Hinweis statt der Scheibe.",
      ],
      notHappening: ["Die Scheibe bleibt in Spiegel, wie sie ist."],
      undo: "Neu teilen geht jederzeit. Das gibt einen neuen Link. Der alte bleibt aus.",
      confirmLabel: "Teilen beenden",
      destructive: true,
    })
  })
})

describe("Disziplin einer Scheibe", () => {
  const evening = "Di 13.10.2026 · 19:12"

  it("ändern in eine andere Familie: wo sie zählt, was bleibt, wie es zurückgeht", () => {
    const d = cardDiscipline({
      evening,
      from: "LP 40",
      to: "LP Auflage 30",
      stand: "LP 40",
      back: false,
      family: "Luftpistole Auflage",
      scoring: null,
    })
    wellFormed(d)
    expect(d).toEqual({
      title: "Disziplin ändern?",
      about:
        "Die Scheibe vom Di 13.10.2026 um 19:12 zählt als LP 40. Du stellst sie auf LP Auflage 30.",
      check: "Wähle die Disziplin, die du wirklich geschossen hast.",
      happens: [
        "Die Scheibe zählt dann bei Luftpistole Auflage. Das gilt in der Liste, im Fortschritt und bei den Rekorden.",
        "Spiegel prüft die Schusszahl mit LP Auflage 30.",
        "Kommt die Scheibe später noch einmal aus Meyton, bleibt es bei LP Auflage 30.",
      ],
      notHappening: [
        "Die Werte der Schüsse bleiben, wie Meyton sie gemessen hat.",
        "An der Meyton-Anlage ändert sich nichts.",
      ],
      undo: "Jederzeit hier wieder ändern, auch zurück auf LP 40 vom Stand.",
      confirmLabel: "Ändern",
      destructive: false,
    })
  })

  it("in derselben Familie: ohne den Satz zur Familie", () => {
    const d = cardDiscipline({
      evening,
      from: "LP 40",
      to: "LP 60",
      stand: "LP 40",
      back: false,
      family: null,
      scoring: null,
    })
    wellFormed(d)
    expect(d.happens).toEqual([
      "Spiegel prüft die Schusszahl mit LP 60.",
      "Kommt die Scheibe später noch einmal aus Meyton, bleibt es bei LP 60.",
    ])
  })

  it("ändert sich die Wertung mit der Disziplin, sagt es das", () => {
    const d = cardDiscipline({
      evening,
      from: "LP 40",
      to: "LP Auflage 30",
      stand: "LP 40",
      back: false,
      family: "Luftpistole Auflage",
      scoring: "decimal",
    })
    expect(d.happens).toContain("Die Wertung der Scheibe ist dann Zehntel.")
    const back = cardDiscipline({
      evening,
      from: "LP Auflage 30",
      to: "LP 40",
      stand: "LP 40",
      back: true,
      family: "Luftpistole",
      scoring: "rings",
    })
    expect(back.happens).toContain("Die Wertung der Scheibe ist dann ganze Ringe.")
  })

  it("zurück auf die Disziplin vom Stand", () => {
    const d = cardDiscipline({
      evening,
      from: "LP Auflage 30",
      to: "LP 40",
      stand: "LP 40",
      back: true,
      family: "Luftpistole",
      scoring: null,
    })
    wellFormed(d)
    expect(d).toEqual({
      title: "Disziplin vom Stand nehmen?",
      about:
        "Die Scheibe vom Di 13.10.2026 um 19:12 zählt als LP Auflage 30. Du stellst sie zurück auf LP 40, wie am Stand gewählt.",
      happens: [
        "Die Scheibe zählt dann bei Luftpistole. Das gilt in der Liste, im Fortschritt und bei den Rekorden.",
        "Spiegel prüft die Schusszahl mit LP 40.",
        "Kommt die Scheibe später noch einmal aus Meyton, gilt die Disziplin vom Stand.",
      ],
      notHappening: [
        "Die Werte der Schüsse bleiben, wie Meyton sie gemessen hat.",
        "An der Meyton-Anlage ändert sich nichts.",
      ],
      undo: "Jederzeit hier wieder ändern.",
      confirmLabel: "Zurückstellen",
      destructive: false,
    })
  })
})

/**
 * Schreibregeln als Leitplanke (Lektion [[spiegel-dialog-texts-not-understood]]): keine Semikolons und keines der
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

describe("Schreibregeln", () => {
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
    ["löschen, geteilt", cardDelete({ evening, shared: true })],
    ["endgültig löschen", cardPurgeNow({ evening })],
    ["teilen", cardShare({ evening })],
    ["teilen beenden", cardShareStop({ evening })],
    [
      "Disziplin der Scheibe",
      cardDiscipline({
        evening,
        from: "LP 40",
        to: "LP Auflage 30",
        stand: "LP 40",
        back: false,
        family: "Luftpistole Auflage",
        scoring: "decimal",
      }),
    ],
    [
      "Disziplin vom Stand",
      cardDiscipline({
        evening,
        from: "LP 60",
        to: "LP 40",
        stand: "LP 40",
        back: true,
        family: null,
        scoring: "rings",
      }),
    ],
    ["wieder zulassen", notMineLift({ who, sportpassId, cards: 2, consentActive: true })],
    [
      "wieder zulassen, Nummer nicht aktiv",
      notMineLift({ who, sportpassId, cards: 1, consentActive: false }),
    ],
    ["Disziplin einordnen", change({}, {})],
    [
      "Disziplin, alles anders",
      change({ targetId: null, familyId: null }, { officialScoring: "rings", plannedShots: 3 }),
    ],
    ["Disziplin verstecken", change({}, { targetId: null, familyId: null }, 0)],
    ["Disziplin ignorieren", disciplineIgnore({ name: "LG Schach 6x6", cards: 1 })],
    ["Disziplin zeigen", disciplineShow({ name: "LG Schach 6x6", cards: 3, visible: false })],
    ["Familie entfernen", familyRemove({ name: "Zimmerstutzen" })],
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

describe("Folgen beim Einordnen einer Disziplin", () => {
  it("nur einordnen: der Vorschlag, kein Nachrechnen", () => {
    const d = change({}, {})
    wellFormed(d)
    expect(d).toEqual({
      title: "„LG 40 alt“ so einordnen?",
      about: "In Spiegel gibt es 12 Scheiben dieser Disziplin.",
      happens: [
        "Spiegel übernimmt den Vorschlag. Die Disziplin steht danach nicht mehr unter „Neu“.",
        "Neue Scheiben dieser Disziplin kommen gleich so an.",
      ],
      notHappening: [
        "An den Schüssen und an den Werten aus Meyton ändert sich nichts.",
        "Hat ein Schütze eine Scheibe selbst auf Zehntel oder ganze Ringe gestellt, bleibt es dabei.",
        "Hat ein Schütze für eine Familie Zehntel oder ganze Ringe gewählt, bleibt es dabei.",
      ],
      undo: "Jederzeit hier wieder umstellen.",
      confirmLabel: "So einordnen",
      destructive: false,
    })
  })

  it("jede Änderung ein Satz, Nachrechnen nur bei Scheibe oder Schusszahl", () => {
    expect(change({ targetId: null }, {}).happens).toEqual([
      "Spiegel zeichnet die Scheiben als Luftgewehr 10 m und prüft den Wert jedes Schusses nach.",
      "Spiegel rechnet die vorhandenen Scheiben in den nächsten Minuten neu.",
      "Neue Scheiben dieser Disziplin kommen gleich so an.",
    ])
    expect(change({ familyId: 2 }, {}).happens).toEqual([
      "Die Scheiben stehen dann in der Familie „Luftgewehr“.",
      "Neue Scheiben dieser Disziplin kommen gleich so an.",
    ])
    expect(change({}, { officialScoring: "rings" }).happens[0]).toBe(
      "Die Scheiben dieser Disziplin zählen dann in ganzen Ringen."
    )
    expect(change({ officialScoring: "decimal" }, {}).happens[0]).toBe(
      "Die Scheiben dieser Disziplin zählen dann so, wie am Stand angezeigt."
    )
    expect(change({}, { plannedShots: 3 }).happens.slice(0, 2)).toEqual([
      "Eine Scheibe ist dann mit 3 Schüssen vollständig.",
      "Spiegel rechnet die vorhandenen Scheiben in den nächsten Minuten neu.",
    ])
    expect(change({}, { plannedShots: 0 }).happens[0]).toBe(
      "Eine Scheibe ist dann vollständig, sobald sie fertig ist."
    )
    expect(change({ plannedShots: 3 }, { plannedShots: null }).happens[0]).toBe(
      "Eine Scheibe ist dann mit 40 Schüssen vollständig."
    )
  })

  it("Scheibe und Familie weg: der Satz nur einmal; nie gezeigt: noch nicht", () => {
    const hidden = change({}, { targetId: null, familyId: null }, 1)
    expect(hidden.about).toBe("In Spiegel gibt es eine Scheibe dieser Disziplin.")
    expect(hidden.happens.slice(0, 2)).toEqual([
      "Spiegel zeigt die Scheiben dieser Disziplin nicht mehr in Start, Scheiben und Fortschritt.",
      "Spiegel rechnet die vorhandenen Scheiben in den nächsten Minuten neu.",
    ])
    const never = (after: Partial<DisciplineMapping>) =>
      change({ targetId: null, familyId: null }, after, 0).happens[0]
    expect(
      change({ targetId: "lg-10m", familyId: null }, { targetId: null, familyId: null }, 0)
        .happens[0]
    ).toBe(
      "Spiegel zeigt die Scheiben dieser Disziplin noch nicht in Start, Scheiben und Fortschritt. Dazu braucht sie eine Scheibe und eine Familie."
    )
    // die Familie gesetzt, die Scheibe eigene: nur nennen, was fehlt
    expect(never({ targetId: null, familyId: 4 })).toBe(
      "Spiegel zeigt die Scheiben dieser Disziplin noch nicht in Start, Scheiben und Fortschritt. Dazu braucht sie eine Scheibe."
    )
    expect(never({ targetId: "lg-10m", familyId: null })).toBe(
      "Spiegel zeigt die Scheiben dieser Disziplin noch nicht in Start, Scheiben und Fortschritt. Dazu braucht sie eine Familie."
    )
  })

  it("nachrechnen bei Scheibe oder Schusszahl, nicht bei Familie und Wertung", () => {
    expect(disciplineRecalculates(mapping(), mapping({ targetId: "lp-10m" }))).toBe(true)
    expect(disciplineRecalculates(mapping(), mapping({ plannedShots: 0 }))).toBe(true)
    expect(
      disciplineRecalculates(mapping(), mapping({ familyId: 9, officialScoring: "rings" }))
    ).toBe(false)
  })

  it("ignorieren, wieder zeigen, Familie entfernen", () => {
    expect(disciplineIgnore({ name: "LG Schach 6x6", cards: 0 })).toEqual({
      title: "„LG Schach 6x6“ ignorieren?",
      about: "In Spiegel gibt es noch keine Scheibe dieser Disziplin.",
      happens: [
        "Spiegel zeigt die Scheiben dieser Disziplin nirgends mehr. Auch die Schützen sehen sie nicht.",
        "Neue Scheiben dieser Disziplin kommen weiter an. Sie bleiben unsichtbar.",
        "Die Disziplin steht danach unter „Ignoriert“.",
      ],
      notHappening: ["Keine Scheibe wird gelöscht.", "An den Schüssen ändert sich nichts."],
      undo: "Unter „Ignoriert“ auf „Wieder zeigen“ tippen. Dann sind alle Scheiben wieder da.",
      confirmLabel: "Ignorieren",
      destructive: false,
    })
    expect(disciplineShow({ name: "X", cards: 2, visible: true }).happens).toEqual([
      "Spiegel zeigt die Scheiben dieser Disziplin wieder in Start, Scheiben und Fortschritt.",
    ])
    expect(disciplineShow({ name: "X", cards: 2, visible: false }).happens).toEqual([
      "Die Disziplin steht danach wieder unter „Neu“. Ihre Scheiben erscheinen, sobald Scheibe und Familie eingestellt sind.",
    ])
    const remove = familyRemove({ name: "Zimmerstutzen" })
    expect(remove.title).toBe("Familie „Zimmerstutzen“ entfernen?")
    expect(remove.destructive).toBe(true)
  })
})
