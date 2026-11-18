import { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../api';
import { sendFormSubmit } from '../../../shared/formSubmit.js';

export default function ContactForm() {
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setBusy(true);
    try {
      const { data } = await api.post('/api/contact', { ...values, source: 'pro' });
      form.reset();
      if (!data.emailDelivery) {
        console.error('[contact] email notification unavailable: email delivery configuration missing');
        toast.error('Your inquiry is saved, but its email notification is not configured.');
        return;
      }

      try {
        await sendFormSubmit(data.emailDelivery.recipient, data.emailDelivery.fields);
      } catch (error) {
        console.error('[contact] email notification not sent:', error.code || error.name);
        if (error.code === 'FORMSUBMIT_TIMEOUT') {
          toast('Your inquiry is saved. Email delivery is taking longer than expected and may still arrive; check your inbox before retrying.');
          return;
        }
        toast.error('Your inquiry is saved, but its email notification could not be sent.');
        return;
      }

      try {
        await api.post(`/api/contact/${encodeURIComponent(data.contactId)}/email-status`, {
          statusToken: data.emailDelivery.statusToken
        });
      } catch (error) {
        console.error('[contact] email notification status not saved:', error.response?.status || error.code || error.name);
      }
      toast.success('Message received.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not confirm submission. Your inquiry may already be received; wait before trying again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.form className="contact-form" onSubmit={submit} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <label>Name<input name="name" autoComplete="name" required maxLength="120" /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required maxLength="254" /></label>
      <label>Phone <span>(optional)</span><input name="phone" type="tel" autoComplete="tel" maxLength="40" /></label>
      <label>Subject<input name="subject" required maxLength="180" /></label>
      <label className="field-wide">Message<textarea name="message" rows="4" required maxLength="5000" /></label>
      <button className="button button-primary field-wide" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send message'} <span aria-hidden="true">↗</span></button>
    </motion.form>
  );
}
