import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const ViewerContext = createContext(null);

function safeMediaUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function videoEmbedUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    if (hostname === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : '';
    }
    if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(hostname)) {
      const id = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : '';
    }
    if (hostname === 'vimeo.com' || hostname === 'player.vimeo.com') {
      const id = url.pathname.match(/\/(?:video\/)?(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : '';
    }
  } catch {
    return '';
  }
  return '';
}

export function mediaTypeForUrl(value) {
  const src = safeMediaUrl(value);
  if (!src) return '';
  const embedUrl = videoEmbedUrl(src);
  if (embedUrl) return 'embed';
  let pathname;
  try {
    pathname = new URL(src).pathname.toLowerCase();
  } catch {
    return '';
  }
  if (/\.pdf$/.test(pathname)) return 'pdf';
  if (/\.(mp4|m4v|mov|webm|ogv|m3u8)$/.test(pathname)) return 'video';
  if (/\.(mp3|m4a|wav|oga|ogg|aac|flac)$/.test(pathname)) return 'audio';
  if (/\.(avif|bmp|gif|jpe?g|png|svg|tiff?|webp)$/.test(pathname)) return 'image';
  return '';
}

function inlinePdfUrl(value) {
  const url = new URL(value);
  if (url.hostname === 'res.cloudinary.com' && /\/raw\/upload\//.test(url.pathname)) {
    url.pathname = url.pathname.replace('/raw/upload/fl_attachment/', '/raw/upload/fl_inline/');
    if (!/\/raw\/upload\/fl_inline\//.test(url.pathname)) {
      url.pathname = url.pathname.replace('/raw/upload/', '/raw/upload/fl_inline/');
    }
  }
  url.hash = 'toolbar=1&navpanes=0&view=FitH';
  return url.href;
}

function ViewerDialog({ media, theme, onClose }) {
  const dialogRef = useRef(null);
  const titleId = 'site-media-viewer-title';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  const embedUrl = media.type === 'embed' ? videoEmbedUrl(media.src) : '';

  return createPortal(
    <dialog
      ref={dialogRef}
      className="site-media-viewer"
      data-theme={theme}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="site-media-viewer-shell">
        <header className="site-media-viewer-header">
          <h2 id={titleId}>{media.title}</h2>
          <button type="button" className="site-media-viewer-close" onClick={onClose} aria-label="Close media viewer">
            <X size={20} />
          </button>
        </header>
        <div className={`site-media-viewer-content site-media-viewer-${media.type}`}>
          {media.type === 'image' && <img src={media.src} alt={media.title} />}
          {media.type === 'video' && <video src={media.src} controls autoPlay playsInline />}
          {media.type === 'audio' && <audio src={media.src} controls autoPlay />}
          {media.type === 'pdf' && <iframe src={inlinePdfUrl(media.src)} title={`${media.title} PDF preview`} />}
          {media.type === 'embed' && (
            <iframe
              src={embedUrl}
              title={`${media.title} video`}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
        </div>
      </div>
    </dialog>,
    document.body
  );
}

export default function MediaViewer({ theme, children }) {
  const [media, setMedia] = useState(null);
  const openViewer = useCallback((item) => {
    const src = safeMediaUrl(item.src);
    const type = item.type || mediaTypeForUrl(src);
    if (!src || !type) return;
    setMedia({ src, type, title: item.title || 'Media preview' });
  }, []);

  return (
    <ViewerContext.Provider value={openViewer}>
      {children}
      {media && <ViewerDialog media={media} theme={theme} onClose={() => setMedia(null)} />}
    </ViewerContext.Provider>
  );
}

export function MediaTrigger({ src, type, title, className = '', children }) {
  const openViewer = useContext(ViewerContext);
  const safeSrc = safeMediaUrl(src);
  const resolvedType = type || mediaTypeForUrl(src);
  return (
    <button
      type="button"
      className={`media-trigger ${className}`.trim()}
      onClick={() => openViewer?.({ src: safeSrc, type: resolvedType, title })}
      aria-label={`View ${title || 'media'}`}
      disabled={!safeSrc || !resolvedType}
    >
      {children}
    </button>
  );
}

export function MediaLink({ href, title, className = '', target, rel, children }) {
  const safeHref = safeMediaUrl(href);
  if (!safeHref) return <span className={className}>{children}</span>;
  const type = mediaTypeForUrl(safeHref);
  if (type) return <MediaTrigger src={safeHref} type={type} title={title} className={className}>{children}</MediaTrigger>;
  return <a href={safeHref} className={className} target={target} rel={rel}>{children}</a>;
}
