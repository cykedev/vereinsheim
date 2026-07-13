#!/usr/bin/env node
// Vault validator + health check (ADR-011). Run by the graph-sync Stop hook and
// re-runnable any time. Two tiers:
//   ERRORS (exit 1 — block the turn):
//     - loader warnings (missing id, invalid type, duplicate id, dangling [[edge]])
//     - missing title
//     - atomic notes (subsystem/operation/concept/incident) lack a curated `keywords:`
//     - a documented_in section anchor resolves to no heading in the target note
//   ADVISORIES (printed, exit 0 — health, not correctness):
//     - orphans: a note reachable by neither an inbound nor an outbound edge (only
//       findable by search, not by graph walk). Standalone ADRs are legitimate orphans,
//       so this warns rather than fails — the wiki-lint concept adapted to our graph.
// `type` is the note KIND (frontmatter); folders are TOPICS — no type↔folder rule.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadVault } from './vault-loader.mjs';
import { headingSlugs, slugify } from './doc-index.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = resolve(ROOT, 'vault');
const CURATED = new Set(['subsystem', 'operation', 'concept', 'incident']);

function main() {
	const { notes, entities, relations, warnings } = loadVault(VAULT);
	const errors = [...warnings];
	const advisories = [];

	if (!entities.length) errors.push('vault is empty — no notes with id/type found under vault/');

	for (const note of notes.values()) {
		if (!note.title) errors.push(`${note.relPath}: missing title`);
		if (CURATED.has(note.type) && !note.keywords.length) {
			errors.push(`${note.relPath}: ${note.type} note needs a curated \`keywords:\` line (synonyms/jargon the body omits)`);
		}
		for (const t of note.edges.documented_in ?? []) {
			if (!t.section) continue;
			const target = notes.get(t.id);
			if (!target) continue; // dangling already reported by the loader
			const slugs = new Set(headingSlugs(target.body).map((h) => h.slug));
			if (!slugs.has(slugify(t.section))) {
				errors.push(`${note.relPath}: documented_in -> [[${t.id}#${t.section}]] has no such heading in ${target.relPath}`);
			}
		}
	}

	// Health: orphans (unreachable via the graph — no inbound AND no outbound edge).
	const hasOut = new Set(relations.map((r) => r.from));
	const hasIn = new Set(relations.map((r) => r.to));
	for (const note of notes.values()) {
		if (!hasOut.has(note.id) && !hasIn.has(note.id)) {
			advisories.push(`${note.relPath}: orphan — no inbound or outbound edge (findable only by search). Wire it into a topic with a [[link]], or leave it if it stands alone.`);
		}
	}

	if (errors.length) {
		process.stderr.write(`✖ vault-lint: ${errors.length} problem(s)\n`);
		for (const e of errors) process.stderr.write(`  - ${e}\n`);
		process.exit(1);
	}
	const byType = Object.entries(entities.reduce((a, e) => ((a[e.entityType] = (a[e.entityType] ?? 0) + 1), a), {}))
		.sort().map(([k, v]) => `${v} ${k}`).join(', ');
	process.stdout.write(`✓ vault-lint: ${entities.length} notes (${byType}), ${relations.length} edges — schema valid\n`);
	if (advisories.length) {
		process.stdout.write(`\n⚠ ${advisories.length} health advisory(ies) (not blocking):\n`);
		for (const a of advisories) process.stdout.write(`  - ${a}\n`);
	}
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
export { main };
