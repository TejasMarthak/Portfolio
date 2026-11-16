import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ExternalLink, GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../api';
import DropUpload from './DropUpload';
import ConfirmDialog from './ConfirmDialog';

const editorSchema = z.object({
  payload: z.string().min(2, 'Enter a JSON object or array').superRefine((value, context) => {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object') context.addIssue({ code: z.ZodIssueCode.custom, message: 'Content must be an object or array' });
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter valid JSON' });
    }
  })
});

function SortableRow({ id, index, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="sort-row">
      <button type="button" className="sort-handle" aria-label={`Reorder item ${index + 1}`} {...attributes} {...listeners}><GripVertical size={17} /></button>
      <span>{index + 1}</span><code>{id.replace(/::\d+$/, '')}</code>
      <button type="button" className="icon-button danger-icon" aria-label={`Remove item ${index + 1}`} onClick={() => onRemove(index)}><Trash2 size={14} /></button>
    </div>
  );
}

export default function ContentEditor({ site, section, title }) {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery({
    queryKey: [site],
    queryFn: () => api.get(`/api/${site}/content`),
    staleTime: 300000
  });
  const content = data?.data?.content;
  const currentValue = content?.[section];
  const formatted = useMemo(() => JSON.stringify(currentValue ?? (Array.isArray(currentValue) ? [] : {}), null, 2), [currentValue]);
  const [sortableItems, setSortableItems] = useState([]);
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(editorSchema),
    defaultValues: { payload: formatted }
  });
  const payload = watch('payload');
  const [confirmIndex, setConfirmIndex] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    reset({ payload: formatted });
    let parsed;
    try { parsed = JSON.parse(formatted); } catch { parsed = null; }
    setSortableItems(Array.isArray(parsed) ? parsed.map((item, index) => `${String(item.id || item.publicId || item.title || item.category || `item-${index + 1}`)}::${index}`) : []);
  }, [formatted, reset]);

  const save = useMutation({
    mutationFn: (body) => api.patch(`/api/${site}/${section}`, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [site] });
      toast.success(`${title} saved.`);
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Changes could not be saved.')
  });

  function reorder(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    try {
      const parsed = JSON.parse(payload);
      if (!Array.isArray(parsed)) return;
      const from = sortableItems.indexOf(String(active.id));
      const to = sortableItems.indexOf(String(over.id));
      if (from < 0 || to < 0) return;
      const nextItems = arrayMove(parsed, from, to);
      setSortableItems(nextItems.map((item, index) => `${String(item.id || item.publicId || item.title || item.category || `item-${index + 1}`)}::${index}`));
      setValue('payload', JSON.stringify(nextItems, null, 2), { shouldDirty: true });
    } catch {
      toast.error('Fix the JSON before reordering items.');
    }
  }

  function addItem() {
    try {
      const parsed = JSON.parse(payload);
      if (!Array.isArray(parsed)) return;
      const next = [...parsed, itemTemplate(site, section, parsed.length)];
      setValue('payload', JSON.stringify(next, null, 2), { shouldDirty: true });
      setSortableItems(next.map((item, index) => `${String(item.id || item.publicId || item.title || item.category || `item-${index + 1}`)}::${index}`));
    } catch {
      toast.error('Fix the JSON before adding an item.');
    }
  }

  function removeItem(index) {
    try {
      const parsed = JSON.parse(payload);
      if (!Array.isArray(parsed)) return;
      const next = parsed.filter((_item, itemIndex) => itemIndex !== index);
      setValue('payload', JSON.stringify(next, null, 2), { shouldDirty: true });
      setSortableItems(next.map((item, itemIndex) => `${String(item.id || item.publicId || item.title || item.category || `item-${itemIndex + 1}`)}::${itemIndex}`));
      setConfirmIndex(null);
    } catch {
      toast.error('Fix the JSON before removing an item.');
    }
  }

  function clearSection() {
    setValue('payload', JSON.stringify(Array.isArray(currentValue) ? [] : {}, null, 2), { shouldDirty: true });
    setSortableItems([]);
    setConfirmClear(false);
  }

  function applyUpload(media) {
    try {
      const parsed = JSON.parse(payload || '{}');
      let value;
      if (section === 'resume') {
        value = { ...parsed, fileURL: media.url, publicId: media.publicId, updatedAt: new Date().toISOString() };
      } else if (section === 'showreel') {
        value = { ...parsed, videoURL: media.url, videoPublicId: media.publicId };
      } else if (section === 'about') {
        value = { ...parsed, photoURL: media.url, photoPublicId: media.publicId };
      } else if (site === 'photo' && section === 'hero') {
        value = { ...parsed, bgURL: media.url, bgPublicId: media.publicId };
      } else if (section === 'hobby') {
        const photos = Array.isArray(parsed.photos) ? parsed.photos : [];
        value = { ...parsed, photos: [...photos, { src: media.url, publicId: media.publicId, caption: '' }] };
      } else if (Array.isArray(parsed)) {
        value = [...parsed, { src: media.url, publicId: media.publicId, resourceType: media.resourceType }];
      } else {
        value = { ...parsed, assetURL: media.url, publicId: media.publicId, resourceType: media.resourceType };
      }
      setValue('payload', JSON.stringify(value, null, 2), { shouldDirty: true });
      toast('Uploaded asset details added to the editor.');
    } catch {
      toast.error('Fix the JSON before attaching an uploaded asset.');
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  if (isPending) return <div className="page-loading">Loading {title.toLowerCase()}…</div>;
  if (isError) return <div className="page-error">Content could not be loaded. Check the API connection.</div>;

  return (
    <div className="editor-page">
      <div className="page-heading"><div><p className="eyebrow">{site === 'pro' ? 'Developer portfolio' : 'Photography portfolio'}</p><h1>{title}</h1></div><span className="save-state">{isDirty ? 'Unsaved changes' : 'All changes saved'}</span></div>
      <section className="panel editor-panel">
        <div className="panel-title"><div><h2>Section content</h2><p>Update this API-managed section. String values appear directly on the live site.</p></div></div>
        {Array.isArray(currentValue) && (
          <div className="sort-box">
            <div className="sort-box-heading"><h3>Items · drag to reorder</h3><div><button type="button" className="button button-muted" onClick={addItem}><Plus size={14} />Add item</button><button type="button" className="button button-danger" onClick={() => setConfirmClear(true)}>Clear all</button></div></div>
            {sortableItems.length > 0 ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}>
              <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                {sortableItems.map((item, index) => <SortableRow key={item} id={item} index={index} onRemove={setConfirmIndex} />)}
              </SortableContext>
            </DndContext> : <p className="sort-empty">No items yet.</p>}
          </div>
        )}
        <form onSubmit={handleSubmit(({ payload: value }) => save.mutate(JSON.parse(value)))}>
          <label className="field-label" htmlFor="content-payload">JSON editor</label>
          <textarea id="content-payload" className={`code-editor ${errors.payload ? 'has-error' : ''}`} spellCheck="false" {...register('payload')} />
          {errors.payload && <p className="field-error">{errors.payload.message}</p>}
          <div className="editor-actions"><button type="submit" className="button button-primary" disabled={save.isPending}><Save size={16} />{save.isPending ? 'Saving…' : 'Save changes'}</button><span>Changes publish immediately.</span></div>
        </form>
        <div className="upload-append"><DropUpload folder={section === 'resume' ? 'documents' : section === 'videos' || section === 'showreel' ? 'photo-videos' : site === 'pro' ? 'pro-portfolio' : 'photo-gallery'} acceptVideo={section === 'showreel' || section === 'videos'} onUploaded={applyUpload} /></div>
      </section>
      {section === 'resume' && currentValue?.fileURL && <section className="panel resume-preview"><a href={currentValue.fileURL} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open current resume</a></section>}
      <section className="panel payload-preview">
        <div className="panel-title"><div><h2>Preview data</h2><p>Values are stored in the shared content document.</p></div></div>
        <pre>{payload || '{}'}</pre>
      </section>
      {confirmIndex != null && <ConfirmDialog title="Remove this item?" message="The item will be removed from this draft. Save the section to publish the change." onCancel={() => setConfirmIndex(null)} onConfirm={() => removeItem(confirmIndex)} />}
      {confirmClear && <ConfirmDialog title="Clear this section?" message="This removes every item from the draft. Save the section to publish the change." onCancel={() => setConfirmClear(false)} onConfirm={clearSection} />}
    </div>
  );
}

function itemTemplate(site, section, index) {
  const id = crypto.randomUUID();
  if (site === 'pro' && section === 'skills') return { category: '', items: [], order: index };
  if (site === 'pro' && section === 'projects') return {
    id, title: '', desc: '', tags: [], category: '', liveURL: '', githubURL: '',
    imageURL: '', imagePublicId: '', featured: false, order: index
  };
  if (site === 'photo' && section === 'gallery') return { id, src: '', publicId: '', alt: '', category: '', title: '', aspect: 'portrait', order: index };
  if (site === 'photo' && section === 'stories') return { id, image: '', imagePublicId: '', title: '', story: '', category: '' };
  if (site === 'photo' && section === 'videos') return { id, thumb: '', thumbPublicId: '', title: '', category: '', videoURL: '' };
  if (site === 'photo' && section === 'clients') return { name: '', logoURL: '', logoPublicId: '' };
  return { id };
}
