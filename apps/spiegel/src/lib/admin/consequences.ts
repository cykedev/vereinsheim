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
}: {
  who: string
  sportpassId: string
}): Decision {
  return {
    title: `Zustimmung von ${who} bestätigen?`,
    about: `${who} möchte, dass Scheiben mit der SportpassID ${sportpassId} automatisch in das eigene Konto kommen.`,
    check: `Gehört ${sportpassId} in der Meyton-Schützenverwaltung zu ${who}? Wenn nicht: ablehnen.`,
    happens: [
      "Ab dem nächsten Trainingsabend schickt die Brücke jede Scheibe mit dieser Nummer.",
      `Die erste zeigt Spiegel ${who} zur Kontrolle; erst danach erscheinen die Scheiben im Konto.`,
    ],
    notHappening: [
      `Du siehst die Schüsse von ${who} nicht.`,
      // bis zum Nachladen der Historie (P2d)
      "Scheiben von früheren Abenden kommen nicht von selbst; höchstens die des letzten Abends, wenn die Brücke beim nächsten Start nachholt.",
    ],
    undo: `Jederzeit über „Entfernen“. Schon geschickte Scheiben bleiben bei ${who}.`,
    confirmLabel: "Bestätigen",
    destructive: false,
  }
}

export function consentReject({
  who,
  sportpassId,
  active,
}: {
  who: string
  sportpassId: string
  /** schon bestätigt: dann gibt es geschickte Scheiben */
  active: boolean
}): Decision {
  return {
    title: `Zustimmung von ${who} ablehnen?`,
    about: `${who} hat für die SportpassID ${sportpassId} zugestimmt.`,
    happens: [
      "Die Brücke schickt nichts unter dieser Nummer.",
      `${who} sieht im Profil „abgelehnt“ und kann die Ablehnung entfernen und neu zustimmen.`,
    ],
    notHappening: [
      "Gelöscht wird nichts.",
      ...(active ? [`Schon geschickte Scheiben bleiben bei ${who}.`] : []),
    ],
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
      "Ab dem nächsten Trainingsabend schickt die Brücke nichts mehr unter dieser Nummer.",
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

const RANKING_WORDS: Record<RankingChoice, { title: string; label: string; counts: string }> = {
  competition: {
    title: "als Wettkampf zählen",
    label: "Als Wettkampf zählen",
    counts: "Wettkampf",
  },
  training: { title: "als Training zählen", label: "Als Training zählen", counts: "Training" },
  open: { title: "nicht zuordnen", label: "Nicht zuordnen", counts: "Training" },
}

export function rankingKind({
  ranking,
  cards,
  kind,
}: {
  ranking: string
  cards: number
  kind: RankingChoice
}): Decision {
  const words = RANKING_WORDS[kind]
  return {
    title: `„${ranking}“ ${words.title}?`,
    about: `Meyton nennt ${scheiben(cards)} mit der Rangliste „${ranking}“.`,
    happens: [
      kind === "competition"
        ? "Diese Scheiben zählen als Wettkampf: in Liste, Fortschritt und bei der Wertung, die Spiegel vorschlägt (Wettkampf in der amtlichen)."
        : `Diese Scheiben zählen als ${words.counts}: in Liste, Fortschritt und bei der Wertung, die Spiegel vorschlägt.`,
      "Neue Scheiben dieser Rangliste ebenso.",
    ],
    notHappening: [
      "Hat ein Schütze eine Scheibe selbst umgestellt, bleibt seine Wahl.",
      "Eine Scheibe nur aus Probe bleibt Training.",
      "Schüsse und Ergebnisse ändern sich nicht.",
    ],
    undo: "Jederzeit hier umstellen.",
    confirmLabel: words.label,
    destructive: false,
  }
}

export function siteTimeZone({ zone }: { zone: string }): Decision {
  return {
    title: `Zeitzone auf ${zone} ändern?`,
    about: "Meyton speichert Uhrzeiten ohne Zeitzone. Spiegel rechnet sie mit dieser Zone um.",
    happens: [`Neu eingelesene Scheiben bekommen ihre Uhrzeit in ${zone}.`],
    notHappening: ["Schon eingelesene Scheiben behalten ihre Uhrzeit."],
    undo: `Zurückstellen; Scheiben, die dazwischen kamen, behalten die Uhrzeit aus ${zone}.`,
    confirmLabel: "Ändern",
    destructive: false,
  }
}

/** was am Konto geändert wird; nur diese Felder haben Folgen, Name und E-Mail nicht */
export interface AccountChanges {
  role?: "ADMIN" | "USER"
  active?: boolean
  password?: boolean
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
  // Rolle und Status beenden die Sitzungen; das neue Passwort sagt es schon selbst
  else if (role !== undefined || active !== undefined) happens.push(`${who} wird abgemeldet.`)
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
    undo:
      active === false
        ? "Das Konto wieder aktivieren."
        : "Hier wieder zurückstellen; abgemeldet bleibt abgemeldet.",
    confirmLabel: "Ändern",
    destructive: active === false,
  }
}

export function ownConsentRevoke({ sportpassId }: { sportpassId: string }): Decision {
  return {
    title: `Zustimmung für ${sportpassId} widerrufen?`,
    about: `Scheiben mit der SportpassID ${sportpassId} kommen bisher automatisch in dein Konto.`,
    happens: ["Ab dem nächsten Trainingsabend kommen keine neuen Scheiben mehr."],
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
  sportpassId: string
}): Decision {
  const several = more > 0
  return {
    title: "Nicht deine Scheibe?",
    about: several
      ? `Die Scheibe vom ${evening} und ${more} weitere kamen unter deiner SportpassID ${sportpassId}.`
      : `Die Scheibe vom ${evening} kam unter deiner SportpassID ${sportpassId}.`,
    happens: [
      several
        ? "Diese Scheiben werden entfernt, mit ihren Rohdaten, und kommen nicht wieder."
        : "Die Scheibe wird entfernt, mit ihren Rohdaten, und kommt nicht wieder.",
      "Deine Zustimmung geht zur Prüfung zurück an einen Admin; bis dahin kommen keine Scheiben unter dieser Nummer.",
    ],
    notHappening: ["Deine anderen Scheiben bleiben."],
    undo: "Nicht möglich.",
    confirmLabel: "Nicht meine",
    destructive: true,
  }
}
