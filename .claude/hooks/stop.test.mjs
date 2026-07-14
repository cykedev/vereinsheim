// Tests for the Stop dispatcher's orchestration: fail-open per check, and ACCUMULATE
// every block message (unlike PreToolUse, which is first-deny-wins). Run:
// node --test .claude/hooks/stop.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';

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
