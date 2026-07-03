// Regression tests for pretool-guard's rm-guard and .env-read guard. Pure-function
// coverage — no process.exit / stdin side effects. Run:
// node --test .claude/hooks/pretool-guard.test.mjs
//
// These lock in the confirmed bypasses found in review: a quoted dangerous target
// ("$HOME"), split flags (-r -f), BSD/macOS-style -Rf, a `sudo`/`doas` prefix on rm,
// a commit message merely mentioning "source .env" false-positiving the .env-read
// guard, and a value-taking `sudo -u`/`-g` flag defeating the wrapper-skip (found in
// the harness-guard-sync /review pass, Juli 2026).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isDangerousRm, isEnvReadViolation } from './pretool-guard.mjs';

// Commands that MUST be blocked.
const MUST_BLOCK = [
	['plain', 'rm -rf /'],
	['quoted $HOME (bypass 1)', 'rm -rf "$HOME"'],
	['single-quoted $HOME', "rm -rf '$HOME'"],
	['unquoted $HOME', 'rm -rf $HOME'],
	['split flags -r -f (bypass 2)', 'rm -r -f /'],
	['split flags -f -r', 'rm -f -r /'],
	['uppercase -Rf (bypass 3)', 'rm -Rf /'],
	['uppercase -R with separate -f', 'rm -R -f /'],
	['long flags', 'rm --recursive --force /'],
	['mixed long + short', 'rm --recursive -f /'],
	['tilde', 'rm -rf ~'],
	['tilde slash', 'rm -rf ~/'],
	['bare dot', 'rm -rf .'],
	['star', 'rm -rf *'],
	['braced HOME', 'rm -rf ${HOME}'],
	['after &&', 'yarn build && rm -rf /'],
	['sudo prefix', 'sudo rm -rf /'],
	['sudo with own flag', 'sudo -n rm -rf /'],
	['doas prefix', 'doas rm -rf /'],
	['sudo with value-taking -u flag (review fix, Juli 2026)', 'sudo -u root rm -rf /'],
	['sudo with value-taking -g flag', 'sudo -g wheel rm -rf /'],
	['double sudo wrapper', 'sudo sudo rm -rf /'],
];

for (const [label, cmd] of MUST_BLOCK) {
	test(`isDangerousRm blocks: ${label}`, () => {
		assert.ok(isDangerousRm(cmd), `expected ${JSON.stringify(cmd)} to be flagged`);
	});
}

// Commands that MUST NOT be blocked — narrowed paths and non-rm mentions.
const MUST_ALLOW = [
	['narrowed relative path', 'rm -rf ./build'],
	['node_modules', 'rm -rf node_modules'],
	['narrowed home subdir', 'rm -rf ~/project'],
	['narrowed absolute path', 'rm -rf /etc/x'],
	['force only, not recursive', 'rm -f /'],
	['recursive only, not force', 'rm -r /'],
	['commit message mentions rm -rf /', 'git commit -m "fix: don\'t rm -rf / by accident"'],
	['commit message mentions -Rf', 'git commit -m "note: -Rf is dangerous"'],
	['no rm at all', 'echo "$HOME"'],
	['npm rm is not sudo/doas rm', 'npm rm somepkg'],
	['bare sudo, no command (no crash)', 'sudo'],
	['sudo -n, no command (no crash)', 'sudo -n'],
];

for (const [label, cmd] of MUST_ALLOW) {
	test(`isDangerousRm allows: ${label}`, () => {
		assert.ok(!isDangerousRm(cmd), `did not expect ${JSON.stringify(cmd)} to be flagged`);
	});
}

// .env-read guard: MUST block real reads (including through sudo/quotes), MUST NOT
// block a command that merely mentions ".env"/"source" in an unrelated argument.
const ENV_MUST_BLOCK = [
	['cat .env', 'cat .env'],
	['quoted cat .env', 'cat ".env"'],
	['source .env', 'source .env'],
	['cat config.env', 'cat config.env'],
	['mv .env elsewhere', 'mv .env /tmp/backup'],
	['cp real .env over example', 'cp .env.example .env'],
	['sudo cat .env', 'sudo cat .env'],
	['sudo with value-taking -u flag (review fix, Juli 2026)', 'sudo -u root cat .env'],
	['cat .vereinsheim.local (vereinsheim-spezifisch)', 'cat .vereinsheim.local'],
];

for (const [label, cmd] of ENV_MUST_BLOCK) {
	test(`isEnvReadViolation blocks: ${label}`, () => {
		assert.ok(isEnvReadViolation(cmd), `expected ${JSON.stringify(cmd)} to be flagged`);
	});
}

const ENV_MUST_ALLOW = [
	['commit message mentions source .env (regression)', 'git commit -m "fix: source .env handling"'],
	['commit message mentions cat .env', 'git commit -m "docs: explain cat .env usage"'],
	['.env.example read', 'cat .env.example'],
	['unrelated cat', 'cat README.md'],
	['commit message mentions .vereinsheim.local (vereinsheim-spezifisch)', 'git commit -m "docs: explain .vereinsheim.local usage"'],
];

for (const [label, cmd] of ENV_MUST_ALLOW) {
	test(`isEnvReadViolation allows: ${label}`, () => {
		assert.ok(!isEnvReadViolation(cmd), `did not expect ${JSON.stringify(cmd)} to be flagged`);
	});
}
