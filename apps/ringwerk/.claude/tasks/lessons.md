# Lernlog – Liga-App

Wird nach jeder Nutzerkorrektur aktualisiert.
Format: Datum | Fehler | Regel die ihn verhindert

---

<!-- Zuletzt konsolidiert: 2026-08-25 -->
<!-- Alle bisherigen Einträge konsolidiert: Regeln → docs/ (code-conventions, ui-patterns, data-model, shared-conventions); Incidents/State → Memory-Graph (.claude/graph-captured.mjs); ops-lokales → natives Auto-Memory. Langzeit-Gedächtnis ist der Memory-Graph, nicht dieser Buffer. -->

## Offen (2026-09-09, Saison-Sortierung)

| 2026-09-09 | `pnpm check` und ein laufender `next dev` teilen sich `apps/ringwerk/.next`; der Build zerlegt dabei `.next/types/validator.ts` → `check-types` wird rot (`TS2307 './routes.js'`), obwohl der Diff sauber ist. Danach `rm -rf .next` bei laufendem Dev-Server killt dessen `.next/dev` und die App antwortet mit `Cannot read properties of undefined (reading 'call')` bis zum Neustart. | Vor einem Gate-Lauf den Dev-Server stoppen; nach einem abgebrochenen Build erst `.next` räumen (bei gestopptem Server) und den Server neu starten, bevor man den Diff verdächtigt. |
| 2026-09-09 | `prisma migrate dev` scheiterte mit **P3014**: die Dev-Rollen hatten kein `CREATEDB`, die Schema-Engine kann also keine Shadow-DB anlegen. Der im `/migrate`-Skill dokumentierte Weg war im Monorepo-Dev-Setup nie lauffähig. | `CREATEDB` gehört ins Dev-Setup (`dev/db-init` **und** idempotent in `scripts/bootstrap-dev.sh`, weil db-init nur bei leerem Volume läuft). Prod migriert via `migrate deploy` und bekommt das Recht bewusst nicht. |
| 2026-09-09 | Eine Beschwerde über eine **Reihenfolge** hatte ihre Ursache in den **Rängen**: eine ausgegraute Zeile unter den Mindestserien hielt Rang 1, die gewerteten Zeilen darüber lasen 2, 3, 3. | Sortier-Pool und Rang-Pool müssen deckungsgleich sein. Wer die Reihenfolge ändert, prüft, welcher Pool die angezeigten Ränge speist. |
| 2026-09-09 | Beim Kürzen einer Anzeige (Inline-Badges nur Podium) `null` statt eines Platzhalters gerendert → Zahlen der Podiumszeilen rutschten gegenüber den übrigen; das PDF hatte für genau das längst einen Spacer. | Fällt ein fest breites Element in einer tabellarischen Zelle weg, tritt ein gleich breiter Platzhalter an seine Stelle — und dieselbe Regel gilt in Tabelle **und** PDF (Prädikat einmal, an einer Stelle). |
| 2026-09-09 | Die öffentliche PDF-Route cacht via `unstable_cache` mit **Wettbewerbs-ID als Key** und **Slug als Tag**. Datenänderungen per SQL (ohne Server-Action) liefern beliebig lange das alte PDF; wird der Slug per SQL geändert, verwaist der Eintrag unter dem alten Tag und ist gar nicht mehr invalidierbar. | Beim Verifizieren von Cache-behafteten Routen die Änderung über die Server-Action fahren (die revalidiert) oder die `no-store`-Route nehmen — nie per SQL am Cache vorbei und dann dem Feature misstrauen. |

## Abgeschlossen
