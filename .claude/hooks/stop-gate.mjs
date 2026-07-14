#!/usr/bin/env node
// Stop-Gate (ADR-018, ENFORCE auf Harness-Ebene): blockt das Turn-Ende, bis
// `pnpm check` grün ist (lint/format/test/tsc/next build, turbo-gecacht → billig
// bei No-Change). Fail-open: pnpm fehlt ODER Dev-Postgres nicht erreichbar → erlauben
// (nie bricken). `evaluate()` ist der reine Check (geteilt mit dem stop.mjs-Dispatcher);
// der Standalone-Runner unten erhält das Hook-Verhalten (stop_hook_active-Guard).
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readInput } from './_lib.mjs';

// harness:gate-fast — das Turn-Gate. `true` wäre ein No-op; hier: die volle 5er-Gate.
const GATE = { command: 'pnpm check' };

// Liefert { block, message?, note? }. block=true → Gates rot, Turn-Ende halten.
// note = nicht-blockierender Hinweis (nur im Standalone-Runner ausgegeben).
export function evaluate() {
	try {
		execSync(GATE.command, { stdio: 'pipe', timeout: 600000 });
		return { block: false };
	} catch (e) {
		if (e.code === 'ENOENT') return { block: false };
		const out = ((e.stdout && e.stdout.toString()) || '') + ((e.stderr && e.stderr.toString()) || '');
		if (/ECONNREFUSED|SASL|password authentication|could not connect|Connection terminated|getaddrinfo/i.test(out)) {
			return { block: false, note: '[stop-gate] Dev-Postgres nicht erreichbar — Gate übersprungen (fail-open). Starte: docker compose -f docker-compose.dev.yml up -d' };
		}
		return { block: true, message: `[stop-gate] Gates sind ROT — bitte grün ziehen, bevor du aufhörst:\n${out.slice(-2200)}` };
	}
}

async function main() {
	try {
		const input = await readInput();
		if (input.stop_hook_active) process.exit(0);
		const r = evaluate();
		if (r.note) console.error(r.note);
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
