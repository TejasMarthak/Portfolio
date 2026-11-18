import { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../api';

export default function ContactForm({ projectTypes }) {
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setBusy(true);
    try {
      await api.post('/api/contact', { ...values, source: 'photo' });
      form.reset();
      toast.success('Message received.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not confirm submission. Your inquiry may already be received; wait before trying again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.form className="photo-contact-form" onSubmit={submit} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <label>Name<input name="name" autoComplete="name" required maxLength="120" /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required maxLength="254" /></label>
      <label>Phone <span>(optional)</span><input name="phone" type="tel" autoComplete="tel" maxLength="40" /></label>
      <label>Subject<input name="subject" required maxLength="180" /></label>
      <label>Project type
        <select name="projectType" defaultValue="">
          <option value="">Select a project type</option>
          {projectTypes.map((type) => <option value={type} key={type}>{type}</option>)}
        </select>
      </label>
      <label className="photo-field-wide">Message<textarea name="message" rows="4" required maxLength="5000" /></label>
      <button className="photo-button photo-button-fill photo-field-wide" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send an inquiry'} <span aria-hidden="true">↗</span></button>
    </motion.form>
  );
}
