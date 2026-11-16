import { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../api';

export default function ContactForm() {
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setBusy(true);
    try {
      await api.post('/api/contact', { ...values, source: 'pro' });
      form.reset();
      toast.success('Message received.');
    } catch {
      toast.error('The message could not be sent. Please try again.');
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
