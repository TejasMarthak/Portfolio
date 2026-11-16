import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';
import DropUpload from './DropUpload';
import ConfirmDialog from './ConfirmDialog';

const sectionDefaults = {
  pro: {
    hero: { eyebrow: '', headline: '', subheadline: '', typingWords: [], cta1: { text: '', url: '' }, cta2: { text: '', url: '' } },
    about: { title: '', eyebrow: '', bio: '', photoURL: '', photoPublicId: '', photoAlt: '', stats: [], tags: [] },
    skills: [],
    projects: [],
    hobby: { title: '', subtitle: '', photos: [], ctaText: '', ctaURL: '' },
    resume: { fileURL: '', publicId: '', updatedAt: '' },
    seo: { title: '', desc: '', ogImage: '', keywords: '' }
  },
  photo: {
    hero: { kicker: '', tagline: '', subtitle: '', bgURL: '', bgPublicId: '' },
    gallery: [],
    stories: [],
    showreel: { videoURL: '', videoPublicId: '', poster: '' },
    videos: [],
    clients: [],
    about: { openingLine: '', bio: '', photoURL: '', photoPublicId: '', photoAlt: '', gear: [], availability: '' },
    seo: { title: '', desc: '', ogImage: '', keywords: '' }
  }
};

const sectionLabels = {
  hero: 'Hero content',
  about: 'About content',
  skills: 'Skill groups',
  projects: 'Projects',
  hobby: 'Hobby content',
  resume: 'Resume',
  gallery: 'Gallery photos',
  stories: 'Stories',
  showreel: 'Showreel',
  videos: 'Video projects',
  clients: 'Clients',
  seo: 'Search and social previews'
};

const fieldLabels = {
  eyebrow: 'Eyebrow', headline: 'Headline', subheadline: 'Subheadline', typingWords: 'Rotating words',
  cta1: 'Primary button', cta2: 'Secondary button', text: 'Button text', url: 'Link URL',
  title: 'Title', desc: 'Description', bio: 'Biography', subtitle: 'Subtitle', category: 'Category',
  items: 'Items', name: 'Name', value: 'Value', label: 'Label', tags: 'Tags',
  photoURL: 'Photo', photoPublicId: 'Photo asset ID', photoAlt: 'Photo alt text', stats: 'Statistics',
  src: 'Photo', publicId: 'Asset ID', alt: 'Alt text', aspect: 'Photo shape', order: 'Display order',
  imageURL: 'Project image', imagePublicId: 'Image asset ID', liveURL: 'Project website URL',
  githubURL: 'Source-code URL', featured: 'Featured project', story: 'Story text',
  image: 'Story photo', videoURL: 'Video URL',
  videoPublicId: 'Video asset ID', thumb: 'Video thumbnail', thumbPublicId: 'Thumbnail asset ID',
  poster: 'Video poster image', logoURL: 'Logo image', logoPublicId: 'Logo asset ID',
  bgURL: 'Hero background image', bgPublicId: 'Background asset ID', kicker: 'Small heading',
  tagline: 'Main heading', openingLine: 'Opening line', availability: 'Availability text',
  gear: 'Equipment list', photos: 'Photos', ctaText: 'Button text', ctaURL: 'Button link',
  fileURL: 'Resume file URL', updatedAt: 'Last updated', maintenanceMsg: 'Maintenance message',
  ogImage: 'Social preview image', keywords: 'Search keywords',
  crossLinkToPhoto: 'Photography portfolio URL', crossLinkToPro: 'Developer portfolio URL'
};

function mergeDefaults(defaultValue, currentValue) {
  if (Array.isArray(defaultValue)) return Array.isArray(currentValue) ? currentValue : defaultValue;
  if (defaultValue && typeof defaultValue === 'object') {
    const current = currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue) ? currentValue : {};
    return Object.fromEntries(Object.keys({ ...defaultValue, ...current }).map((key) => [
      key,
      key in defaultValue ? mergeDefaults(defaultValue[key], current[key]) : current[key]
    ]));
  }
  return currentValue ?? defaultValue;
}

