import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';
import WhatsAppConnection from '../components/WhatsAppConnection';
import ConfirmDialog from '../components/ConfirmDialog';

const sectionOptions = {
  pro: [
    { id: 'about', label: 'About' },
    { id: 'skills', label: 'Skills' },
    { id: 'projects', label: 'Projects' },
    { id: 'hobby', label: 'Hobby' },
    { id: 'contact', label: 'Contact' }
  ],
  photo: [
    { id: 'gallery', label: 'Gallery' },
    { id: 'stories', label: 'Stories' },
    { id: 'reels', label: 'Reels' },
    { id: 'videos', label: 'Videos' },
    { id: 'clients', label: 'Clients' },
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact' }
  ]
};
const defaultSections = Object.fromEntries(Object.entries(sectionOptions).map(([site, sections]) => [
  site,
  Object.fromEntries(sections.map(({ id }) => [id, true]))
]));

const defaults = {
  social: {},
  sections: defaultSections,
  contact: { email: '', phone: '', whatsapp: '', location: '' },
  proSite: { live: true, maintenanceMsg: '', crossLinkToPhoto: '' },
  photoSite: { live: true, maintenanceMsg: '', crossLinkToPro: '' },
  analytics: { googleAnalyticsId: '', googleTagManagerId: '' }
};

const handleUrlBuilders = {
  instagram: (handle) => `https://www.instagram.com/${handle}`,
  facebook: (handle) => `https://www.facebook.com/${handle}`,
  x: (handle) => `https://x.com/${handle}`,
  twitter: (handle) => `https://x.com/${handle}`,
  github: (handle) => `https://github.com/${handle}`,
  linkedin: (handle) => `https://www.linkedin.com/in/${handle}`,
  youtube: (handle) => `https://www.youtube.com/@${handle}`,
  tiktok: (handle) => `https://www.tiktok.com/@${handle}`,
  threads: (handle) => `https://www.threads.net/@${handle}`,
  pinterest: (handle) => `https://www.pinterest.com/${handle}`,
  twitch: (handle) => `https://www.twitch.tv/${handle}`,
  behance: (handle) => `https://www.behance.net/${handle}`,
  dribbble: (handle) => `https://dribbble.com/${handle}`,
  medium: (handle) => `https://medium.com/@${handle}`
};

function normalizeProfileUrl(platform, value) {
  const input = String(value || '').trim();
  if (!input) return '';
  try {
    const url = new URL(input);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    const builder = handleUrlBuilders[platform.trim().toLowerCase()];
    const handle = input.replace(/^@/, '').replace(/^\/+|\/+$/g, '');
    return builder && handle && !/\s/.test(handle) ? builder(encodeURIComponent(handle)) : '';
  }
}

function normalizeSocial(social = {}) {
  return Object.fromEntries(Object.entries(social).map(([name, value]) => [
    name,
    typeof value === 'string'
      ? { url: value, enabled: true }
      : { url: value?.url || '', enabled: value?.enabled !== false }
  ]));
}

