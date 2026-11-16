const test = require('node:test');
const assert = require('node:assert/strict');
const { createOAuthState, consumeOAuthState } = require('../src/services/oauthState');

test('OAuth state is a one-time token and is not tied to the callback IP', async () => {
  const state = await createOAuthState();

  assert.match(state, /^[a-f0-9]{64}$/);
  assert.equal(await consumeOAuthState(state), true);
  assert.equal(await consumeOAuthState(state), false);
});

test('OAuth state rejects malformed values', async () => {
  assert.equal(await consumeOAuthState('not-a-state'), false);
});
