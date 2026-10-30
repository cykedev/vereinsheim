// Ausgabe und Bericht der Übernahme: die Ausgabe nur mit Zahlen, Gründen und Namen von Disziplinen; der Bericht unter
// `reports/` (gitignored) dazu mit Tagen und den Texten der Stichprobe, nie mit E-Mail oder Passwort.

import type { TransferAbort, TransferReport } from "../../src/parts/transfer/run"

/** löscht die Zeilen der Vorschau (nur Dev-Datenbank); die Verknüpfungen zuerst, sie hängen an keiner Scheibe */
const PREVIEW_DELETE = [
  `DELETE FROM "DiaryEntryCard" WHERE "cardId" IN (SELECT id FROM "Card" WHERE "importKey" LIKE 'treffsicher:preview-%');`,
  `DELETE FROM "DiaryEntry" WHERE "importKey" LIKE 'preview:%';`,
  `DELETE FROM "DiaryGoal" WHERE "importKey" LIKE 'preview:%';`,
  `DELETE FROM "DiaryRoutine" WHERE "importKey" LIKE 'preview:%';`,
  `DELETE FROM "Card" WHERE "importKey" LIKE 'treffsicher:preview-%';`,
]

const tally = (record: Partial<Record<string, number>>) =>
  Object.entries(record)
    .filter(([, n]) => n)
    .map(([key, n]) => `${key} ${n}`)
    .join(", ") || "–"

/** der Grund eines Abbruchs als Text für die Ausgabe */
export function abortText(abort: TransferAbort): string {
  switch (abort.kind) {
    case "noSource":
      return "Kein Konto in Treffsicher mit dieser E-Mail."
    case "preview":
      return [
        `Das Konto in Spiegel hat noch ${abort.rows} Zeilen der Vorschau.`,
        "Erst die Vorschau löschen, in der Datenbank von Spiegel:",
        ...PREVIEW_DELETE.map((sql) => `  ${sql}`),
      ].join("\n")
    case "foreignInTarget":
      return `Das Konto in Spiegel trägt schon Übernommenes aus einem anderen Konto in Treffsicher (${abort.rows} Kennungen). Nichts wird zusammengeführt.`
    case "sourceElsewhere":
      return `Übernommenes dieses Kontos steht schon an einem anderen Konto in Spiegel (${abort.rows} Zeilen). Nichts wird zusammengeführt.`
    case "badFamilyOption":
      return [
        "--family stimmt nicht:",
        ...abort.unknownSlugs.map((slug) => `  keine Familie mit der Kennung ${slug}`),
        ...abort.duplicateNames.map((name) => `  der Name ${name} steht zweimal da`),
      ].join("\n")
    case "unknownFamily":
      return [
        "Diese Disziplinen aus Treffsicher passen zu keiner Familie (Einheiten oder Abläufe):",
        ...Object.entries(abort.names).map(([name, n]) => `  ${name}: ${n}`),
        'Zuordnung angeben: --family "<Name>=<Kennung der Familie>"',
      ].join("\n")
    case "markedNotSaved":
      return [
        "Merkmal in Treffsicher gesetzt, Übernahme in Spiegel nicht gespeichert.",
        "Lauf wiederholen oder: pnpm --filter treffsicher moved --clear <E-Mail in Treffsicher>",
      ].join("\n")
    case "noDiscipline":
      return [
        "Keine Disziplin der ersten Anlage passt zur Schusszahl (unter Admin → Disziplinen anlegen oder eine meistgenutzte schaffen):",
        ...abort.cases.map((c) =>
          c.reason === "tie"
            ? `  ${c.family}, ${c.shots} Schuss: ${c.sessions} Einheiten (mehrere Disziplinen mit ${c.plannedShots} Schuss, keine meistgenutzt)`
            : `  ${c.family}, ${c.shots} Schuss: ${c.sessions} Einheiten (keine Disziplin mit so vielen Schüssen oder mehr)`
        ),
      ].join("\n")
  }
}

