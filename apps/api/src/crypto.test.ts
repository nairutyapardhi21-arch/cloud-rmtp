import test from 'node:test';
import assert from 'node:assert/strict';
import { generateStreamKey, hashStreamKey, keysMatch } from './crypto.js';

test('stream keys are random and verified only against their hash', () => {
  const first = generateStreamKey();
  const second = generateStreamKey();
  assert.notEqual(first, second);
  assert.equal(first.length >= 40, true);
  assert.equal(keysMatch(first, hashStreamKey(first)), true);
  assert.equal(keysMatch(second, hashStreamKey(first)), false);
});

