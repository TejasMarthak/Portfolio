const test = require('node:test');
const assert = require('node:assert/strict');

test('maps browser AbortError code 20 to a FormSubmit timeout', async (context) => {
  const originalFetch = global.fetch;
  global.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      const error = new DOMException('The operation was aborted.', 'AbortError');
      assert.equal(error.code, 20);
      reject(error);
    }, { once: true });
  });
  context.after(() => {
    global.fetch = originalFetch;
  });

  const { sendFormSubmit } = await import('../../shared/formSubmit.js');
  await assert.rejects(
    sendFormSubmit('owner@example.com', { source: 'pro', subject: 'Test' }, { timeoutMs: 1 }),
    (error) => {
      assert.equal(error.code, 'FORMSUBMIT_TIMEOUT');
      assert.equal(error.responseCode, undefined);
      return true;
    }
  );
});
