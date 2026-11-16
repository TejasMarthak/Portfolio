import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { useReducedMotion } from 'framer-motion';
import Lenis from 'lenis';
import { api } from './api';
import { useIs3DCapable } from './hooks/useIs3DCapable';
import Portfolio from './components/Portfolio';
import Preloader from './components/Preloader';
import './styles.css';

const Darkroom = lazy(() => import('./scene/Darkroom'));

function readData(result) {
  return result?.data?.content || result?.data?.settings || {};
}

function hasPublishedContent(content) {
  const metadata = new Set(['_id', '__v', 'singleton', 'createdAt', 'updatedAt']);
  const hasValue = (value) => {
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number' || typeof value === 'boolean') return true;
    if (Array.isArray(value)) return value.some(hasValue);
    if (value && typeof value === 'object') return Object.values(value).some(hasValue);
    return false;
  };
  return Object.entries(content).some(([key, value]) => !metadata.has(key) && hasValue(value));
}

function ScenePlaceholder() {
  return <div className="darkroom-placeholder" aria-hidden="true"><div className="darkroom-halo" /><div className="darkroom-curtain" /></div>;
}

export default function App() {
  const is3DCapable = useIs3DCapable();
  const reducedMotion = useReducedMotion();
  const [showAsPage, setShowAsPage] = useState(false);
  const contentQuery = useQuery({ queryKey: ['photo'], queryFn: () => api.get('/api/photo/content'), staleTime: 300000, retry: 1 });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/api/settings'), staleTime: 300000, retry: 1 });
  const content = useMemo(() => readData(contentQuery.data), [contentQuery.data]);
  const settings = useMemo(() => readData(settingsQuery.data), [settingsQuery.data]);
  const hasContent = hasPublishedContent(content);

  useEffect(() => {
    if (!showAsPage && is3DCapable) return undefined;
    const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
    let frame;
    const animate = (time) => {
      lenis.raf(time);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [showAsPage, is3DCapable]);

  const seo = content.seo || {};
  const gallerySchema = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: seo.title || content.hero?.tagline || '',
    description: seo.desc || content.hero?.subtitle || '',
    image: (content.gallery || []).filter((photo) => photo.src).map((photo) => photo.src)
  };

  return (
    <div className={`photo-app-shell ${showAsPage || !is3DCapable ? 'photo-page-mode' : 'photo-world-mode'}`}>
      <Helmet>
        <title>{seo.title || content.hero?.tagline || 'Portfolio'}</title>
        {seo.desc && <meta name="description" content={seo.desc} />}
        {seo.keywords && <meta name="keywords" content={Array.isArray(seo.keywords) ? seo.keywords.join(', ') : seo.keywords} />}
        <meta property="og:title" content={seo.title || content.hero?.tagline || ''} />
        <meta property="og:description" content={seo.desc || content.hero?.subtitle || ''} />
        {seo.ogImage && <meta property="og:image" content={seo.ogImage} />}
        <link rel="canonical" href={window.location.href.split('#')[0]} />
        <script type="application/ld+json">{JSON.stringify(gallerySchema).replace(/</g, '\\u003c')}</script>
      </Helmet>
      {!showAsPage && is3DCapable && hasContent && (
        <div className="darkroom-layer">
          <Suspense fallback={<ScenePlaceholder />}>
            <Darkroom photos={content.gallery || []} reducedMotion={Boolean(reducedMotion)} />
          </Suspense>
        </div>
      )}
      {!hasContent && (contentQuery.isPending || settingsQuery.isPending) ? (
        <div className="photo-loading" role="status"><ScenePlaceholder /><span>Entering the gallery</span></div>
      ) : contentQuery.isError ? (
        <main className="photo-error" role="alert">Gallery content is temporarily unavailable.</main>
      ) : settings.photoSite?.live === false ? (
        <main className="photo-maintenance" role="status">{settings.photoSite.maintenanceMsg || ''}</main>
      ) : !hasContent ? (
        <main className="photo-empty-content" role="status">
          <div className="photo-empty-card">
            <p className="photo-kicker">Light field ready</p>
            <h1>Your gallery is waiting for its first frame.</h1>
            <p>Add your hero, photos, and stories in the CMS to publish this gallery.</p>
            <small>The CMS needs Google OAuth credentials in <code>server/.env</code>.</small>
          </div>
        </main>
      ) : (
        <>
          <Preloader name={content.hero?.tagline || content.about?.openingLine} />
          <Portfolio content={content} settings={settings} showAsPage={showAsPage || !is3DCapable} canUse3D={is3DCapable} setShowAsPage={setShowAsPage} />
        </>
      )}
    </div>
  );
}
