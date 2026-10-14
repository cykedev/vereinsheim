// Folgen jeder Aktion in Alltagsworten (P2c, Plan `plans/2026-10-14-spiegel-admin-verstaendlich.md`, D1): „Kein Knopf
// ohne Folge“ (User, 14. Oktober 2026: „ich muss immer verstehen was ich bestätige, ablehne usw und was das für folgen
// hat“). Eine Quelle für Dialoge und Tests; die Komponenten erfinden keine Texte. Ohne Pronomen für Personen: Spiegel
// kennt Namen, kein Geschlecht. Reine Funktionen.

export interface Decision {
  title: string
  /** worum es geht: wer, welche Nummer, welches Gerät, wie viele Scheiben */
  about: string
  /** was vorher zu prüfen ist; fehlt, wenn es nichts zu prüfen gibt */
  check?: string
  /** was dann passiert */
  happens: string[]
  /** was ausdrücklich nicht passiert */
  notHappening: string[]
  /** wie es zurückgeht (oder dass es nicht geht) */
  undo: string
  confirmLabel: string
  destructive: boolean
}

const scheiben = (n: number) => (n === 1 ? "1 Scheibe" : `${n} Scheiben`)

export function consentConfirm({
  who,
  sportpassId,
  returned = false,
  accountActive = true,
}: {
  who: string
  sportpassId: string
  /** nach „Nicht meine“ bei der ersten Scheibe zurück beim Admin */
  returned?: boolean
  /** ein deaktiviertes Konto bekommt nichts, auch bestätigt */
  accountActive?: boolean
}): Decision {
  return {
    title: `Zustimmung von ${who} bestätigen?`,
    about: returned
      ? `${who} hat die erste Scheibe unter der SportpassID ${sportpassId} als „nicht meine“ gemeldet; diese Scheiben sind entfernt. Bestätigst du, gilt die Nummer wieder für ${who}.`
      : `${who} möchte, dass Scheiben mit der SportpassID ${sportpassId} automatisch in das eigene Konto kommen.`,
    check: returned
      ? `Gehört ${sportpassId} in der Meyton-Schützenverwaltung wirklich zu ${who}? Vielleicht wurde am Stand ein fremder Name gewählt. Wenn die Nummer nicht passt: ablehnen.`
      : `Gehört ${sportpassId} in der Meyton-Schützenverwaltung zu ${who}? Wenn nicht: ablehnen.`,
    happens: [
      "Läuft die Brücke gerade, kommen neue Scheiben mit dieser Nummer innerhalb weniger Minuten, sonst beim nächsten Training.",
      // das Nachladen (P2d); nach „nicht meine“ sind die älteren gesperrt, dort wäre der Satz falsch
      ...(returned
        ? []
        : [
            "Auch ältere Scheiben mit dieser Nummer holt die Brücke nach, soweit Meyton sie noch hat, aber nur, wenn gerade niemand schießt.",
          ]),
      `Spiegel zeigt ${who} die jüngste zur Kontrolle; erst danach erscheinen die Scheiben im Konto.`,
      ...(accountActive
        ? []
        : [`Solange das Konto von ${who} deaktiviert ist, schickt die Brücke nichts.`]),
    ],
    notHappening: [
      `Du siehst die Schüsse von ${who} nicht.`,
      "Scheiben mit verdeckter Wertung gehen nie hinaus.",
      `Was ${who} gelöscht oder als „nicht meine“ gemeldet hat, kommt nicht wieder.`,
    ],
    undo: `Jederzeit über „Entfernen“. Schon geschickte Scheiben bleiben bei ${who}.`,
    confirmLabel: "Bestätigen",
    destructive: false,
  }
}

/** ablehnen gibt es nur für offene Zustimmungen: Es wurde noch nichts geschickt */
export function consentReject({
  who,
  sportpassId,
}: {
  who: string
  sportpassId: string
}): Decision {
  return {
    title: `Zustimmung von ${who} ablehnen?`,
    about: `${who} hat für die SportpassID ${sportpassId} zugestimmt.`,
    happens: [
      "Spiegel nimmt unter dieser Nummer nichts an.",
      `${who} sieht im Profil „abgelehnt“ und kann die Ablehnung entfernen und neu zustimmen.`,
    ],
    notHappening: ["Gelöscht wird nichts."],
    undo: `Stimmt ${who} neu zu, kannst du bestätigen.`,
    confirmLabel: "Ablehnen",
    destructive: true,
  }
}

