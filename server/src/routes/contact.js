const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const Contact = require('../models/Contact');
const { verifyAccess, verifyCsrf } = require('../middleware/auth');
const { rateLimits } = require('../middleware/rateLimits');
const { sendWhatsAppMessage } = require('../services/whatsapp');

const validators = [
  body('source').isIn(['pro', 'photo']),
  body('name').trim().isLength({ min: 1, max: 120 }).escape(),
  body('email').trim().isEmail().isLength({ max: 254 }).normalizeEmail(),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 40 }).escape(),
  body('subject').trim().isLength({ min: 1, max: 180 }).escape(),
  body('projectType').optional({ values: 'falsy' }).trim().isLength({ max: 100 }).escape(),
  body('message').trim().isLength({ min: 1, max: 5000 }).escape()
];

function createContactRouter(dependencies = {}) {
  const ContactModel = dependencies.Contact || Contact;
  const sendWhatsApp = dependencies.sendWhatsAppMessage || sendWhatsAppMessage;
  const router = express.Router();

  async function sendNotifications(contact) {
    const [whatsappResult] = await Promise.allSettled([
      sendWhatsApp(process.env.YOUR_WHATSAPP_JID, `${contact.source} contact from ${contact.name} (${contact.email}): ${contact.subject}`)
    ]);
    const whatsappSent = whatsappResult.status === 'fulfilled' && whatsappResult.value.sent;
    if (!whatsappSent) {
      const reason = whatsappResult.status === 'fulfilled'
        ? whatsappResult.value.error || 'WhatsApp provider returned sent=false'
        : whatsappResult.reason?.code || whatsappResult.reason?.name || 'Unexpected notification error';
      console.error('[contact] WhatsApp notification not sent:', reason);
    }
    try {
      const update = await ContactModel.updateOne(
        { _id: contact._id },
        { $set: { whatsappSent } }
      );
      if (!update.matchedCount) console.error('[contact] notification status not saved: contact not found');
    } catch (error) {
      console.error('[contact] notification status not saved:', error.code || error.name);
    }
  }

  function createEmailDelivery(contact) {
    const recipient = String(process.env.GMAIL_USER || '').trim();
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!recipient || !secret) {
      console.error('[contact] browser email delivery unavailable:', !recipient
        ? 'Missing GMAIL_USER'
        : 'Missing JWT_ACCESS_SECRET');
      return null;
    }

    return {
      recipient,
      statusToken: jwt.sign({
        purpose: 'contact-email-status',
        contactId: String(contact._id)
      }, secret, { expiresIn: '15m' }),
      fields: {
        source: contact.source,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        subject: contact.subject,
        projectType: contact.projectType,
        message: contact.message
      }
    };
  }

  router.post('/', rateLimits.contact, validators, async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Please check the submitted contact details' });
      const contact = await ContactModel.create({
        source: req.body.source,
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone || '',
        subject: req.body.subject,
        projectType: req.body.projectType || '',
        message: req.body.message
      });
      const savedContact = contact.toObject();
      sendNotifications(savedContact).catch((error) => {
        console.error('[contact] notification processing failed:', error.code || error.name);
      });
      return res.status(202).json({
        ok: true,
        message: 'Your message has been received',
        contactId: String(savedContact._id),
        emailDelivery: createEmailDelivery(savedContact)
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/:id/email-status', body('statusToken').isString().isLength({ min: 32, max: 2048 }), async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid email delivery status request' });

      let payload;
      try {
        payload = jwt.verify(req.body.statusToken, process.env.JWT_ACCESS_SECRET);
      } catch {
        return res.status(403).json({ error: 'Invalid email delivery status token' });
      }
      if (payload.purpose !== 'contact-email-status' || payload.contactId !== req.params.id) {
        return res.status(403).json({ error: 'Invalid email delivery status token' });
      }

      const update = await ContactModel.updateOne(
        { _id: req.params.id },
        { $set: { emailSent: true } }
      );
      if (!update.matchedCount) return res.status(404).json({ error: 'Contact not found' });
      return res.json({ ok: true, emailSent: true });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/', verifyAccess, async (req, res, next) => {
    try {
      const page = Math.min(100000, Math.max(1, Number(req.query.page) || 1));
      const limit = 20;
      const filter = {};
      if (['pro', 'photo'].includes(req.query.source)) filter.source = req.query.source;
      if (['new', 'read', 'replied'].includes(req.query.status)) filter.status = req.query.status;
      const [items, total] = await Promise.all([
        ContactModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        ContactModel.countDocuments(filter)
      ]);
      return res.json({ items, page, pages: Math.ceil(total / limit), total });
    } catch (error) {
      return next(error);
    }
  });
  router.patch('/:id', verifyAccess, verifyCsrf, rateLimits.adminWrite, async (req, res, next) => {
    try {
      const update = {};
      if (['new', 'read', 'replied'].includes(req.body.status)) update.status = req.body.status;
      if (typeof req.body.adminNote === 'string') update.adminNote = req.body.adminNote.slice(0, 4000);
      const contact = await ContactModel.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
      return res.json({ contact });
    } catch (error) {
      return next(error);
    }
  });
  router.delete('/:id', verifyAccess, verifyCsrf, rateLimits.adminWrite, async (req, res, next) => {
    try {
      const contact = await ContactModel.findByIdAndDelete(req.params.id);
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = createContactRouter();
module.exports.createContactRouter = createContactRouter;
