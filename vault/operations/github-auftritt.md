---
id: github-auftritt
type: operation
title: "GitHub-Auftritt: README-Bilder, Topics, Social Preview, Release"
aliases: [readme-bilder, github-seite, social-preview, repo-topics]
keywords: [github, readme, readme.de, zweisprachig, sprache, screenshots, bilder, webp, social preview, topics, beschreibung, release, tag, issue-vorlagen, contributing, security, hero, aufmerksamkeit, open source, demo-konto, prüfbestand, calver]
part_of: ["[[operations]]"]
relates_to: ["[[adr-029]]", "[[conventions]]", "[[vps-resource-sizing]]"]
---

**TL;DR** Die Bilder der README entstehen mit je einem Werkzeug je App (`readme-bilder`) aus Daten ohne fremde Personen und liegen unter `docs/screenshots/`; Beschreibung, Topics, Social Preview und Releases pflegt der User mit `gh` und in den Einstellungen des Repositories.

# GitHub-Auftritt

Die Seite [github.com/cykedev/vereinsheim](https://github.com/cykedev/vereinsheim) führt mit Spiegel: ein Verbundbild
(Desktop hell neben Telefon dunkel), die Seiten von Spiegel, dann Ringwerk, ein Mermaid-Diagramm des Datenflusses,
Ausprobieren, Betreiben, Technik, der Agent-Harness. Treffsicher steht nur noch unter „History“.

## Zwei Sprachen, zwei vollständige Fassungen

`README.md` ist englisch (das Publikum auf GitHub), `README.de.md` die vollständige deutsche Fassung (die Vereine, die
Spiegel einsetzen; Meyton-Anlagen stehen fast nur im deutschsprachigen Raum). Beide beginnen mit der Zeile „Deutsch ·
English“ als Sprachwechsel, haben dieselbe Gliederung, dieselben Bilder und denselben Mermaid-Block. Keine gemischte
Fassung: Ein deutsches Zitat in der englischen README bediente keine der beiden Gruppen. Wer eine ändert, ändert die
andere mit; das Release-Gate (`scripts/consistency-check.sh`, Abschnitt „README in beiden Sprachen“) prüft, dass beide
dieselben Bilder aus `docs/` einbinden und jedes Bild da ist. Text-Drift sieht nur ein Mensch.

Die Issue-Vorlagen (`.github/ISSUE_TEMPLATE/`), die PR-Vorlage und `CONTRIBUTING.md` sind deutsch (die Kurzfassung auf
Englisch steht im Abschnitt „Contributing“ der `README.md`); `SECURITY.md` bleibt zweisprachig, weil eine Meldung von
außen kommen kann. Release-Notes sind zweisprachig, Deutsch zuerst.

## Bilder nachziehen

Nach einem Umbau von Design 2 oder einer Seite, die in der README steht:

```bash
pnpm --filter spiegel build && pnpm --filter spiegel seed:own --demo --erfunden && pnpm --filter spiegel readme-bilder && pnpm --filter spiegel seed:own --email <eigene Adresse>
pnpm --filter ringwerk build && pnpm --filter ringwerk pruefdaten && pnpm --filter ringwerk readme-bilder
```

Spiegel schreibt `docs/screenshots/spiegel-*.webp`, `hero.webp` und `docs/social-preview.png` (Vorlagen in
`apps/spiegel/tools/readme-bilder/`, `--nur <wort>` für einzelne Bilder), Ringwerk `docs/screenshots/ringwerk-*.webp`
(kein Bild des öffentlichen PDFs: Es trägt den Namen des Testfalls im Kopf). Beide Werkzeuge starten den gebauten Stand
selbst (:3012, :3013); ein Dev-Server im Bild
zeigte das Dev-Badge von Next. Die Daten ([[adr-029]], Nachtrag: auch die eigenen Daten des Users liegen nicht im
Repo, also auch nicht als Bild): `seed:own --demo --erfunden` gibt dem Demo-Konto erfundene Scheiben, auch wenn
`tools/private/own-cards.json` da ist; der Prüfbestand von Ringwerk hat erfundene Namen, das Werkzeug meldet sich als
Mitglied an und setzt die Überschrift des Wettbewerbs im DOM auf einen Vereinsnamen. Ohne `--erfunden` hängt
`seed:own --demo` die eigenen Scheiben an das Demo-Konto; danach `seed:own --email` für das eigene Konto.
Jedes Bild vor dem Commit ansehen: Theme, kein Ladezustand, keine Namen.

## Beschreibung und Topics

```bash
gh repo edit cykedev/vereinsheim --description "…" --add-topic meyton --remove-topic training-log
```

Höchstens 20 Topics; Stand mit `gh repo view cykedev/vereinsheim --json description,repositoryTopics`. Wiki ist aus
(die Doku liegt im Vault), Discussions sind an (Fragen von Vereinen, verlinkt aus `config.yml` der Issue-Vorlagen).

## Social Preview

`docs/social-preview.png` (1280×640) in den Einstellungen des Repositories unter „Social preview“ hochladen; `gh` kann
das nicht. Nach neuen Bildern von Spiegel neu hochladen.

## Release

CalVer `vYYYY.MM`; die Notes beschreiben, was Vereine merken, nicht Commits:

```bash
gh release create v2026.11 --title "v2026.11" --notes-file <datei> --target main
```

Das Release zeigt auf `main`; die Images baut weiter `vereinsheim release` aus dem lokalen Checkout ([[operations]]).
