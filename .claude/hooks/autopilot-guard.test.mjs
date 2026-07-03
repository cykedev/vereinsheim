// Regression tests for the autopilot-guard Bash write-detection.
// Pure-function coverage — no marker side effects. Run:
// node --test .claude/hooks/autopilot-guard.test.mjs
// These lock in the bypasses found in review (>|, quoted targets, dd/ln, subshell,
// command substitution) and guard against false-positives on read-only commands.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bashSegments, writeTargets, interpreterOneLinerViolation } from './autopilot-guard.mjs';
import { isDotenvPath } from './_lib.mjs';

const P = 'package.json'; // stand-in protected path

// Commands whose WRITE target is the protected path — writeTargets must surface it.
const MUST_CATCH = [
	['redirect', `echo x > ${P}`],
	['append', `echo x >> ${P}`],
	['no space', `echo x >${P}`],
	['force clobber >|', `echo x >| ${P}`],
	['double-quoted target', `echo x > "${P}"`],
	["single-quoted target", `echo x > '${P}'`],
	['dd of=', `dd if=/dev/zero of=${P}`],
	['ln -sf link name', `ln -sf /evil ${P}`],
	['subshell redirect', `(echo x > ${P})`],
	['command substitution', `echo hi $(rm ${P})`],
	['backtick substitution', 'echo hi `rm ' + P + '`'],
	['tee', `cat foo | tee ${P}`],
	['sed -i', `sed -i s/a/b/ ${P}`],
	['rm after &&', `yarn build && rm -f ${P}`],
	['cp destination', `cp evil.js ${P}`],
	['fd-redirect then write', `node x 2>&1 > ${P}`],
];

for (const [label, cmd] of MUST_CATCH) {
	test(`catches write: ${label}`, () => {
		assert.ok(writeTargets(cmd).includes(P), `expected ${P} among write targets of: ${cmd}`);
	});
}

// Read-only / benign commands that merely MENTION the path — must NOT be flagged.
const MUST_ALLOW = [
	['git diff', `git diff --stat ${P}`],
	['cat', `cat ${P}`],
	['ls', `ls -la ${P}`],
	['grep for it in lock', `grep ${P} yarn.lock`],
	['echo mention', `echo "see ${P} for details"`],
	['commit message mention', `git commit -m "bump ${P} deps"`],
	['commit message with > inside', `git commit -m "a > b in ${P}"`],
	['pipeline with fd redirect', `yarn up -R form-data qs 2>&1 | tail -12`],
	['read redirect to /dev/null', `yarn check >/dev/null 2>&1`],
];

for (const [label, cmd] of MUST_ALLOW) {
	test(`allows read-only: ${label}`, () => {
		assert.ok(!writeTargets(cmd).includes(P), `did not expect ${P} among write targets of: ${cmd}`);
	});
}

test('fd-duplication is not a redirect target', () => {
	const redirs = bashSegments('echo x 2>&1').flatMap((s) => s.redirs);
	assert.deepEqual(redirs, []);
});

test('operator inside quotes stays literal (one token, no redirect)', () => {
	const segs = bashSegments('git commit -m "a > b"');
	assert.deepEqual(
		segs.flatMap((s) => s.redirs),
		[],
	);
	assert.ok(segs[0].words.includes('a > b'), 'quoted content should be a single literal word');
});

test('the autopilot marker is still surfaced by writeTargets (exemption is applied downstream)', () => {
	assert.ok(writeTargets('rm -f .claude/.autopilot-active').includes('.claude/.autopilot-active'));
});

// isDotenvPath: shared by pretool-guard.mjs and autopilot-guard.mjs — regression
// coverage for the config.env drift found in review (only pretool-guard's Bash
// command check caught it; the read-time path check and autopilot-guard's own
// check both missed it since they required a whole `.env`/`.env.*` path segment).
test('isDotenvPath catches a whole .env segment', () => {
	assert.equal(isDotenvPath('.env'), true);
	assert.equal(isDotenvPath('.env.local'), true);
	assert.equal(isDotenvPath('server/.env'), true);
});

test('isDotenvPath catches a basename ending in .env (e.g. config.env)', () => {
	assert.equal(isDotenvPath('config.env'), true);
	assert.equal(isDotenvPath('server/config.env'), true);
});

test('isDotenvPath exempts example/sample/template basenames', () => {
	assert.equal(isDotenvPath('.env.example'), false);
	assert.equal(isDotenvPath('config.env.sample'), false);
});

test('isDotenvPath does not false-positive on a filename merely containing "env"', () => {
	assert.equal(isDotenvPath('foo.env.ts'), false);
	assert.equal(isDotenvPath('environment.ts'), false);
});

// Projektspezifisch (vereinsheim): .vereinsheim.local ist unsere zweite Secret-Datei,
// nicht Teil des Blueprints — eigene Regressionsabdeckung dafür.
test('isDotenvPath catches our project-specific .vereinsheim.local', () => {
	assert.equal(isDotenvPath('.vereinsheim.local'), true);
});

test('isDotenvPath exempts a .vereinsheim.local example variant', () => {
	assert.equal(isDotenvPath('.vereinsheim.local.example'), false);
});

// interpreterOneLinerViolation: regression coverage for the confirmed bash -c / sh -c
// bypass — a bare `git push` was DENYed but wrapping it in an interpreter -c one-liner
// wasn't checked against PROTECTED_CMDS at all, only against protected paths/.env.
test('interpreterOneLinerViolation catches bash -c wrapping a protected command', () => {
	assert.ok(interpreterOneLinerViolation('bash -c "git push"'));
});

test('interpreterOneLinerViolation catches sh -c wrapping a protected command with args', () => {
	assert.ok(interpreterOneLinerViolation('sh -c "git push origin main"'));
});

test('interpreterOneLinerViolation catches zsh -c wrapping docker push', () => {
	assert.ok(interpreterOneLinerViolation('zsh -c "docker push myimage"'));
});

test('interpreterOneLinerViolation allows a benign interpreter one-liner', () => {
	assert.equal(interpreterOneLinerViolation('node -e "console.log(1)"'), null);
});

test('interpreterOneLinerViolation still catches a protected-path one-liner (no prior test coverage)', () => {
	assert.ok(interpreterOneLinerViolation('python -c "open(\'.claude/settings.json\', \'w\')"'));
});

test('interpreterOneLinerViolation does not flag a command without -c/-e/-p/-E', () => {
	assert.equal(interpreterOneLinerViolation('bash script.sh'), null);
});

test('interpreterOneLinerViolation catches a combined short-flag cluster (bash -lc, found in review)', () => {
	assert.ok(interpreterOneLinerViolation('bash -lc "git push"'));
});

test('interpreterOneLinerViolation catches -xc and node -pe combined clusters', () => {
	assert.ok(interpreterOneLinerViolation('bash -xc "git push"'));
	assert.ok(interpreterOneLinerViolation('node -pe "require(\'.claude/settings.json\')"'));
});

test('interpreterOneLinerViolation does not flag a flag cluster without c/e/p/E', () => {
	assert.equal(interpreterOneLinerViolation('bash -lx script.sh'), null);
});
