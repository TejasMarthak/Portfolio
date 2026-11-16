import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';
import WhatsAppConnection from '../components/WhatsAppConnection';

const defaults = {
  social: {},
  contact: { email: '', location: '' },
  proSite: { live: true, maintenanceMsg: '', crossLinkToPhoto: '' },
  photoSite: { live: true, maintenanceMsg: '', crossLinkToPro: '' },
  analytics: { googleAnalyticsId: '', googleTagManagerId: '' }
};

function settingsDraft(settings = {}) {
  return Object.fromEntries(Object.entries(defaults).map(([key, defaultValue]) => [
    key,
    { ...defaultValue, ...(settings[key] || {}) }
  ]));
}

function TextField({ label, value, onChange, type = 'text', multiline = false, placeholder = '' }) {
  return <label className="structured-field"><span>{label}</span>{multiline
    ? <textarea rows={3} value={value ?? ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    : <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}</label>;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/api/settings') });
  const [draft, setDraft] = useState(defaults);
  const settings = query.data?.data?.settings;

  useEffect(() => {
    if (settings) setDraft(settingsDraft(settings));
  }, [settings]);

  const isDirty = Boolean(settings) && JSON.stringify(draft) !== JSON.stringify(settingsDraft(settings));
  const save = useMutation({
    mutationFn: (value) => api.patch('/api/settings', value),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings saved.');
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Settings could not be saved.')
  });

  function update(group, key, value) {
    setDraft((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
  }

  function submit(event) {
    event.preventDefault();
    save.mutate(draft);
  }

  return (
    <div className="settings-page">
      <div className="page-heading"><div><p className="eyebrow">General</p><h1>Site settings</h1></div><span className="save-state">{isDirty ? 'Unsaved changes' : 'All changes saved'}</span></div>
      <div className="settings-callout"><strong>Site-wide details</strong><span>Add social profile links, contact information, cross-links, and availability here. Private keys belong in the API environment, never in the CMS.</span></div>
      <WhatsAppConnection />
      {query.isPending ? <div className="page-loading">Loading settings…</div> : query.isError ? <p className="page-error">Settings could not be loaded.</p> : (
        <form onSubmit={submit} className="settings-form">
          <section className="panel editor-panel settings-section">
            <div className="panel-title"><div><h2>Social profiles</h2><p>These links appear in the footer of both portfolios.</p></div></div>
            <div className="settings-fields">
              {Object.entries(draft.social).map(([name, url], index) => (
                <div className="social-link-row" key={index}>
                  <TextField label="Profile name" value={name} onChange={(nextName) => {
                    if (!nextName.trim() || nextName === name) return;
                    const social = { ...draft.social };
                    if (nextName in social) {
                      toast.error('A social profile with that name already exists.');
                      return;
                    }
                    delete social[name];
                    social[nextName] = url;
                    setDraft((current) => ({ ...current, social }));
                  }} placeholder="Instagram" />
                  <TextField label="Profile URL" value={url} type="url" onChange={(nextUrl) => update('social', name, nextUrl)} placeholder="https://" />
                  <button type="button" className="icon-button danger-icon" aria-label={`Remove ${name} social link`} onClick={() => {
                    const social = { ...draft.social };
                    delete social[name];
                    setDraft((current) => ({ ...current, social }));
                  }}><Trash2 size={15} /></button>
                </div>
              ))}
              <button type="button" className="button button-muted" onClick={() => {
                const social = { ...draft.social };
                let name = 'New profile';
                let index = 2;
                while (name in social) name = `New profile ${index++}`;
                social[name] = '';
                setDraft((current) => ({ ...current, social }));
              }}><Plus size={14} />Add social profile</button>
            </div>
          </section>

          <section className="panel editor-panel settings-section">
            <div className="panel-title"><div><h2>Contact information</h2><p>Shown in the contact area of each site.</p></div><button type="button" className="button button-muted" onClick={() => setDraft((current) => ({ ...current, contact: { ...defaults.contact } }))}><Trash2 size={13} />Clear details</button></div>
            <div className="settings-fields settings-grid">
              <TextField label="Contact email" value={draft.contact.email} type="email" onChange={(value) => update('contact', 'email', value)} placeholder="you@example.com" />
              <TextField label="Location" value={draft.contact.location} onChange={(value) => update('contact', 'location', value)} placeholder="City, Country" />
            </div>
          </section>

          <section className="panel editor-panel settings-section">
            <div className="panel-title"><div><h2>Developer portfolio</h2><p>Control availability and set the link to your photography portfolio.</p></div><button type="button" className="button button-muted" onClick={() => setDraft((current) => ({ ...current, proSite: { ...defaults.proSite } }))}><Trash2 size={13} />Reset</button></div>
            <div className="settings-fields settings-grid">
              <label className="structured-field settings-toggle"><span>Site is live</span><input type="checkbox" checked={draft.proSite.live !== false} onChange={(event) => update('proSite', 'live', event.target.checked)} /></label>
              <TextField label="Photography portfolio URL" value={draft.proSite.crossLinkToPhoto} type="url" onChange={(value) => update('proSite', 'crossLinkToPhoto', value)} placeholder="https://" />
              <TextField label="Maintenance message" value={draft.proSite.maintenanceMsg} onChange={(value) => update('proSite', 'maintenanceMsg', value)} multiline />
            </div>
          </section>

          <section className="panel editor-panel settings-section">
            <div className="panel-title"><div><h2>Photography portfolio</h2><p>Control availability and set the link back to your developer portfolio.</p></div><button type="button" className="button button-muted" onClick={() => setDraft((current) => ({ ...current, photoSite: { ...defaults.photoSite } }))}><Trash2 size={13} />Reset</button></div>
            <div className="settings-fields settings-grid">
              <label className="structured-field settings-toggle"><span>Site is live</span><input type="checkbox" checked={draft.photoSite.live !== false} onChange={(event) => update('photoSite', 'live', event.target.checked)} /></label>
              <TextField label="Developer portfolio URL" value={draft.photoSite.crossLinkToPro} type="url" onChange={(value) => update('photoSite', 'crossLinkToPro', value)} placeholder="https://" />
              <TextField label="Maintenance message" value={draft.photoSite.maintenanceMsg} onChange={(value) => update('photoSite', 'maintenanceMsg', value)} multiline />
            </div>
          </section>

          <section className="panel editor-panel settings-section">
            <div className="panel-title"><div><h2>Analytics IDs</h2><p>Optional public tracking identifiers. Never enter private keys or secrets here.</p></div><button type="button" className="button button-muted" onClick={() => setDraft((current) => ({ ...current, analytics: { ...defaults.analytics } }))}><Trash2 size={13} />Clear IDs</button></div>
            <div className="settings-fields settings-grid">
              <TextField label="Google Analytics measurement ID" value={draft.analytics.googleAnalyticsId} onChange={(value) => update('analytics', 'googleAnalyticsId', value)} placeholder="G-XXXXXXXXXX" />
              <TextField label="Google Tag Manager ID" value={draft.analytics.googleTagManagerId} onChange={(value) => update('analytics', 'googleTagManagerId', value)} placeholder="GTM-XXXXXXX" />
            </div>
          </section>

          <div className="editor-actions settings-save"><button type="submit" className="button button-primary" disabled={save.isPending || !isDirty}><Save size={16} />{save.isPending ? 'Saving…' : 'Save settings'}</button><span>Changes publish immediately.</span></div>
        </form>
      )}
    </div>
  );
}