function humanize(value) {
  return fieldLabels[value] || value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function emptyItem(key, site) {
  if (key === 'projects') return { id: crypto.randomUUID(), title: '', desc: '', tags: [], category: '', liveURL: '', githubURL: '', imageURL: '', imagePublicId: '', featured: false };
  if (key === 'skills') return { category: '', items: [{ name: '' }] };
  if (key === 'gallery') return { id: crypto.randomUUID(), src: '', publicId: '', alt: '', category: '', title: '', aspect: 'portrait' };
  if (key === 'stories') return { id: crypto.randomUUID(), image: '', imagePublicId: '', title: '', story: '', category: '' };
  if (key === 'videos') return { id: crypto.randomUUID(), thumb: '', thumbPublicId: '', title: '', category: '', videoURL: '' };
  if (key === 'clients') return { name: '', logoURL: '', logoPublicId: '' };
  if (key === 'photos') return { src: '', publicId: '', caption: '' };
  if (key === 'stats') return { label: '', value: '' };
  if (key === 'items') return site === 'pro' ? { name: '' } : '';
  return '';
}

function uploadFolder(site, section, key) {
  if (section === 'resume') return 'documents';
  if (key.toLowerCase().includes('video') || section === 'showreel') return 'photo-videos';
  return site === 'pro' ? 'pro-portfolio' : 'photo-gallery';
}

function isMediaField(key) {
  return /(?:URL|src|image|thumb|poster)$/i.test(key) && !/githubURL|liveURL|ctaURL|crossLink/i.test(key);
}

function mediaIdField(key) {
  return {
    src: 'publicId', image: 'imagePublicId', imageURL: 'imagePublicId', photoURL: 'photoPublicId',
    bgURL: 'bgPublicId', videoURL: 'videoPublicId', thumb: 'thumbPublicId', poster: 'posterPublicId',
    logoURL: 'logoPublicId', fileURL: 'publicId'
  }[key];
}

function hasSectionContent(value) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value && typeof value === 'object' && Object.keys(value).length);
}

function ObjectFields({ value, path, site, section, onChange, onUpload }) {
  return <div className="structured-fields">
    {Object.entries(value).map(([key, fieldValue]) => {
      const fieldPath = [...path, key];
      const label = humanize(key);
      if (Array.isArray(fieldValue)) {
        return <ArrayField key={fieldPath.join('.')} value={fieldValue} path={fieldPath} site={site} section={section} onChange={onChange} onUpload={onUpload} />;
      }
      if (fieldValue && typeof fieldValue === 'object') {
        return <fieldset className="structured-group" key={fieldPath.join('.')}><legend>{label}</legend>
          <ObjectFields value={fieldValue} path={fieldPath} site={site} section={section} onChange={onChange} onUpload={onUpload} />
        </fieldset>;
      }
      const multiline = /bio|description|story|message/i.test(key);
      return <label className={`structured-field ${multiline ? 'field-wide' : ''}`} key={fieldPath.join('.')}>
        <span>{label}</span>
        {typeof fieldValue === 'boolean' ? (
          <input type="checkbox" checked={fieldValue} onChange={(event) => onChange(fieldPath, event.target.checked)} />
        ) : multiline ? (
          <textarea rows={4} value={fieldValue ?? ''} onChange={(event) => onChange(fieldPath, event.target.value)} />
        ) : (
          <input type={isMediaField(key) || /URL|url/i.test(key) ? 'url' : 'text'} value={fieldValue ?? ''} onChange={(event) => {
            onChange(fieldPath, event.target.value);
            const idField = mediaIdField(key);
            if (idField) onChange([...fieldPath.slice(0, -1), idField], '');
          }} placeholder={/URL|url/i.test(key) ? 'https://' : ''} />
        )}
        {isMediaField(key) && (
          <div className="field-upload">
            {fieldValue && /(?:src|image|thumb|poster|photoURL|bgURL|ogImage|logoURL)$/i.test(key) && (
              <img className="media-field-preview" src={fieldValue} alt={`${label} preview`} />
            )}
            {fieldValue && /videoURL/i.test(key) && (
              <video className="media-field-preview" src={fieldValue} controls preload="metadata" />
            )}
            {fieldValue && (
              <button type="button" className="button button-muted media-clear-button" onClick={() => {
                onChange(fieldPath, '');
                const idField = mediaIdField(key);
                if (idField) onChange([...fieldPath.slice(0, -1), idField], '');
              }}><Trash2 size={13} />Remove from section</button>
            )}
            <DropUpload folder={uploadFolder(site, section, key)} acceptVideo={/video/i.test(key) || section === 'showreel'} onUploaded={(media) => onUpload(fieldPath, key, media)} />
          </div>
        )}
      </label>;
    })}
  </div>;
}