function settingsDraft(settings = {}) {
  return Object.fromEntries(Object.entries(defaults).map(([key, defaultValue]) => [
    key,
    key === 'social'
      ? normalizeSocial(settings.social)
      : key === 'sections'
        ? Object.fromEntries(Object.entries(defaultValue).map(([site, siteDefaults]) => [
          site,
          { ...siteDefaults, ...(settings.sections?.[site] || {}) }
        ]))
      : { ...defaultValue, ...(settings[key] || {}) }
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
  const [confirmAction, setConfirmAction] = useState(null);
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

  function updateSocial(name, field, value) {
    setDraft((current) => ({
      ...current,
      social: {
        ...current.social,
        [name]: { ...current.social[name], [field]: value }
      }
    }));
  }

  function updateSectionVisibility(site, section, visible) {
    setDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [site]: { ...current.sections[site], [section]: visible }
      }
    }));
  }

  function submit(event) {
    event.preventDefault();
    const social = {};
    for (const [name, profile] of Object.entries(draft.social)) {
      const url = normalizeProfileUrl(name, profile.url || '');
      if (profile.url && !url) {
        toast.error(`Enter a valid URL or a supported ${name} handle.`);
        return;
      }
      social[name] = { ...profile, url };
    }
    save.mutate({ ...draft, social });
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
              {Object.entries(draft.social).map(([name, profile], index) => (
                <div className="social-link-row" key={index}>
                  <TextField label="Profile name" value={name} onChange={(nextName) => {
                    if (!nextName.trim() || nextName === name) return;
                    const social = { ...draft.social };
                    if (nextName in social) {
                      toast.error('A social profile with that name already exists.');
                      return;
                    }
                    delete social[name];
                    social[nextName] = profile;
                    setDraft((current) => ({ ...current, social }));
                  }} placeholder="Instagram" />
                  <TextField label="Profile URL or handle" value={profile.url} onChange={(url) => updateSocial(name, 'url', url)} placeholder="https://… or @handle" />
                  <label className="social-enabled-toggle"><input type="checkbox" checked={profile.enabled} onChange={(event) => updateSocial(name, 'enabled', event.target.checked)} /><span>Show on sites</span></label>
                  <button type="button" className="icon-button danger-icon" aria-label={`Remove ${name} social link`} onClick={() => setConfirmAction({
                    title: `Remove ${name}?`,
                    message: 'This permanently removes the social profile from CMS settings and both portfolios after you save.',
                    action: () => {
                      const social = { ...draft.social };
                      delete social[name];
                      setDraft((current) => ({ ...current, social }));
                    }
                  })}><Trash2 size={15} /></button>
                </div>
              ))}
              <button type="button" className="button button-muted" onClick={() => {
                const social = { ...draft.social };
                let name = 'New profile';
                let index = 2;
                while (name in social) name = `New profile ${index++}`;
                social[name] = { url: '', enabled: true };
                setDraft((current) => ({ ...current, social }));
              }}><Plus size={14} />Add social profile</button>
              <p className="social-help">Add any network by name. Handles are supported for Instagram, Facebook, X/Twitter, GitHub, LinkedIn, YouTube, TikTok, Threads, Pinterest, Twitch, Behance, Dribbble, and Medium; other networks need a full URL.</p>
            </div>
          </section>

          <section className="panel editor-panel settings-section">
            <div className="panel-title"><div><h2>Portfolio sections</h2><p>Sections appear only when they have CMS content and are enabled here. Hiding a section keeps its saved content.</p></div></div>
            <div className="portfolio-section-settings">
              {Object.entries(sectionOptions).map(([site, sections]) => (
                <fieldset className="settings-section-group" key={site}>
                  <legend>{site === 'pro' ? 'Developer portfolio' : 'Photography portfolio'}</legend>
                  <div className="settings-fields settings-grid">
                    {sections.map(({ id, label }) => (
                      <label className="structured-field settings-toggle" key={id}>
                        <span>Show {label}</span>
                        <input
                          type="checkbox"
                          checked={draft.sections[site][id] !== false}
                          onChange={(event) => updateSectionVisibility(site, id, event.target.checked)}
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </section>

          <section className="panel editor-panel settings-section">
            <div className="panel-title"><div><h2>Contact information</h2><p>Shown in the contact area of each site.</p></div><button type="button" className="button button-muted" onClick={() => setConfirmAction({ title: 'Clear contact details?', message: 'This removes the public contact information from both portfolios after you save.', action: () => setDraft((current) => ({ ...current, contact: { ...defaults.contact } })) })}><Trash2 size={13} />Clear details</button></div>
            <div className="settings-fields settings-grid">
              <TextField label="Contact email" value={draft.contact.email} type="email" onChange={(value) => update('contact', 'email', value)} placeholder="you@example.com" />
              <TextField label="Public phone number" value={draft.contact.phone} type="tel" onChange={(value) => update('contact', 'phone', value)} placeholder="+91 98765 43210" />
              <TextField label="Public WhatsApp number" value={draft.contact.whatsapp} type="tel" onChange={(value) => update('contact', 'whatsapp', value)} placeholder="+91 98765 43210" />
              <TextField label="Location" value={draft.contact.location} onChange={(value) => update('contact', 'location', value)} placeholder="City, Country" />
            </div>
            <p className="social-help">Only details entered here are shown publicly on both portfolios. The WhatsApp contact link is separate from the private CMS notification connection.</p>
          </section>

          <section className="panel editor-panel settings-section">
            <div className="panel-title"><div><h2>Developer portfolio</h2><p>Control availability and set the link to your photography portfolio.</p></div><button type="button" className="button button-muted" onClick={() => setConfirmAction({ title: 'Reset developer portfolio settings?', message: 'This clears the saved cross-link and maintenance message and restores the default live setting after you save.', action: () => setDraft((current) => ({ ...current, proSite: { ...defaults.proSite } })) })}><Trash2 size={13} />Reset</button></div>
            <div className="settings-fields settings-grid">
              <label className="structured-field settings-toggle"><span>Site is live</span><input type="checkbox" checked={draft.proSite.live !== false} onChange={(event) => update('proSite', 'live', event.target.checked)} /></label>
              <TextField label="Photography portfolio URL" value={draft.proSite.crossLinkToPhoto} type="url" onChange={(value) => update('proSite', 'crossLinkToPhoto', value)} placeholder="https://" />
              <TextField label="Maintenance message" value={draft.proSite.maintenanceMsg} onChange={(value) => update('proSite', 'maintenanceMsg', value)} multiline />
            </div>
          </section>

          <section className="panel editor-panel settings-section">
            <div className="panel-title"><div><h2>Photography portfolio</h2><p>Control availability and set the link back to your developer portfolio.</p></div><button type="button" className="button button-muted" onClick={() => setConfirmAction({ title: 'Reset photography portfolio settings?', message: 'This clears the saved cross-link and maintenance message and restores the default live setting after you save.', action: () => setDraft((current) => ({ ...current, photoSite: { ...defaults.photoSite } })) })}><Trash2 size={13} />Reset</button></div>
            <div className="settings-fields settings-grid">
              <label className="structured-field settings-toggle"><span>Site is live</span><input type="checkbox" checked={draft.photoSite.live !== false} onChange={(event) => update('photoSite', 'live', event.target.checked)} /></label>
              <TextField label="Developer portfolio URL" value={draft.photoSite.crossLinkToPro} type="url" onChange={(value) => update('photoSite', 'crossLinkToPro', value)} placeholder="https://" />
              <TextField label="Maintenance message" value={draft.photoSite.maintenanceMsg} onChange={(value) => update('photoSite', 'maintenanceMsg', value)} multiline />
            </div>
          </section>

          <section className="panel editor-panel settings-section">
            <div className="panel-title"><div><h2>Analytics IDs</h2><p>Optional public tracking identifiers. Never enter private keys or secrets here.</p></div><button type="button" className="button button-muted" onClick={() => setConfirmAction({ title: 'Clear analytics IDs?', message: 'This removes the configured analytics IDs from both portfolios after you save.', action: () => setDraft((current) => ({ ...current, analytics: { ...defaults.analytics } })) })}><Trash2 size={13} />Clear IDs</button></div>
            <div className="settings-fields settings-grid">
              <TextField label="Google Analytics measurement ID" value={draft.analytics.googleAnalyticsId} onChange={(value) => update('analytics', 'googleAnalyticsId', value)} placeholder="G-XXXXXXXXXX" />
              <TextField label="Google Tag Manager ID" value={draft.analytics.googleTagManagerId} onChange={(value) => update('analytics', 'googleTagManagerId', value)} placeholder="GTM-XXXXXXX" />
            </div>
          </section>

          <div className="editor-actions settings-save"><button type="submit" className="button button-primary" disabled={save.isPending || !isDirty}><Save size={16} />{save.isPending ? 'Saving…' : 'Save settings'}</button><span>Changes publish immediately.</span></div>
        </form>
      )}
      {confirmAction && <ConfirmDialog
        title={confirmAction.title}
        message={confirmAction.message}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => { confirmAction.action(); setConfirmAction(null); }}
      />}
    </div>
  );
}
