import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import PdfViewer from './PdfViewer.jsx';

const ViewerContext = createContext(null);
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

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
  if (/\.pdf$/.test(pathname) || (/\/documents\//.test(pathname) && /\/(?:raw|image)\/upload\//.test(pathname))) return 'pdf';
  if (/\.(mp4|m4v|mov|webm|ogv|m3u8)$/.test(pathname)) return 'video';
  if (/\.(mp3|m4a|wav|oga|ogg|aac|flac)$/.test(pathname)) return 'audio';
  if (/\.(avif|bmp|gif|jpe?g|png|svg|tiff?|webp)$/.test(pathname)) return 'image';
  return '';
}

function inlinePdfUrl(value) {
  const url = new URL(value);
  if (url.hostname === 'res.cloudinary.com' && /\/(?:raw|image)\/upload\//.test(url.pathname)) {
    const segments = url.pathname.split('/').filter(Boolean);
    const uploadIndex = segments.findIndex((segment, index) =>
      ['raw', 'image'].includes(segment) && segments[index + 1] === 'upload'
    );
    if (uploadIndex !== -1) {
      let assetPath = segments.slice(uploadIndex + 2);
      const versionIndex = assetPath.findIndex((segment) => /^v\d+$/.test(segment));
      if (versionIndex !== -1) {
        assetPath = assetPath.slice(versionIndex + 1);
      } else {
        while (/^(?:fl_inline|fl_attachment|f_auto|q_auto|w_\d+)(?:,.*)?$/i.test(assetPath[0] || '')) assetPath.shift();
      }
      const publicId = decodeURIComponent(assetPath.join('/'));
      if (publicId) {
        return `${API_BASE_URL}/api/media/inline-pdf?publicId=${encodeURIComponent(publicId)}#toolbar=1&navpanes=0&view=Fit`;
      }
    }
  }
  url.hash = 'toolbar=1&navpanes=0&view=Fit';
  return url.href;
}

function pdfSourceUrl(value) {
  const url = new URL(inlinePdfUrl(value));
  url.hash = '';
  return url.href;
}

function mediaViewerBounds(aspect, viewportWidth, viewportHeight) {
  const compact = viewportWidth <= 640;
  const maxDialogWidth = Math.min(viewportWidth * 0.96, 1500);
  const maxDialogHeight = Math.min(viewportHeight * 0.92, 1050);
  const contentPadding = compact ? 7 : Math.min(24, Math.max(10, viewportWidth * 0.02));
  const border = 2;
  const header = compact ? 54 : 58;
  const maxContentWidth = maxDialogWidth - border - contentPadding * 2;
  const maxContentHeight = maxDialogHeight - header - border - contentPadding * 2;
  let contentWidth = aspect < 1 ? maxContentHeight * aspect : maxContentWidth;
  let contentHeight = contentWidth / aspect;
  const scale = Math.min(1, maxContentWidth / contentWidth, maxContentHeight / contentHeight);
  contentWidth *= scale;
  contentHeight *= scale;
  return {
    width: `${Math.round(contentWidth + contentPadding * 2 + border)}px`,
    height: `${Math.round(contentHeight + header + contentPadding * 2 + border)}px`
  };
}

function MediaVideo({ src, title, onDimensions }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  };

  return (
    <div className="site-media-viewer-player">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop
        muted={muted}
        playsInline
        preload="metadata"
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        disableRemotePlayback
        aria-label={title}
        onLoadedMetadata={(event) => onDimensions(event.currentTarget.videoWidth, event.currentTarget.videoHeight)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={togglePlayback}
      />
      {!playing && (
        <button type="button" className="site-media-viewer-play" onClick={togglePlayback} aria-label="Play video">
          <Play size={22} fill="currentColor" />
        </button>
      )}
      <button
        type="button"
        className="site-media-viewer-mute"
        onClick={() => setMuted((value) => !value)}
        aria-label={muted ? 'Unmute video' : 'Mute video'}
        aria-pressed={!muted}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      {playing && (
        <button type="button" className="site-media-viewer-pause" onClick={togglePlayback} aria-label="Pause video">
          <Pause size={18} />
        </button>
      )}
    </div>
  );
}

function ViewerDialog({ media, theme, onClose, onNavigate }) {
  const dialogRef = useRef(null);
  const touchStartRef = useRef(null);
  const titleId = 'site-media-viewer-title';
  const [fitToScreen, setFitToScreen] = useState(false);
  const [mediaAspect, setMediaAspect] = useState(null);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const canNavigate = media.items.length > 1;
  const supportsNavigation = ['image', 'video', 'embed'].includes(media.type);

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

  useEffect(() => {
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (!canNavigate || !supportsNavigation) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        onNavigate(1);
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        onNavigate(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canNavigate, onNavigate, supportsNavigation]);

  const setMediaDimensions = (width, height) => {
    if (width > 0 && height > 0) setMediaAspect(width / height);
  };
  const handleTouchStart = (event) => {
    if (!canNavigate || !supportsNavigation || event.target.closest?.('button')) return;
    const touch = event.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };
  const handleTouchEnd = (event) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 55) return;
    const swipeDirection = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    onNavigate(swipeDirection < 0 ? 1 : -1);
  };
  const embedUrl = media.type === 'embed' ? videoEmbedUrl(media.src) : '';
  const viewerStyle = !fitToScreen && mediaAspect
    ? mediaViewerBounds(mediaAspect, viewport.width, viewport.height)
    : undefined;

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`site-media-viewer ${fitToScreen ? 'fit-to-screen' : ''}`}
      style={viewerStyle}
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
          <button
            type="button"
            className="site-media-viewer-fit"
            aria-label={fitToScreen ? 'Restore media viewer size' : 'Fit media to screen'}
            aria-pressed={fitToScreen}
            title={fitToScreen ? 'Restore viewer size' : 'Fit to screen'}
            onClick={() => setFitToScreen(!fitToScreen)}
          >
            {fitToScreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            <span>{fitToScreen ? 'Restore size' : 'Fit to screen'}</span>
          </button>
          <button type="button" className="site-media-viewer-close" onClick={onClose} aria-label="Close media viewer">
            <X size={20} />
          </button>
        </header>
        <div
          className={`site-media-viewer-content site-media-viewer-${media.type}${canNavigate && supportsNavigation ? ' has-navigation' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {media.type === 'image' && <img src={media.src} alt={media.title} onLoad={(event) => setMediaDimensions(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} />}
          {media.type === 'video' && <MediaVideo src={media.src} title={media.title} onDimensions={setMediaDimensions} />}
          {media.type === 'audio' && <audio src={media.src} controls autoPlay />}
          {media.type === 'pdf' && <PdfViewer src={pdfSourceUrl(media.src)} title={media.title} />}
          {media.type === 'embed' && (
            <iframe
              src={embedUrl}
              title={`${media.title} video`}
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
          {canNavigate && supportsNavigation && (
            <>
              <button type="button" className="site-media-viewer-nav site-media-viewer-previous" onClick={() => onNavigate(-1)} aria-label="Previous media" title="Previous media">
                <ChevronLeft size={22} />
              </button>
              <span className="site-media-viewer-position" aria-live="polite">{media.index + 1} / {media.items.length}</span>
              <button type="button" className="site-media-viewer-nav site-media-viewer-next" onClick={() => onNavigate(1)} aria-label="Next media" title="Next media">
                <ChevronRight size={22} />
              </button>
            </>
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
    const items = (Array.isArray(item.items) ? item.items : [])
      .map((entry) => {
        const entrySrc = safeMediaUrl(entry.src);
        const entryType = entry.type || mediaTypeForUrl(entrySrc);
        return entrySrc && entryType ? { src: entrySrc, type: entryType, title: entry.title || 'Media preview' } : null;
      })
      .filter(Boolean);
    const index = items.findIndex((entry) => entry.src === src);
    if (index === -1) items.push({ src, type, title: item.title || 'Media preview' });
    setMedia({
      src,
      type,
      title: item.title || 'Media preview',
      items: items.length ? items : [{ src, type, title: item.title || 'Media preview' }],
      index: index === -1 ? items.length - 1 : index
    });
  }, []);
  const navigate = useCallback((direction) => {
    setMedia((current) => {
      if (!current || current.items.length < 2) return current;
      const index = (current.index + direction + current.items.length) % current.items.length;
      return { ...current, ...current.items[index], index };
    });
  }, []);

  return (
    <ViewerContext.Provider value={openViewer}>
      {children}
      {media && <ViewerDialog key={media.src} media={media} theme={theme} onClose={() => setMedia(null)} onNavigate={navigate} />}
    </ViewerContext.Provider>
  );
}

export function MediaTrigger({ src, type, title, items, className = '', children }) {
  const openViewer = useContext(ViewerContext);
  const safeSrc = safeMediaUrl(src);
  const resolvedType = type || mediaTypeForUrl(src);
  return (
    <button
      type="button"
      className={`media-trigger ${className}`.trim()}
      onClick={() => openViewer?.({ src: safeSrc, type: resolvedType, title, items })}
      aria-label={`View ${title || 'media'}`}
      disabled={!safeSrc || !resolvedType}
    >
      {children}
    </button>
  );
}

export function MediaLink({ href, title, items, className = '', target, rel, children }) {
  const safeHref = safeMediaUrl(href);
  if (!safeHref) return <span className={className}>{children}</span>;
  const type = mediaTypeForUrl(safeHref);
  if (type) return <MediaTrigger src={safeHref} type={type} title={title} items={items} className={className}>{children}</MediaTrigger>;
  return <a href={safeHref} className={className} target={target} rel={rel}>{children}</a>;
}