function ArrayField({ value, path, fieldKey, site, section, onChange, onUpload }) {
  const key = fieldKey || path[path.length - 1];
  return <section className="array-field">
    <div className="array-field-heading"><h3>{humanize(key)}</h3><button type="button" className="button button-muted" onClick={() => onChange(path, [...value, emptyItem(key, site)])}><Plus size={14} />Add {humanize(key).replace(/s$/, '')}</button></div>
    {!value.length && <p className="array-empty">Nothing added yet.</p>}
    {value.map((item, index) => {
      const itemPath = [...path, index];
      return <article className="array-item" key={item?.id || item?.publicId || `${path.join('.')}-${index}`}>
        <div className="array-item-heading">
          <strong>{humanize(key).replace(/s$/, '')} {index + 1}</strong>
          <div className="array-item-actions">
            <button type="button" className="icon-button" aria-label={`Move ${humanize(key)} ${index + 1} up`} disabled={index === 0} onClick={() => {
              const next = [...value];
              [next[index - 1], next[index]] = [next[index], next[index - 1]];
              onChange(path, next);
            }}><ArrowUp size={15} /></button>
            <button type="button" className="icon-button" aria-label={`Move ${humanize(key)} ${index + 1} down`} disabled={index === value.length - 1} onClick={() => {
              const next = [...value];
              [next[index + 1], next[index]] = [next[index], next[index + 1]];
              onChange(path, next);
            }}><ArrowDown size={15} /></button>
            <button type="button" className="icon-button danger-icon" aria-label={`Remove ${humanize(key)} ${index + 1}`} onClick={() => onChange(path, value.filter((_entry, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button>
          </div>
        </div>
        {item && typeof item === 'object' && !Array.isArray(item) ? (
          <ObjectFields value={item} path={itemPath} site={site} section={section} onChange={onChange} onUpload={onUpload} />
        ) : (
          <label className="structured-field"><span>{humanize(key).replace(/s$/, '')}</span><input value={item ?? ''} onChange={(event) => onChange(itemPath, event.target.value)} /></label>
        )}
      </article>;
    })}
  </section>;
}

export default function ContentEditor({ site, section, title }) {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery({
    queryKey: [site],
    queryFn: () => api.get(`/api/${site}/content`),
    staleTime: 300000
  });
  const currentValue = data?.data?.content?.[section];
  const [draft, setDraft] = useState(sectionDefaults[site][section]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sectionExists = hasSectionContent(currentValue);

  useEffect(() => {
    if (currentValue !== undefined) setDraft(mergeDefaults(sectionDefaults[site][section], currentValue));
  }, [currentValue, section, site]);

  const isDirty = !sectionExists || JSON.stringify(draft) !== JSON.stringify(mergeDefaults(sectionDefaults[site][section], currentValue));
  const save = useMutation({
    mutationFn: (body) => api.patch(`/api/${site}/${section}`, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [site] });
      toast.success(`${title} saved.`);
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Changes could not be saved.')
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/${site}/${section}`),
    onSuccess: async () => {
      setConfirmDelete(false);
      setDraft(sectionDefaults[site][section]);
      await queryClient.invalidateQueries({ queryKey: [site] });
      toast.success(`${title} content deleted.`);
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Section content could not be deleted.')
  });

  function updatePath(path, value) {
    setDraft((current) => {
      if (!path.length) return value;
      const next = structuredClone(current);
      let target = next;
      for (const segment of path.slice(0, -1)) target = target[segment];
      target[path[path.length - 1]] = value;
      return next;
    });
  }

  function applyUpload(path, key, media) {
    updatePath(path, media.url);
    const publicIdField = mediaIdField(key);
    if (publicIdField) updatePath([...path.slice(0, -1), publicIdField], media.publicId);
    toast.success('Uploaded media added to this field.');
  }

  if (isPending) return <div className="page-loading">Loading {title.toLowerCase()}…</div>;
  if (isError) return <div className="page-error">Content could not be loaded. Check the API connection.</div>;

  return (
    <div className="editor-page">
      <div className="page-heading"><div><p className="eyebrow">{site === 'pro' ? 'Developer portfolio' : 'Photography portfolio'}</p><h1>{title}</h1></div><span className="save-state">{isDirty ? 'Unsaved changes' : 'All changes saved'}</span></div>
      <section className="panel editor-panel">
        <div className="panel-title">
          <div><h2>{sectionLabels[section] || 'Section content'}</h2><p>{sectionExists ? 'Read and edit this section. Add or remove repeatable items, then save your changes.' : 'This section has no content yet. Create it by adding content and saving.'}</p></div>
          {sectionExists && <button type="button" className="button button-danger" onClick={() => setConfirmDelete(true)} disabled={remove.isPending}><Trash2 size={14} />Delete section</button>}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); save.mutate(draft); }}>
          {Array.isArray(draft) ? (
            <ArrayField value={draft} path={[]} fieldKey={section} site={site} section={section} onChange={updatePath} onUpload={applyUpload} />
          ) : (
            <ObjectFields value={draft} path={[]} site={site} section={section} onChange={updatePath} onUpload={applyUpload} />
          )}
          <div className="editor-actions"><button type="submit" className="button button-primary" disabled={save.isPending || remove.isPending || !isDirty}><Save size={16} />{save.isPending ? 'Saving…' : sectionExists ? 'Save changes' : 'Create section'}</button><span>Changes publish when saved.</span></div>
        </form>
      </section>
      {confirmDelete && <ConfirmDialog title={`Delete ${title} content?`} message="This clears the saved content for this section on the live portfolio. You can create it again later." onCancel={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} busy={remove.isPending} />}
    </div>
  );
}
