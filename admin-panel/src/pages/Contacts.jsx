import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Mail, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Contacts() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const query = useQuery({
    queryKey: ['contacts', page, source, status],
    queryFn: () => api.get('/api/contact', { params: { page, source: source || undefined, status: status || undefined } })
  });
  const update = useMutation({
    mutationFn: ({ id, values }) => api.patch(`/api/contact/${id}`, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Inquiry updated.');
    },
    onError: (error) => toast.error(error.response?.data?.error || 'The inquiry could not be updated.')
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/api/contact/${id}`),
    onSuccess: async () => {
      setConfirmDelete(null);
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Inquiry deleted.');
    },
    onError: (error) => toast.error(error.response?.data?.error || 'The inquiry could not be deleted.')
  });

  return (
    <div className="contacts-page">
      <div className="page-heading"><div><p className="eyebrow">General</p><h1>Contacts</h1></div><span className="total-count">{query.data?.data?.total ?? '—'} total</span></div>
      <section className="panel table-panel">
        <div className="filter-row">
          <label>Site<select value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }}><option value="">All sites</option><option value="pro">Developer</option><option value="photo">Photography</option></select></label>
          <label>Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="new">New</option><option value="read">Read</option><option value="replied">Replied</option></select></label>
        </div>
        {query.isError ? <p className="page-error">The inbox could not be loaded.</p> : (
          <div className="table-scroll"><table><thead><tr><th>Sender</th><th>Subject</th><th>Site</th><th>Status</th><th>Date</th><th /></tr></thead><tbody>
            {(query.data?.data?.items || []).map((contact) => (
              <tr key={contact._id} onClick={() => setSelected(contact)} className="clickable-row">
                <td><strong>{contact.name}</strong><small>{contact.email}</small></td><td>{contact.subject}</td><td><span className={`source-tag source-${contact.source}`}>{contact.source}</span></td><td><span className={`status-pill status-${contact.status}`}>{contact.status}</span></td><td>{new Date(contact.createdAt).toLocaleDateString()}</td><td><button className="icon-button" aria-label="View inquiry"><ArrowUpRight size={16} /></button></td>
              </tr>
            ))}
          </tbody></table>
          {!query.isPending && !query.data?.data?.items?.length && <p className="empty-state">No inquiries match these filters.</p>}
        </div>
        )}
        <div className="pagination"><span>Page {page} of {Math.max(1, query.data?.data?.pages || 1)}</span><div><button className="button button-muted" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="button button-muted" disabled={page >= (query.data?.data?.pages || 1)} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
      </section>

      {selected && <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section className="contact-detail panel" role="dialog" aria-modal="true" aria-labelledby="contact-title">
        <div className="detail-heading"><div><p className="eyebrow">{selected.source} inquiry</p><h2 id="contact-title">{selected.subject}</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close"><X size={19} /></button></div>
        <dl className="contact-fields"><div><dt>Name</dt><dd>{selected.name}</dd></div><div><dt>Email</dt><dd><a href={`mailto:${selected.email}`}>{selected.email}</a></dd></div>{selected.phone && <div><dt>Phone</dt><dd>{selected.phone}</dd></div>}{selected.projectType && <div><dt>Project type</dt><dd>{selected.projectType}</dd></div>}<div className="message-field"><dt>Message</dt><dd>{selected.message}</dd></div></dl>
        <label className="field-label">Status<select value={selected.status} onChange={(event) => { const values = { status: event.target.value }; setSelected({ ...selected, ...values }); update.mutate({ id: selected._id, values }); }}><option value="new">New</option><option value="read">Read</option><option value="replied">Replied</option></select></label>
        <label className="field-label">Admin note<textarea rows="4" defaultValue={selected.adminNote || ''} onBlur={(event) => {
          if (event.target.value !== (selected.adminNote || '')) {
            const values = { adminNote: event.target.value };
            setSelected({ ...selected, ...values });
            update.mutate({ id: selected._id, values });
          }
        }} /></label>
        <p className="sent-badges">WhatsApp {selected.whatsappSent ? 'sent' : 'not sent'} · Email {selected.emailSent ? 'sent' : 'not sent'}</p>
        <div className="dialog-actions"><a className="button button-primary" href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`}><Mail size={15} /> Reply by email</a><button type="button" className="button button-danger" onClick={() => setConfirmDelete(selected._id)}><Trash2 size={15} /> Delete</button></div>
      </section></div>}
      {confirmDelete && <ConfirmDialog title="Delete inquiry?" message="This action permanently removes the contact record." onCancel={() => setConfirmDelete(null)} onConfirm={() => remove.mutate(confirmDelete)} busy={remove.isPending} />}
    </div>
  );
}
