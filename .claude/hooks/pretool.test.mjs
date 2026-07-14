// Tests for the PreToolUse dispatcher's orchestration: first-deny-wins and
// fail-open-per-check (a throw in one evaluator must not suppress the others). Run:
// node --test .claude/hooks/pretool.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dispatch } from './pretool.mjs';

const allow = async () => ({ deny: false });
const deny = (reason) => async () => ({ deny: true, reason });
const boom = async () => {
	throw new Error('kaboom');
};
const ctx = (context) => async () => ({ deny: false, context });

test('denies when any evaluator denies', async () => {
	const r = await dispatch({}, [allow, deny('nope')]);
	assert.equal(r.deny, true);
	assert.equal(r.reason, 'nope');
});

test('first denier wins', async () => {
	const r = await dispatch({}, [deny('first'), deny('second')]);
	assert.equal(r.reason, 'first');
});

test('a throwing check fails open and does not suppress the others', async () => {
	const r = await dispatch({}, [boom, deny('caught by second')]);
	assert.equal(r.deny, true);
	assert.equal(r.reason, 'caught by second');
});

test('a throwing check alone → allow (fail-open)', async () => {
	const r = await dispatch({}, [boom]);
	assert.equal(r.deny, false);
});

test('advisory context passes through on allow', async () => {
	const r = await dispatch({}, [ctx('hi'), allow]);
	assert.equal(r.deny, false);
	assert.equal(r.context, 'hi');
});

test('deny takes precedence over context', async () => {
	const r = await dispatch({}, [ctx('hi'), deny('blocked')]);
	assert.equal(r.deny, true);
	assert.equal(r.reason, 'blocked');
});
