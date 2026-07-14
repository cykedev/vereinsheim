#!/usr/bin/env node
// PreToolUse dispatcher. Runs both guards in ONE process — one Node cold-start per
// matching tool call instead of two. Order is deliberate: the universal security
// guard (secrets / rm -rf / backgrounded servers) first, then the autopilot
// protected-paths guard. Each evaluator runs in its OWN try/catch, so a throw in one
// never suppresses the other — the same fail-open, independent-protection guarantee
// the two separate hooks gave. DENY = exit 2 + stderr (first denier wins); an
// advisory context (the CodeGraph nudge) is emitted only when nothing denies.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readInput } from './_lib.mjs';
import { evaluate as evaluateGuard } from './pretool-guard.mjs';
import { evaluate as evaluateAutopilot } from './autopilot-guard.mjs';

// Pure orchestration (exported for pretool.test.mjs): run each evaluator fail-open in
// its own try/catch, return the first deny, else surface the first advisory context.
export async function dispatch(input, evaluators) {
	let context;
	let contextMarker;
	for (const fn of evaluators) {
		let r;
		try {
			r = await fn(input);
		} catch {
			r = { deny: false }; // a throw in one check never suppresses the others
		}
		if (r && r.deny) return { deny: true, reason: r.reason };
		if (r && r.context && context === undefined) {
			context = r.context;
			contextMarker = r.contextMarker;
		}
	}
	return { deny: false, context, contextMarker };
}

async function main() {
	try {
		const input = await readInput();
		const r = await dispatch(input, [evaluateGuard, evaluateAutopilot]);
		if (r.deny) {
			process.stderr.write(`${r.reason}\n`);
			process.exit(2);
		}
		if (r.context) {
			if (r.contextMarker) {
				try {
					writeFileSync(r.contextMarker, '1');
				} catch {
					// ignore
				}
			}
			process.stdout.write(
				JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: r.context } }),
			);
		}
	} catch {
		// fail-open
	}
	process.exit(0);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
