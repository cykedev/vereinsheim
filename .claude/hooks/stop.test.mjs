// Tests for the Stop dispatcher's orchestration: fail-open per check, and ACCUMULATE
// every block message (unlike PreToolUse, which is first-deny-wins). Also the Node the
// gate's child processes get from `.nvmrc` (`pickNodeVersion`, `nodeEnv`). Run:
// node --test .claude/hooks/stop.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';

import { nodeEnv, pickNodeVersion } from './_lib.mjs';
import { dispatch } from './stop.mjs';

const ok = async () => ({ block: false });
const blocks = (message) => async () => ({ block: true, message });
const boom = async () => {
	throw new Error('x');
};

test('passes when nothing blocks', async () => {
	const r = await dispatch({}, [ok, ok]);
	assert.equal(r.block, false);
});

test('blocks and accumulates both messages', async () => {
	const r = await dispatch({}, [blocks('graph bad'), blocks('gate red')]);
	assert.equal(r.block, true);
	assert.match(r.message, /graph bad/);
	assert.match(r.message, /gate red/);
});

test('a throwing check fails open; the others are still evaluated', async () => {
	const r = await dispatch({}, [boom, blocks('gate red')]);
	assert.equal(r.block, true);
	assert.match(r.message, /gate red/);
});

const INSTALLED = ['v0.12.18', 'v20.9.0', 'v24.22.1', 'v26.2.0', 'v26.12.1', 'v26.9.3', 'v126.0.0', '.cache'];

test('pickNodeVersion takes the highest version of the major in .nvmrc', () => {
	assert.equal(pickNodeVersion('26', INSTALLED), 'v26.12.1');
	assert.equal(pickNodeVersion('v26\n', INSTALLED), 'v26.12.1');
	assert.equal(pickNodeVersion('20', INSTALLED), 'v20.9.0');
});

test('pickNodeVersion honours minor and patch in .nvmrc', () => {
	assert.equal(pickNodeVersion('26.9', INSTALLED), 'v26.9.3');
	assert.equal(pickNodeVersion('26.2.0', INSTALLED), 'v26.2.0');
});

test('pickNodeVersion finds nothing for a missing version or an alias', () => {
	assert.equal(pickNodeVersion('28', INSTALLED), null);
	assert.equal(pickNodeVersion('lts/*', INSTALLED), null);
	assert.equal(pickNodeVersion('', INSTALLED), null);
	assert.equal(pickNodeVersion('26', []), null);
});

function fakeRepo(nvmrc, versions) {
	const base = mkdtempSync(join(tmpdir(), 'hooks-node-'));
	const root = join(base, 'repo');
	mkdirSync(root);
	if (nvmrc !== undefined) writeFileSync(join(root, '.nvmrc'), nvmrc);
	for (const v of versions) mkdirSync(join(base, 'nvm', 'versions', 'node', v, 'bin'), { recursive: true });
	return { root, nvmDir: join(base, 'nvm') };
}

test('nodeEnv puts the bin folder of the .nvmrc version in front of PATH', () => {
	const { root, nvmDir } = fakeRepo('26\n', ['v20.9.0', 'v26.12.1']);
	const r = nodeEnv(root, { env: { NVM_DIR: nvmDir, PATH: '/old/bin', KEEP: '1' } });
	assert.equal(r.env.PATH, `${join(nvmDir, 'versions', 'node', 'v26.12.1', 'bin')}${delimiter}/old/bin`);
	assert.equal(r.env.KEEP, '1');
	assert.equal(r.note, undefined);
});

test('nodeEnv falls back to ~/.nvm without NVM_DIR', () => {
	const { root, nvmDir } = fakeRepo('26', ['v26.12.1']);
	const home = join(nvmDir, '..');
	mkdirSync(join(home, '.nvm', 'versions', 'node', 'v26.1.0', 'bin'), { recursive: true });
	const r = nodeEnv(root, { env: { PATH: '/old/bin' }, home });
	assert.equal(r.env.PATH, `${join(home, '.nvm', 'versions', 'node', 'v26.1.0', 'bin')}${delimiter}/old/bin`);
});

test('nodeEnv leaves the environment as it is and says so without a matching version', () => {
	const { root, nvmDir } = fakeRepo('26', ['v20.9.0']);
	const env = { NVM_DIR: nvmDir, PATH: '/old/bin' };
	const r = nodeEnv(root, { env });
	assert.equal(r.env, env);
	assert.match(r.note, /Kein Node zu \.nvmrc \(26\)/);
});

test('nodeEnv says so without nvm at all', () => {
	const { root } = fakeRepo('26', []);
	const env = { NVM_DIR: join(root, 'no-nvm'), PATH: '/old/bin' };
	const r = nodeEnv(root, { env });
	assert.equal(r.env, env);
	assert.match(r.note, /Kein Node/);
});

test('nodeEnv without .nvmrc changes nothing and stays quiet', () => {
	const { root, nvmDir } = fakeRepo(undefined, ['v26.12.1']);
	const env = { NVM_DIR: nvmDir, PATH: '/old/bin' };
	const r = nodeEnv(root, { env });
	assert.equal(r.env, env);
	assert.equal(r.note, undefined);
});
