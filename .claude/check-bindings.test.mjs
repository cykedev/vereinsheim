// Regression tests for check-bindings' placeholder regex. Run:
// node --test .claude/check-bindings.test.mjs
//
// Locks in the fix for a confirmed false-positive: a bound project's own docs may
// contain generic-type syntax (Vec<String>, Promise<T>) that is lexically identical
// to a placeholder like <Name> or <T> — distinguished only by whether the `<` is
// glued directly to an identifier character.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLACEHOLDER } from './check-bindings.mjs';

const matches = (text) => [...text.matchAll(PLACEHOLDER)].map((m) => m[0]);

test('does not flag generic-type syntax glued to an identifier', () => {
	assert.deepEqual(matches('Vec<String>'), []);
	assert.deepEqual(matches('Promise<T>'), []);
	assert.deepEqual(matches('HashMap<K, V>'), []);
	assert.deepEqual(matches('a function returning Array<Number>'), []);
});

test('still flags a real UPPER_SNAKE placeholder', () => {
	assert.deepEqual(matches('<GATE_FULL>'), ['<GATE_FULL>']);
	assert.deepEqual(matches('the command `<DEV_CMD>` runs'), ['<DEV_CMD>']);
});

test('still flags a table-row Capitalized placeholder', () => {
	assert.deepEqual(matches('| <Name> | <What it owns> | <Path> |'), ['<Name>', '<What it owns>', '<Path>']);
});

test('still flags a multi-line prose prompt', () => {
	const text = '<One paragraph: what it does.\nMore detail on the next line.>';
	assert.deepEqual(matches(text), [text]);
});

test('does not flag literal lowercase forms (pre-existing exclusion, unaffected by the lookbehind)', () => {
	assert.deepEqual(matches('feat/<topic>'), []);
	assert.deepEqual(matches('<file>#<slug>'), []);
});
