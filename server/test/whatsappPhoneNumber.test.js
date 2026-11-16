const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeWhatsAppPhoneNumber } = require('../src/utils/whatsappPhoneNumber');

test('normalizes valid Indian numbers and rejects incomplete Indian mobile numbers', () => {
  assert.equal(normalizeWhatsAppPhoneNumber('+91 84888 98405'), '918488898405');
  assert.equal(normalizeWhatsAppPhoneNumber('+91 8488 98405'), '');
  assert.equal(normalizeWhatsAppPhoneNumber('8488898405'), '');
});

test('normalizes other international numbers without assuming a country code', () => {
  assert.equal(normalizeWhatsAppPhoneNumber('+1 (202) 555-0123'), '12025550123');
  assert.equal(normalizeWhatsAppPhoneNumber('invalid'), '');
});