/** die Ausgabe eines Laufs, nur Zahlen */
export function summaryLines(report: TransferReport): string[] {
  const a = report.attachments
  return [
    `# Übernahme aus Treffsicher (${report.dryRun ? "Probelauf, nichts geschrieben" : "geschrieben"})`,
    "",
    `Konto ${report.accountCreated ? "angelegt" : "vorhanden"}, Tagebuch ${report.diaryEnabled ? "an" : "aus"}`,
    `Einheiten: ${report.sessions}, davon ${report.largerDiscipline} auf einer Disziplin mit mehr Schüssen (unvollständig)`,
    `Je Einheit: ${tally(report.decisions)}`,
    `Scheiben: angelegt ${report.cards.created}, ersetzt ${report.cards.revised}, unverändert ${report.cards.unchanged}, entfernt ${report.cards.removed}, geändert und bleibt ${report.cards.kept}`,
    `Scheiben mit ungültigen Angaben: ${tally(report.cards.invalid)}`,
    `Einträge: ${tally(report.entries)}`,
    `Scheiben, die schon ein anderer Eintrag hält: ${report.links.linkedElsewhere}`,
    `Ausführung: ${report.executions.placed} Einträge, ${report.executions.series} Serien; ausgelassen ${tally(report.executions.skipped)}; Probeserien ${report.executions.practiceSkipped}`,
    `Ziele: ${tally(report.goals)}`,
    `Abläufe: ${tally(report.routines)}`,
    `Anhänge: ${a.total}; Datei fehlt ${a.fileMissing}, unlesbar ${a.unreadable}, zu groß ${a.tooLarge}`,
    `  Ausdrucke: ${tally(a.printouts)}; nicht angehängt: ${tally(report.printoutsNotPlaced)}`,
    `  PDF ohne lesbaren Ausdruck: ${tally(a.printoutRejected)}`,
    `  Belege: ${tally(a.evidence)}`,
    `Unsicher (beide behalten): ${report.uncertain.length}`,
    `Geändert, bleibt: ${report.kept.length}`,
    `Treffsicher: ${report.marked === "set" ? "Konto als umgezogen markiert" : "nicht markiert (Probelauf)"}`,
    `Prüfbestand: ${report.check.findings === 0 ? "ohne Befund" : `${report.check.findings} Befunde`}`,
  ]
}

const cell = (text: string | null) =>
  text === null ? "–" : text.replace(/\|/g, "\\|").replace(/\n/g, "<br>")

/** der Bericht für `reports/`, mit Tagen und Texten der Stichprobe */
export function reportMarkdown(report: TransferReport, startedAt: Date): string {
  const check = report.check
  const units = check.units.filter((u) => u.status.kind !== "same" && u.status.kind !== "noResult")
  const counts = check.units.reduce<Record<string, number>>((all, u) => {
    const key =
      u.status.kind === "explained" || u.status.kind === "finding"
        ? `${u.status.kind}: ${u.status.reason}`
        : u.status.kind
    all[key] = (all[key] ?? 0) + 1
    return all
  }, {})
  return [
    ...summaryLines(report),
    "",
    `Lauf: ${startedAt.toISOString()}`,
    "",
    "## Unsichere Fälle",
    "",
    ...(report.uncertain.length
      ? [
          "| Abend | Disziplin | Treffsicher | vorhandene Scheiben |",
          "| --- | --- | --: | --- |",
          ...report.uncertain.map(
            (u) =>
              `| ${u.day} | ${cell(u.family)} | ${u.total ?? "–"}/${u.shots} | ${u.others.map((o) => `${o.total ?? "–"}/${o.shots}`).join(", ")} |`
          ),
        ]
      : ["keine"]),
    "",
    "## Geändert, bleibt",
    "",
    ...(report.kept.length
      ? report.kept.map((k) => `- ${k.what} ${k.day ?? ""} ${k.reason}`.replace(/\s+/g, " "))
      : ["nichts"]),
    "",
    "## Prüfbestand je Einheit",
    "",
    `Zustände: ${tally(counts)}`,
    "",
    ...(units.length
      ? [
          "| Abend | Entscheidung | Zustand | vorher | nachher | Ø vorher | Ø nachher |",
          "| --- | --- | --- | --: | --: | --: | --: |",
          ...units.map(
            (u) =>
              `| ${u.day} | ${u.decision} | ${u.status.kind}${"reason" in u.status ? `: ${u.status.reason}` : ""} | ${u.before ? `${u.before.total ?? "–"}/${u.before.shots}` : "–"} | ${u.after ? `${u.after.total ?? "–"}/${u.after.shots}` : "–"} | ${u.mean.before?.toFixed(3) ?? "–"} | ${u.mean.after?.toFixed(3) ?? "–"} |`
          ),
        ]
      : ["alle Einheiten mit Ergebnis gleich"]),
    "",
    "## Vollständigkeit",
    "",
    "| Tabelle | vorher | nachher | Erklärung | Befund |",
    "| --- | --: | --: | --- | --- |",
    ...check.tables.map(
      (t) =>
        `| ${t.name} | ${t.before} | ${t.after} | ${cell(tally(t.explained))}${t.note ? `; ${cell(t.note)}` : ""} | ${t.finding ? "ja" : "–"} |`
    ),
    "",
    "## Stichprobe Feld für Feld",
    "",
    ...check.sample.flatMap((s) => [
      `### ${s.date.slice(0, 10)}${s.kept ? " (geändert, bleibt)" : ""}`,
      "",
      "| Feld | Treffsicher | Spiegel |",
      "| --- | --- | --- |",
      ...s.fields.map((f) => `| ${f.field} | ${cell(f.before)} | ${cell(f.after)} |`),
      "",
    ]),
  ].join("\n")
}
