import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

const schema = z.object({
  payload: z.string().superRefine((value, context) => {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Settings must be a JSON object' });
      }
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter valid JSON' });
    }
  })
});

export default function Settings() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/api/settings') });
  const settings = query.data?.data?.settings;
  const formatted = JSON.stringify(settings || {}, null, 2);
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { payload: formatted }
  });
  useEffect(() => reset({ payload: formatted }), [formatted, reset]);

  const save = useMutation({
    mutationFn: (value) => api.patch('/api/settings', value),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings saved.');
    },
    onError: () => toast.error('Settings could not be saved.')
  });

  return (
    <div className="settings-page">
      <div className="page-heading"><div><p className="eyebrow">General</p><h1>Site settings</h1></div><span className="save-state">{isDirty ? 'Unsaved changes' : 'All changes saved'}</span></div>
      <div className="settings-callout"><strong>Live content settings</strong><span>Changes here are public and update both portfolio sites. Keep private keys in the API environment, never here.</span></div>
      <section className="panel editor-panel">
        <div className="panel-title"><div><h2>Global settings</h2><p>Social profiles, contact information, cross-links, analytics and availability.</p></div></div>
        {query.isPending ? <div className="page-loading">Loading settings…</div> : query.isError ? <p className="page-error">Settings could not be loaded.</p> : (
          <form onSubmit={handleSubmit(({ payload }) => save.mutate(JSON.parse(payload)))}>
            <label className="field-label" htmlFor="settings-json">Settings JSON</label>
            <textarea id="settings-json" className={`code-editor ${errors.payload ? 'has-error' : ''}`} spellCheck="false" {...register('payload')} />
            {errors.payload && <p className="field-error">{errors.payload.message}</p>}
            <div className="editor-actions"><button type="submit" className="button button-primary" disabled={save.isPending}><Save size={16} />{save.isPending ? 'Saving…' : 'Save settings'}</button><span>Changes publish immediately.</span></div>
          </form>
        )}
      </section>
    </div>
  );
}