export function consentRemove({
  who,
  sportpassId,
}: {
  who: string
  sportpassId: string
}): Decision {
  return {
    title: `Zustimmung von ${who} entfernen?`,
    about: `Die SportpassID ${sportpassId} wird vom Konto von ${who} gelöst.`,
    happens: [
      "Ab sofort nimmt Spiegel unter dieser Nummer nichts mehr an.",
      "Die Nummer ist wieder frei; jedes Konto kann für sie zustimmen.",
    ],
    notHappening: [
      `Schon geschickte Scheiben bleiben bei ${who}; löschen kann sie nur ${who} selbst.`,
    ],
    undo: `${who} stimmt im Profil neu zu, du bestätigst.`,
    confirmLabel: "Entfernen",
    destructive: true,
  }
}

export function bridgeRevoke({ device }: { device: string }): Decision {
  return {
    title: `Brücke „${device}“ widerrufen?`,
    about: `Das Gerät „${device}“ darf Scheiben an Spiegel schicken.`,
    happens: ["Ab sofort nimmt Spiegel von diesem Gerät nichts mehr an; es meldet sich ab."],
    notHappening: ["Keine Scheibe wird gelöscht.", "Andere Brücken laufen weiter."],
    undo: "Nicht möglich. Um das Gerät wieder zu nutzen, es mit einem neuen Code koppeln.",
    confirmLabel: "Widerrufen",
    destructive: true,
  }
}

export type RankingChoice = "training" | "competition" | "open"

const RANKING_WORDS: Record<RankingChoice, { title: string; label: string }> = {
  competition: { title: "als Wettkampf zählen", label: "Als Wettkampf zählen" },
  training: { title: "als Training zählen", label: "Als Training zählen" },
  open: { title: "nicht zuordnen", label: "Nicht zuordnen" },
}

const RANKING_HAPPENS: Record<RankingChoice, [string, string]> = {
  competition: [
    "zählen als Wettkampf, in Liste und Fortschritt.",
    "Vorgeschlagen wird dann die amtliche Wertung der Disziplin; das angezeigte Ergebnis kann wechseln, etwa ganze Ringe statt Zehntel.",
  ],
  training: [
    "zählen als Training, in Liste und Fortschritt.",
    "Vorgeschlagen wird dann die Wertung wie am Stand; das angezeigte Ergebnis kann wechseln, etwa Zehntel statt ganzer Ringe.",
  ],
  open: [
    "zählen so, wie Meyton es an der Scheibe vermerkt; meist ist das Training.",
    "Das angezeigte Ergebnis kann wechseln, wenn sich dadurch die Art ändert.",
  ],
}

export function rankingKind({
  ranking,
  cards,
  kind,
}: {
  ranking: string
  /** Scheiben in Spiegel mit dieser Rangliste (nicht gelöscht) */
  cards: number
  kind: RankingChoice
}): Decision {
  const [counts, scoring] = RANKING_HAPPENS[kind]
  return {
    title: `„${ranking}“ ${RANKING_WORDS[kind].title}?`,
    about: cards
      ? `In Spiegel ${cards === 1 ? "trägt" : "tragen"} ${scheiben(cards)} die Rangliste „${ranking}“.`
      : `Noch keine Scheibe in Spiegel trägt die Rangliste „${ranking}“.`,
    happens: [
      `${cards ? "Diese Scheiben" : "Ihre Scheiben"} und neue dieser Rangliste ${counts}`,
      scoring,
    ],
    notHappening: [
      "Hat ein Schütze eine Scheibe selbst umgestellt, bleibt seine Wahl.",
      "Eine Scheibe nur aus Probe bleibt Training.",
      "Schüsse ändern sich nicht.",
    ],
    undo: "Jederzeit hier umstellen.",
    confirmLabel: RANKING_WORDS[kind].label,
    destructive: false,
  }
}

/** was am Konto geändert wird; nur diese Felder haben Folgen, Name und E-Mail nicht */
export interface AccountChanges {
  role?: "ADMIN" | "USER"
  active?: boolean
  password?: boolean
}

