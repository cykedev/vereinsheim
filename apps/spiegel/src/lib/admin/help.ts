// Erklärungen im Admin hinter einem „?“ (P2c, D4): je Station der Übersicht und je Begriff zwei bis vier Sätze in
// Alltagsworten. Ohne „Neustart der Anlage“ (D0: das regelt Spiegel selbst). Reine Daten.

export const ADMIN_HELP = {
  site: {
    title: "Meyton-Anlage",
    text: "Die Schießanlage im Schützenhaus. Sie speichert jede Scheibe mit allen Schüssen in ihrer Ablage. Spiegel liest diese Ablage über die Brücke, ändert dort aber nie etwas.",
  },
  bridge: {
    title: "Brücke",
    text: "Ein kleines Gerät im Schützenhaus. Es liest die Ablage und schickt Spiegel nur die Scheiben von Schützen, die zugestimmt haben. Scheiben mit verdeckter Wertung schickt es nie. Nach dem Training ist es aus; das ist normal.",
  },
  pairingCode: {
    title: "Kopplungscode",
    text: "Verbindet eine Brücke einmalig mit Spiegel. Danach hat das Gerät einen eigenen Schlüssel; den Code braucht es nicht mehr.",
  },
  consent: {
    title: "Zustimmung",
    text: "Ein Schütze trägt im Profil seine SportpassID ein und stimmt zu, dass seine Scheiben automatisch kommen. Du bestätigst einmal, dass die Nummer zu ihm gehört. Seine erste Scheibe prüft er dann selbst.",
  },
  ranking: {
    title: "Rangliste",
    text: "Meyton ordnet jede Scheibe einer Rangliste des Vereins zu, etwa „Training-LP“ oder „RWK_…“. Hier legst du fest, welche als Wettkampf zählen.",
  },
  timeZone: {
    title: "Zeitzone der Anlage",
    text: "Meyton speichert Uhrzeiten ohne Zone. Spiegel braucht sie, um die Uhrzeit jeder Scheibe richtig zu zeigen; in Deutschland Europe/Berlin.",
  },
  role: {
    title: "Rolle",
    text: "Ein Schütze sieht seine Scheiben. Ein Admin dazu Konten, Zustimmungen und die Brücke, aber nie fremde Schüsse.",
  },
  deactivated: {
    title: "Deaktiviert",
    text: "Das Konto kann sich nicht anmelden, und die Brücke schickt nichts für es. Nichts wird gelöscht.",
  },
  accounts: {
    title: "Konten",
    text: "Wer Spiegel nutzt. Konten legt nur ein Admin an. Jeder sieht nur seine eigenen Scheiben, auch du.",
  },
} as const satisfies Record<string, { title: string; text: string }>

export type AdminHelpId = keyof typeof ADMIN_HELP
