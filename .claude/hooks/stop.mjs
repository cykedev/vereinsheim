#!/usr/bin/env node
// Stop dispatcher. Runs the Stop checks in ONE process: graph-sync (validate the memory
// graph), the stop-gate (the turn gate), then knowledge-capture (nudge once to pull
// session knowledge forward). Each runs in its own try/catch (fail-open per check); if
// any blocks, ALL messages are shown and the stop is held (exit 2). `stop_hook_active`
// is honoured once to prevent loops.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readInput } from './_lib.mjs';
import { evaluate as evaluateGraphSync } from './graph-sync.mjs';
import { evaluate as evaluateStopGate } from './stop-gate.mjs';
import { evaluate as evaluateKnowledgeCapture } from './knowledge-capture.mjs';

// Pure orchestration (exported for stop.test.mjs): run each check fail-open and
// ACCUMULATE every block message — both are independent turn-end validations, so the
// user should see all problems at once, not just the first.
export async function dispatch(input, evaluators) {
	const messages = [];
	for (const fn of evaluators) {
		let r;
		try {
			r = await fn(input);
		} catch {
			r = { block: false }; // a throw in one check never suppresses the others
		}
		if (r && r.block) messages.push(r.message || '(stop blocked)');
	}
	return { block: messages.length > 0, message: messages.join('\n\n') };
}

async function main() {
	try {
		const input = await readInput();
		if (input.stop_hook_active) process.exit(0); // prevent stop-hook loops
		const r = await dispatch(input, [evaluateGraphSync, evaluateStopGate, evaluateKnowledgeCapture]);
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
