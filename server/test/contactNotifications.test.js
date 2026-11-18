const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { createContactRouter } = require('../src/routes/contact');

test('contact submissions are saved and return a short-lived browser email delivery token', async (context) => {
  const originalSecret = process.env.JWT_ACCESS_SECRET;
  const originalRecipient = process.env.GMAIL_USER;
  const secret = 'test-secret-with-more-than-thirty-two-characters';
  process.env.JWT_ACCESS_SECRET = secret;
  process.env.GMAIL_USER = 'owner@example.com';
  let whatsappStarted = false;
  const updates = [];
  const Contact = {
    create: async (values) => ({
      ...values,
      _id: 'contact-test-id',
      toObject() {
        return { ...this };
      }
    }),
    updateOne: async (query, update) => {
      updates.push({ query, update });
      return { matchedCount: 1 };
    }
  };
  const app = express();
  app.use(express.json());
  app.use('/api/contact', createContactRouter({
    Contact,
    sendWhatsAppMessage: async () => {
      whatsappStarted = true;
      return { sent: true };
    }
  }));
  const server = app.listen(0);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  context.after(() => {
    if (originalSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = originalSecret;
    if (originalRecipient === undefined) delete process.env.GMAIL_USER;
    else process.env.GMAIL_USER = originalRecipient;
  });
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

  const body = await response.json();
  assert.equal(response.status, 202);
  assert.equal(body.ok, true);
  assert.equal(body.message, 'Your message has been received');
  assert.equal(body.contactId, 'contact-test-id');
  assert.equal(body.emailDelivery.recipient, 'owner@example.com');
  assert.equal(body.emailDelivery.fields.source, 'pro');
  const token = jwt.verify(body.emailDelivery.statusToken, secret);
  assert.equal(token.purpose, 'contact-email-status');
  assert.equal(token.contactId, 'contact-test-id');
  assert.equal(whatsappStarted, true);
});

test('only the signed contact email token can mark its own inquiry as delivered', async (context) => {
  const originalSecret = process.env.JWT_ACCESS_SECRET;
  const secret = 'test-secret-with-more-than-thirty-two-characters';
  process.env.JWT_ACCESS_SECRET = secret;
  const updates = [];
  const Contact = {
    updateOne: async (query, update) => {
      updates.push({ query, update });
      return { matchedCount: 1 };
    }
  };
  const app = express();
  app.use(express.json());
  app.use('/api/contact', createContactRouter({
    Contact,
    sendWhatsAppMessage: async () => ({ sent: true })
  }));
  const server = app.listen(0);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  context.after(() => {
    if (originalSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = originalSecret;
  });
  await new Promise((resolve) => server.once('listening', resolve));

  const token = jwt.sign({
    purpose: 'contact-email-status',
    contactId: 'contact-test-id'
  }, secret, { expiresIn: '15m' });
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/contact/contact-test-id/email-status`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ statusToken: token })
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, emailSent: true });
  assert.deepEqual(updates, [{
    query: { _id: 'contact-test-id' },
    update: { $set: { emailSent: true } }
  }]);
});

test('rejects contact email status tokens for a different inquiry', async (context) => {
  const originalSecret = process.env.JWT_ACCESS_SECRET;
  const secret = 'test-secret-with-more-than-thirty-two-characters';
  process.env.JWT_ACCESS_SECRET = secret;
  const updates = [];
  const app = express();
  app.use(express.json());
  app.use('/api/contact', createContactRouter({
    Contact: {
      updateOne: async (...args) => {
        updates.push(args);
        return { matchedCount: 1 };
      }
    },
    sendWhatsAppMessage: async () => ({ sent: true })
  }));
  const server = app.listen(0);
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  context.after(() => {
    if (originalSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = originalSecret;
  });
  await new Promise((resolve) => server.once('listening', resolve));

  const token = jwt.sign({
    purpose: 'contact-email-status',
    contactId: 'another-contact-id'
  }, secret, { expiresIn: '15m' });
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/contact/contact-test-id/email-status`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ statusToken: token })
    }
  );

  assert.equal(response.status, 403);
  assert.deepEqual(updates, []);
});
