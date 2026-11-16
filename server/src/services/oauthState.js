const crypto = require('crypto');
const { redis } = require('../middleware/rateLimits');

const fallbackStates = new Map();
const stateLifetimeSeconds = 600;

async function createOAuthState() {
  const state = crypto.randomBytes(32).toString('hex');
  if (redis) {
    await redis.set(`portfolio:oauth-state:${state}`, '1', 'EX', stateLifetimeSeconds);
  } else {
    const now = Date.now();
    for (const [key, expiresAt] of fallbackStates) {
      if (expiresAt <= now) fallbackStates.delete(key);
    }
    fallbackStates.set(state, now + stateLifetimeSeconds * 1000);
  }
  return state;
}

async function consumeOAuthState(state) {
  if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state)) return false;
  if (redis) return (await redis.getdel(`portfolio:oauth-state:${state}`)) === '1';

  const expiresAt = fallbackStates.get(state);
  fallbackStates.delete(state);
  return Boolean(expiresAt && expiresAt > Date.now());
}

module.exports = { createOAuthState, consumeOAuthState };
