import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, cloudinaryUrl } from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import DropUpload from '../components/DropUpload';

export default function MediaLibrary() {
  const queryClient = useQueryClient();
  const [type, setType] = useState('');
  const [folder, setFolder] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const query = useQuery({
    queryKey: ['media', type, folder],
    queryFn: () => api.get('/api/media', { params: { type: type || undefined, folder: folder || undefined } })
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/api/media/${id}`),
    onSuccess: async () => {
      setPendingDelete(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['media'] }),
        queryClient.invalidateQueries({ queryKey: ['pro'] }),
        queryClient.invalidateQueries({ queryKey: ['photo'] })
      ]);
      toast.success('Media and all portfolio references deleted.');
    },
    onError: () => toast.error('The media item could not be deleted.')
  });

  async function copy(url) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('URL copied.');
    } catch (error) {
      toast.error(`Could not copy URL: ${error.message}`);
    }
  }

  return (
    <div className="media-page">
      <div className="page-heading"><div><p className="eyebrow">General</p><h1>Media library</h1></div><span className="total-count">{query.data?.data?.total ?? '—'} assets</span></div>
      <section className="panel media-toolbar">
        <div className="filter-row">
          <label>Type<select value={type} onChange={(event) => setType(event.target.value)}><option value="">All types</option><option value="image">Images</option><option value="video">Video</option><option value="raw">Documents</option></select></label>
          <label>Folder<select value={folder} onChange={(event) => setFolder(event.target.value)}><option value="">All folders</option><option value="pro-portfolio">Developer</option><option value="photo-gallery">Gallery</option><option value="photo-videos">Photo video</option><option value="documents">Documents</option></select></label>
        </div>
        <DropUpload folder={folder || 'pro-portfolio'} acceptVideo onUploaded={() => queryClient.invalidateQueries({ queryKey: ['media'] })} />
      </section>
      {query.isError ? <p className="page-error">The media library could not be loaded.</p> : (
        <div className="media-grid">{(query.data?.data?.items || []).map((media) => (
          <article className="media-card panel" key={media._id}>
            {media.resourceType === 'image' ? <img src={cloudinaryUrl(media.url, 700)} alt="" loading="lazy" /> : media.resourceType === 'video' ? <video src={media.url} controls preload="metadata" /> : <div className="document-preview">PDF</div>}
            <div className="media-info"><strong>{media.publicId.split('/').pop()}</strong><small>{media.folder} · {media.resourceType} · {media.size ? `${Math.round(media.size / 1024)} KB` : ''}</small></div>
            <div className="media-actions"><button className="button button-muted" type="button" onClick={() => copy(media.url)}><Copy size={14} />Copy URL</button><button className="icon-button danger-icon" type="button" aria-label="Delete media" onClick={() => setPendingDelete(media)}><Trash2 size={15} /></button></div>
          </article>
        ))}</div>
      )}
      {!query.isPending && !query.isError && !query.data?.data?.items?.length && <p className="empty-state panel">Your media library is empty. Upload an image, video, or document to get started.</p>}
      {pendingDelete && <ConfirmDialog title="Delete media everywhere?" message="This permanently deletes the Cloudinary asset, removes it from the media library, and clears its references from both portfolios." onCancel={() => setPendingDelete(null)} onConfirm={() => remove.mutate(pendingDelete._id)} busy={remove.isPending} />}
    </div>
  );
}
