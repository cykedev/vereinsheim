#!/usr/bin/env node
// Stop: pull session knowledge forward — automatically, so nobody has to ask. After
// substantive code work is committed without a matching knowledge update, nudge ONCE for
// a capture pass (a lessons.md row or a vault/ note — the live memory graph).
//
// Design (gentle nudge, once per work-batch — never naggy, never loops):
//   - uncommitted working changes         → no block (work in progress; capture on commit)
//   - no commits ahead of base w/ code    → no block (no substantive work)
//   - the ahead-range already has a sink   → no block (already captured)
//   - already nudged for this exact HEAD   → no block (don't repeat)
//   - otherwise                            → record HEAD and BLOCK once with a reminder
// Fail-open on any infra error so the harness can never brick a session. evaluate() is
// the pure check (run by the stop.mjs dispatcher); the standalone runner below preserves
// the hook behaviour when it is invoked directly.
//
// GENERIC BY DESIGN — no hard-coded branch name or source layout, so it works
// clone-and-go on any project (rather than needing a per-project binding slot):
//   - the integration branch is discovered via origin/HEAD (falling back to main/master);
//   - "substantive work" is anything committed that is NOT the knowledge layer, `.claude/`
//     plumbing, or a pure doc — inverted so it fits any project's source tree.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readInput, repoRoot } from './_lib.mjs';

const ROOT = repoRoot(import.meta.url);
const STATE = join(ROOT, '.claude', '.knowledge-nudge');

// Knowledge sinks whose presence in the commit range counts as "captured": a lessons.md
// row, or any vault/ note (the live memory graph — ADR-011). The vault is live, so
// editing a note IS the update — there is nothing to build.
const KNOWLEDGE_FILES = ['.claude/tasks/lessons.md'];
const isKnowledge = (f) => f.startsWith('vault/') || KNOWLEDGE_FILES.includes(f);

// A committed file is "substantive work" unless it is itself a knowledge sink, harness
// plumbing, or a pure doc. Inverted (rather than an allow-list of source dirs) so it fits
// any project's layout without a per-project binding.
const isDocOrPlumbing = (f) =>
	isKnowledge(f) || f.startsWith('.claude/') || /\.(md|mdx|markdown|txt|rst|adoc)$/i.test(f);

function git(args) {
	const res = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', timeout: 15000 });
	if (res.error || res.status !== 0) return null; // fail-open signal
	return (res.stdout ?? '').trim();
}

// The repo's integration branch (main/master), discovered generically — no hard-coded
// name. origin/HEAD is the remote's default branch; fall back to a local main/master.
function integrationBranch() {
	const head = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']); // e.g. "origin/main"
	if (head) return head.replace(/^origin\//, '');
	for (const b of ['main', 'master']) {
		if (git(['rev-parse', '--verify', '--quiet', b]) !== null) return b;
	}
	return null;
}

// evaluate() → { block, message } — same contract as graph-sync/stop-gate, so the
// stop.mjs dispatcher runs it fail-open alongside them.
export function evaluate() {
	try {
		// 1. Don't nudge mid-edit: capture happens once work is committed.
		const dirty = git(['status', '--porcelain']);
		if (dirty === null) return { block: false }; // not a git repo / git missing → fail-open
		if (dirty !== '') return { block: false };

		// 2. Establish a base to diff against: the integration branch for feature
		//    branches, its upstream when we are on the integration branch itself.
		const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
		if (!branch) return { block: false };
		const integration = integrationBranch();
		if (!integration) return { block: false };
		const base =
			branch === integration
				? git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
				: integration;
		if (!base) return { block: false };

		const head = git(['rev-parse', 'HEAD']);
		if (!head) return { block: false };

		// 3. Files changed in the ahead-range (since the merge-base).
		const changed = git(['diff', '--name-only', `${base}...HEAD`]);
		if (changed === null) return { block: false };
		const files = changed.split('\n').filter(Boolean);
		if (files.length === 0) return { block: false };

		const codeChanged = files.some((f) => !isDocOrPlumbing(f));
		if (!codeChanged) return { block: false }; // no substantive code work

		const knowledgeCaptured = files.some(isKnowledge);
		if (knowledgeCaptured) return { block: false }; // already pulled knowledge forward

		// 4. Dedup: only nudge once per HEAD. If the model decides nothing is worth
		//    capturing and stops without a new commit, HEAD is unchanged → no repeat.
		let last = '';
		try {
			last = readFileSync(STATE, 'utf8').trim();
		} catch {
			/* no prior state */
		}
		if (last === head) return { block: false };
		try {
			writeFileSync(STATE, `${head}\n`);
		} catch {
			/* state is best-effort; still nudge */
		}

		return {
			block: true,
			message:
				"Stop paused: pull this session's knowledge forward before ending.\n\n" +
				'You committed code changes without updating the knowledge graph.\n' +
				'Do a brief capture pass:\n' +
				'  1. Add any durable, non-obvious lesson to .claude/tasks/lessons.md\n' +
				'     (one row each) and/or a new note under vault/ (the live memory graph,\n' +
				'     the REMEMBER tier — see /consolidate-lessons). The vault is live; there\n' +
				'     is nothing to rebuild.\n' +
				'  2. Validate with node .claude/vault-lint.mjs, then commit the update.\n\n' +
				'Capture only what is genuinely reusable (gotchas, non-obvious decisions) —\n' +
				'NOT what the code/git already records. If nothing this batch is worth keeping,\n' +
				'say so in one line and stop (you will not be asked again for this commit).',
		};
	} catch {
		return { block: false }; // fail-open
	}
}

async function main() {
	try {
		const input = await readInput();
		if (input.stop_hook_active) process.exit(0); // prevent stop-hook loops
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
