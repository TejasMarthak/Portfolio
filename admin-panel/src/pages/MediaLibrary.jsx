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
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const query = useQuery({
    queryKey: ['media', type, folder],
    queryFn: () => api.get('/api/media', { params: { type: type || undefined, folder: folder || undefined } })
  });
  const allMediaCount = useQuery({
    queryKey: ['media-count-all'],
    queryFn: () => api.get('/api/media')
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/api/media/${id}`),
    onSuccess: async () => {
      setPendingDelete(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['media'] }),
        queryClient.invalidateQueries({ queryKey: ['media-count-all'] }),
        queryClient.invalidateQueries({ queryKey: ['pro'] }),
        queryClient.invalidateQueries({ queryKey: ['photo'] })
      ]);
      toast.success('Media and all portfolio references deleted.');
    },
    onError: () => toast.error('The media item could not be deleted.')
  });
  const removeAll = useMutation({
    mutationFn: () => api.delete('/api/media'),
    onSuccess: async ({ data }) => {
      setConfirmDeleteAll(false);
      setDeleteConfirmation('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['media'] }),
        queryClient.invalidateQueries({ queryKey: ['media-count-all'] }),
        queryClient.invalidateQueries({ queryKey: ['pro'] }),
        queryClient.invalidateQueries({ queryKey: ['photo'] })
      ]);
      if (data.failed) {
        toast.error(`Deleted ${data.deleted} of ${data.total} media items. ${data.failed} could not be deleted; retry after resolving the storage issue.`);
      } else if (data.deleted) {
        toast.success(`Deleted all ${data.deleted} media items and cleared their portfolio references.`);
      } else {
        toast.success('The media library is already empty.');
      }
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Media could not be deleted.')
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
      <div className="page-heading">
        <div><p className="eyebrow">General</p><h1>Media library</h1></div>
        <div className="media-heading-actions">
          <span className="total-count">{query.data?.data?.total ?? '—'} assets</span>
          <button
            type="button"
            className="button button-danger"
            onClick={() => setConfirmDeleteAll(true)}
            disabled={allMediaCount.isPending || !allMediaCount.data?.data?.total || removeAll.isPending}
          ><Trash2 size={14} />Delete all media</button>
        </div>
      </div>
      <section className="panel media-toolbar">
        <div className="filter-row">
          <label>Type<select value={type} onChange={(event) => setType(event.target.value)}><option value="">All types</option><option value="image">Images</option><option value="video">Video</option><option value="raw">Documents</option></select></label>
          <label>Folder<select value={folder} onChange={(event) => setFolder(event.target.value)}><option value="">All folders</option><option value="pro-portfolio">Developer</option><option value="photo-gallery">Gallery</option><option value="photo-videos">Photo video</option><option value="documents">Documents</option></select></label>
        </div>
        <DropUpload folder={folder || 'pro-portfolio'} acceptVideo onUploaded={() => Promise.all([
          queryClient.invalidateQueries({ queryKey: ['media'] }),
          queryClient.invalidateQueries({ queryKey: ['media-count-all'] })
        ])} />
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
      {confirmDeleteAll && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !removeAll.isPending) {
            setConfirmDeleteAll(false);
            setDeleteConfirmation('');
          }
        }}>
          <section className="confirm-dialog delete-all-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-all-title">
            <h2 id="delete-all-title">Permanently delete all media?</h2>
            <p>This deletes all {allMediaCount.data?.data?.total ?? '…'} assets in the media library, regardless of the current filters. It also clears their references from both portfolios and profile photos. This cannot be undone.</p>
            <label className="delete-all-confirm-label" htmlFor="delete-all-confirmation">Type <strong>DELETE ALL</strong> to confirm</label>
            <input
              id="delete-all-confirmation"
              className="delete-all-confirm-input"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              autoComplete="off"
              autoFocus
              disabled={removeAll.isPending}
            />
            <div className="dialog-actions">
              <button type="button" className="button button-muted" onClick={() => {
                setConfirmDeleteAll(false);
                setDeleteConfirmation('');
              }} disabled={removeAll.isPending}>Cancel</button>
              <button
                type="button"
                className="button button-danger"
                onClick={() => removeAll.mutate()}
                disabled={deleteConfirmation !== 'DELETE ALL' || removeAll.isPending || !allMediaCount.data?.data?.total}
              >{removeAll.isPending ? 'Deleting…' : 'Permanently delete all'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
