#!/usr/bin/env node
// SessionStart: surface't eine Ein-Zeilen-Zusammenfassung des Memory-Graphen und weist den
// Agenten an, ihn VOR breiter Exploration abzufragen. Der Graph IST der Vault (ADR-025) —
// dies liest die Notes direkt via vault-loader (unabhängig vom MCP-Server). Fail-open.
import { resolve } from 'node:path';
import { repoRoot } from './_lib.mjs';
import { loadVault } from '../vault-loader.mjs';

try {
	const { entities, relations } = loadVault(resolve(repoRoot(import.meta.url), 'vault'));
	if (!entities.length) process.exit(0);

	const byType = {};
	for (const e of entities) byType[e.entityType] = (byType[e.entityType] ?? 0) + 1;
	const breakdown = Object.entries(byType).sort().map(([k, v]) => `${v} ${k}`).join(', ');

	const context = [
		`Memory-Graph (der Vault): ${entities.length} Notes (${breakdown}), ${relations.length} Kanten.`,
		'VOR breiter Exploration abfragen. search_nodes nimmt eine natürlichsprachliche Query — die Notes dieses Projekts sind DEUTSCH, also rankt eine deutsche Frage/Phrase am besten (die Engine ist DE/EN-fähig: BM25 über Name/Essenz/Keywords + Synonym- und Flexions-Expansion; englische Tech-Begriffe treffen ebenfalls). open_nodes für eine exakte id (z.B. "adr-002"), read_graph für den vollen kleinen Dump.',
		'Dann frugal lesen: document_map <id> listet die Überschriften einer Note, section_read <id> <Überschrift> gibt genau den Abschnitt (ohne Überschrift die ganze Note). map→section lohnt bei den großen MOC-/Guide-Notes; die meisten atomaren Notes sind flach (document_map liefert flat:true) — die direkt ganz via section_read <id> lesen, keinen Map-Call davor. backlinks/traverse laufen die typisierten Kanten ab.',
		'Neues Wissen → eine Note unter vault/ editieren oder anlegen (Frontmatter gemäß vault/SCHEMA.md, mit typisierten "[[wikilink]]"-Kanten + kuratierter `keywords:`-Zeile für Synonyme). Kein Build-Schritt: die Änderung ist live. vault-lint validiert das Schema am Turn-Ende.',
		'Arbeitsteilung: Code-Struktur → CodeGraph-MCP (on-demand, Ground Truth über den Code); erzwingbare Regeln → Gates + vault/conventions.md; dieser Graph = projekt-/git-geteiltes Wissen. Maschinen-/ops-lokales → natives Auto-Memory.',
	].join(' ');

	process.stdout.write(
		JSON.stringify({
			hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
		}),
	);
} catch {
	// fail-open
}
process.exit(0);
