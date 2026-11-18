const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createContactRouter } = require('../src/routes/contact');

test('contact submissions are acknowledged without waiting for notification providers', async (context) => {
  let emailStarted = false;
  const Contact = {
    create: async (values) => ({
      ...values,
      _id: 'contact-test-id',
      toObject() {
        return { ...this };
      }
    }),
    updateOne: async () => ({ matchedCount: 1 })
  };
  const app = express();
  app.use(express.json());
  app.use('/api/contact', createContactRouter({
    Contact,
    sendWhatsAppMessage: async () => ({ sent: true }),
    sendContactEmail: () => {
      emailStarted = true;
      return new Promise(() => {});
    }
  }));
  const server = app.listen(0);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/contact`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      source: 'pro',
      name: 'Test visitor',
      email: 'visitor@example.com',
      subject: 'Test inquiry',
      message: 'Testing the contact form'
    })
  });

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    ok: true,
    message: 'Your message has been received'
  });
  assert.equal(emailStarted, true);
});
