import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, BriefcaseBusiness, Camera, Images, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const contacts = useQuery({ queryKey: ['contacts', 'dashboard'], queryFn: () => api.get('/api/contact?page=1'), staleTime: 60000 });
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/api/settings'), staleTime: 60000 });
  const pro = useQuery({ queryKey: ['pro'], queryFn: () => api.get('/api/pro/content'), staleTime: 300000 });
  const photo = useQuery({ queryKey: ['photo'], queryFn: () => api.get('/api/photo/content'), staleTime: 300000 });
  const unread = contacts.data?.data?.items?.filter((item) => item.status === 'new').length || 0;
  const config = settings.data?.data?.settings || {};
  const proUrl = import.meta.env.VITE_PRO_URL || 'http://localhost:5173';
  const photoUrl = import.meta.env.VITE_PHOTO_URL || 'http://localhost:5174';
  const proCount = pro.data?.data?.content?.projects?.length || 0;
  const photoCount = photo.data?.data?.content?.gallery?.length || 0;
  const updateSettings = useMutation({
    mutationFn: (values) => api.patch('/api/settings', values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Site availability updated.');
    },
    onError: () => toast.error('Availability could not be updated.')
  });

  return (
    <div className="dashboard-page">
      <div className="page-heading"><div><p className="eyebrow">Workspace overview</p><h1>Dashboard</h1></div><span className="live-indicator"><i /> Connected</span></div>
      <div className="stat-grid">
        <article className="stat-card"><span className="stat-icon"><Mail size={18} /></span><span>New inquiries</span><strong>{contacts.isPending ? '—' : unread}</strong><Link to="/general/contacts">View inbox <ArrowUpRight size={14} /></Link></article>
        <article className="stat-card"><span className="stat-icon"><BriefcaseBusiness size={18} /></span><span>Developer projects</span><strong>{pro.isPending ? '—' : proCount}</strong><Link to="/pro/projects">Manage projects <ArrowUpRight size={14} /></Link></article>
        <article className="stat-card"><span className="stat-icon"><Images size={18} /></span><span>Gallery images</span><strong>{photo.isPending ? '—' : photoCount}</strong><Link to="/photo/gallery">Manage gallery <ArrowUpRight size={14} /></Link></article>
      </div>
      <section className="panel dashboard-sites">
        <div className="panel-title dashboard-sites-heading"><div><h2>Published sites</h2><p>Toggle public visibility or open either portfolio.</p></div><div className="dashboard-site-actions"><a className="button button-muted" href={proUrl} target="_blank" rel="noreferrer"><BriefcaseBusiness size={15} />Open developer portfolio<ArrowUpRight size={14} /></a><a className="button button-muted" href={photoUrl} target="_blank" rel="noreferrer"><Camera size={15} />Open photography portfolio<ArrowUpRight size={14} /></a></div></div>
        <div className="site-row"><div><span className="site-dot violet" /><div><strong>Developer portfolio</strong><small>Pro site</small></div></div><button type="button" className={`switch ${config.proSite?.live !== false ? 'switch-on' : ''}`} role="switch" aria-checked={config.proSite?.live !== false} aria-label="Toggle developer portfolio live status" disabled={updateSettings.isPending} onClick={() => updateSettings.mutate({ proSite: { ...config.proSite, live: config.proSite?.live === false } })}><span /></button><span className={`status-pill ${config.proSite?.live === false ? 'status-off' : 'status-on'}`}>{config.proSite?.live === false ? 'Offline' : 'Live'}</span><Link to="/pro/hero">Edit content <ArrowUpRight size={14} /></Link></div>
        <div className="site-row"><div><span className="site-dot amber" /><div><strong>Photography portfolio</strong><small>Photo site</small></div></div><button type="button" className={`switch ${config.photoSite?.live !== false ? 'switch-on' : ''}`} role="switch" aria-checked={config.photoSite?.live !== false} aria-label="Toggle photography portfolio live status" disabled={updateSettings.isPending} onClick={() => updateSettings.mutate({ photoSite: { ...config.photoSite, live: config.photoSite?.live === false } })}><span /></button><span className={`status-pill ${config.photoSite?.live === false ? 'status-off' : 'status-on'}`}>{config.photoSite?.live === false ? 'Offline' : 'Live'}</span><Link to="/photo/hero">Edit content <ArrowUpRight size={14} /></Link></div>
      </section>
      <section className="panel recent-contacts">
        <div className="panel-title"><div><h2>Recent inquiries</h2><p>Latest messages from both portfolio sites.</p></div><Link className="text-link" to="/general/contacts">Open inbox <ArrowUpRight size={14} /></Link></div>
        {contacts.isError ? <p className="empty-state">Inquiries are unavailable right now.</p> : (contacts.data?.data?.items || []).slice(0, 5).map((contact) => (
          <div className="recent-row" key={contact._id}><span className={`source-tag source-${contact.source}`}>{contact.source}</span><div><strong>{contact.name}</strong><small>{contact.subject}</small></div><time>{new Date(contact.createdAt).toLocaleDateString()}</time><span className={`status-pill status-${contact.status}`}>{contact.status}</span></div>
        ))}
        {!contacts.isPending && !contacts.isError && !contacts.data?.data?.items?.length && <p className="empty-state">No inquiries yet.</p>}
      </section>
    </div>
  );
}