/** was ein Formular gegenüber dem gespeicherten Konto ändert; nur Rolle, Status und Passwort zählen */
export function accountChangesOf(
  saved: { role: "ADMIN" | "USER"; isActive: boolean },
  form: { role: "ADMIN" | "USER"; active: boolean; password: string }
): AccountChanges {
  return {
    ...(form.role !== saved.role ? { role: form.role } : {}),
    ...(form.active !== saved.isActive ? { active: form.active } : {}),
    ...(form.password !== "" ? { password: true } : {}),
  }
}

/** Konto ändern: nur bei Rolle, Status oder Passwort ein Entscheid, sonst null */
export function accountChange({
  who,
  changes,
}: {
  who: string
  changes: AccountChanges
}): Decision | null {
  const { role, active, password } = changes
  if (role === undefined && active === undefined && !password) return null
  const happens: string[] = []
  const notHappening: string[] = []
  if (role === "ADMIN")
    happens.push(
      `${who} verwaltet Konten, Zustimmungen und die Brücke. Die eigenen Scheiben bleiben sichtbar, fremde Schüsse nie.`
    )
  if (role === "USER") happens.push(`${who} verliert den Zugang zum Admin.`)
  if (active === false) {
    happens.push(
      `${who} kann sich nicht mehr anmelden.`,
      `Die Brücke schickt nichts mehr unter den SportpassIDs von ${who}.`
    )
    notHappening.push("Scheiben und Zustimmungen bleiben, gelöscht wird nichts.")
  }
  if (active === true)
    happens.push(`${who} kann sich wieder anmelden; aktive Zustimmungen gelten wieder.`)
  if (password)
    happens.push(
      `${who} wird abgemeldet und muss das neue Passwort bei der nächsten Anmeldung ersetzen. Bis dahin sind keine Daten zu sehen.`
    )
  // Rolle und Deaktivieren beenden die Sitzungen (ein deaktiviertes Konto hat keine); das neue Passwort sagt es selbst
  else if (role !== undefined || active === false) happens.push(`${who} wird abgemeldet.`)
  return {
    title: `Konto von ${who} ändern?`,
    about: `Du änderst ${[
      role !== undefined ? "die Rolle" : null,
      active !== undefined ? "den Status" : null,
      password ? "das Passwort" : null,
    ]
      .filter(Boolean)
      .join(", ")} von ${who}.`,
    ...(password ? { check: "Gib das Passwort persönlich weiter, nicht per Mail." } : {}),
    happens,
    notHappening,
    undo: [
      active === false ? "Das Konto wieder aktivieren." : null,
      active === true ? "Das Konto wieder deaktivieren." : null,
      role !== undefined ? "Die Rolle hier zurückstellen." : null,
      password
        ? "Das alte Passwort lässt sich nicht zurückholen; bei Bedarf ein weiteres neues setzen."
        : null,
    ]
      .filter(Boolean)
      .join(" "),
    confirmLabel: "Ändern",
    destructive: active === false,
  }
}

export function ownConsentRevoke({ sportpassId }: { sportpassId: string }): Decision {
  return {
    title: `Zustimmung für ${sportpassId} widerrufen?`,
    about: `Scheiben mit der SportpassID ${sportpassId} kommen bisher automatisch in dein Konto.`,
    happens: ["Ab sofort kommen keine neuen Scheiben mehr unter dieser Nummer."],
    notHappening: ["Was schon da ist, bleibt, bis du es löschst."],
    undo: "Neu zustimmen; ein Admin bestätigt dann wieder.",
    confirmLabel: "Widerrufen",
    destructive: true,
  }
}

export function ownRejectionRemove(): Decision {
  return {
    title: "Ablehnung entfernen?",
    about: "Ein Admin hat diese SportpassID abgelehnt.",
    happens: ["Die Zeile verschwindet, du kannst die Nummer neu eintragen."],
    notHappening: ["Es kommen keine Scheiben, bis ein Admin eine neue Zustimmung bestätigt."],
    undo: "Nicht nötig; die Ablehnung kehrt nicht zurück.",
    confirmLabel: "Entfernen",
    destructive: false,
  }
}

