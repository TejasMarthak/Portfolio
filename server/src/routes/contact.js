const express = require('express');
const { body, validationResult } = require('express-validator');
const Contact = require('../models/Contact');
const { verifyAccess, verifyCsrf } = require('../middleware/auth');
const { rateLimits } = require('../middleware/rateLimits');
const { sendWhatsAppMessage } = require('../services/whatsapp');
const { sendContactEmail } = require('../services/email');
const router = express.Router();

const validators = [
  body('source').isIn(['pro', 'photo']),
  body('name').trim().isLength({ min: 1, max: 120 }).escape(),
  body('email').trim().isEmail().isLength({ max: 254 }).normalizeEmail(),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 40 }).escape(),
  body('subject').trim().isLength({ min: 1, max: 180 }).escape(),
  body('projectType').optional({ values: 'falsy' }).trim().isLength({ max: 100 }).escape(),
  body('message').trim().isLength({ min: 1, max: 5000 }).escape()
];

router.post('/', rateLimits.contact, validators, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Please check the submitted contact details' });
    const contact = await Contact.create({
      source: req.body.source,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone || '',
      subject: req.body.subject,
      projectType: req.body.projectType || '',
      message: req.body.message
    });
    const notifications = await Promise.allSettled([
      sendWhatsAppMessage(process.env.YOUR_WHATSAPP_JID, `${contact.source} contact from ${contact.name} (${contact.email}): ${contact.subject}`),
      sendContactEmail(contact.toObject())
    ]);
    contact.whatsappSent = notifications[0].status === 'fulfilled' && notifications[0].value.sent;
    contact.emailSent = notifications[1].status === 'fulfilled' && notifications[1].value.sent;
    await contact.save();
    return res.status(200).json({ ok: true, message: 'Your message has been received' });
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
      Contact.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Contact.countDocuments(filter)
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
    const contact = await Contact.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    return res.json({ contact });
  } catch (error) {
    return next(error);
  }
});
router.delete('/:id', verifyAccess, verifyCsrf, rateLimits.adminWrite, async (req, res, next) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
