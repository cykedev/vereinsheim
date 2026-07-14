#!/usr/bin/env node
// Stop-Hook (ADR-025): niemals ein Turn-Ende mit invalidem Memory-Graph. Der Graph IST
// der Vault (kein Build mehr) — dies validiert das Vault-Schema via vault-lint (type,
// eindeutige ids, keine dangling [[edges]], Pflichtfelder, auflösbare Section-Anker) und
// blockt bei einem Problem. Fail-open bei Infra-Fehlern. `evaluate()` ist der reine Check
// (geteilt mit dem stop.mjs-Dispatcher); der Standalone-Runner unten erhält das Hook-Verhalten.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readInput, repoRoot } from './_lib.mjs';

// Liefert { block, message? }. block=true → Vault invalide, Turn-Ende halten.
// Fail-open (block:false) bei jedem Infra-Fehler (kein node / Timeout / Spawn-Fehler).
export function evaluate() {
	try {
		const ROOT = repoRoot(import.meta.url);
		const res = spawnSync('node', ['.claude/vault-lint.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
		if (res.error) return { block: false };
		if (res.status === 0) return { block: false };
		const out = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();
		return {
			block: true,
			message: `Stop geblockt: der Memory-Graph (vault/) ist invalide. Die genannte Note fixen (Schema/Anker/keywords), nicht den Store — es gibt keinen mehr (ADR-025):\n${out}`,
		};
	} catch {
		return { block: false };
	}
}

async function main() {
	try {
		const input = await readInput();
		if (input.stop_hook_active) process.exit(0);
		const r = evaluate();
		if (r.block) {
			process.stderr.write(`${r.message}\n`);
			process.exit(2);
		}
	} catch {
		// fail-open
	}
	process.exit(0);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