export function notMine({
  evening,
  more,
  sportpassId,
}: {
  evening: string
  more: number
  /** null: die Scheibe trug keine SportpassID; dann geht keine Zustimmung zurück */
  sportpassId: string | null
}): Decision {
  const several = more > 0
  const under = sportpassId ? `unter deiner SportpassID ${sportpassId}` : "ohne SportpassID"
  return {
    title: "Nicht deine Scheibe?",
    about: several
      ? `Die Scheibe vom ${evening} und ${more} weitere kamen ${under}.`
      : `Die Scheibe vom ${evening} kam ${under}.`,
    happens: [
      several
        ? "Diese Scheiben werden entfernt, mit ihren Rohdaten, und kommen nicht wieder."
        : "Die Scheibe wird entfernt, mit ihren Rohdaten, und kommt nicht wieder.",
      ...(sportpassId
        ? [
            "Deine Zustimmung geht zur Prüfung zurück an einen Admin; bis dahin kommen keine Scheiben unter dieser Nummer.",
          ]
        : []),
    ],
    notHappening: ["Deine anderen Scheiben bleiben."],
    undo: "Nicht möglich.",
    confirmLabel: "Nicht meine",
    destructive: true,
  }
}

/** eine eigene Scheibe in den Papierkorb (P2b, Plan `plans/2026-10-14-spiegel-papierkorb.md`, D7) */
export function cardDelete({ evening }: { evening: string }): Decision {
  return {
    title: "Scheibe löschen?",
    about: `Die Scheibe vom ${evening}.`,
    happens: [
      "Sie liegt 30 Tage im Papierkorb (Profil) und zählt so lange nirgends mit, auch nicht in Rekorden und Verläufen.",
      "Danach wird sie endgültig gelöscht, mit allen Schüssen. Die Brücke bringt sie nicht von selbst zurück.",
    ],
    notHappening: ["Deine anderen Scheiben bleiben.", "An der Meyton-Anlage ändert sich nichts."],
    undo: "30 Tage lang im Papierkorb wiederherstellen.",
    confirmLabel: "Löschen",
    destructive: true,
  }
}

/** eine Scheibe im Papierkorb sofort endgültig löschen; es bleibt die weiche Sperre */
export function cardPurgeNow({ evening }: { evening: string }): Decision {
  return {
    title: "Endgültig löschen?",
    about: `Die Scheibe vom ${evening} liegt im Papierkorb.`,
    happens: [
      "Sie wird sofort gelöscht, mit allen Schüssen.",
      "Spiegel merkt sich nur, dass es sie gab, damit die Brücke sie nicht von selbst zurückbringt.",
    ],
    notHappening: ["An der Meyton-Anlage ändert sich nichts."],
    undo: "Nicht möglich.",
    confirmLabel: "Endgültig löschen",
    destructive: true,
  }
}

/**
 * Meldungen „nicht meine“ einer Zustimmung aufheben (P2d, D8): Die Scheiben dürfen wiederkommen und warten in „Offen“.
 * `consentActive`: Die Zustimmung ist bestätigt; sonst kommen sie erst, wenn sie es wieder ist.
 */
export function notMineLift({
  who,
  sportpassId,
  cards,
  consentActive,
}: {
  who: string
  sportpassId: string
  cards: number
  consentActive: boolean
}): Decision {
  return {
    title: `Meldungen „nicht meine“ von ${who} aufheben?`,
    about: `${who} hat ${scheiben(cards)} unter der SportpassID ${sportpassId} als „nicht meine“ gemeldet.`,
    check: `Hat ${who} gesagt, dass es doch die eigenen waren? Sonst nicht aufheben.`,
    happens: [
      consentActive
        ? "Die Brücke darf diese Scheiben wieder schicken und holt sie nach, soweit Meyton sie noch hat, wenn gerade niemand schießt."
        : "Sie kommen erst, wenn die Zustimmung wieder bestätigt ist.",
      `${who} sieht sie zuerst in „Offen“ und bestätigt sie dort; bis dahin wartet auch jede neue Scheibe dieser Nummer.`,
    ],
    notHappening: [`Du siehst die Schüsse von ${who} nicht.`],
    undo: `${who} meldet sie in „Offen“ wieder als „nicht meine“.`,
    confirmLabel: "Meldungen aufheben",
    destructive: false,
  }
}
