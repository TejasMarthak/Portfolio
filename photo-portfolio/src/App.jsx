import { lazy, Suspense, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { api } from './api';
import CustomCursor from '../../shared/CustomCursor.jsx';
import { useIs3DCapable } from './hooks/useIs3DCapable';
import Portfolio from './components/Portfolio';
import Preloader from './components/Preloader';
import LightFieldFallback from './scene/LightFieldFallback';
import '../../shared/media-viewer.css';
import './styles.css';

const Darkroom = lazy(() => import('./scene/Darkroom'));
const PAGE_TITLE = 'Tejas | Photographer';

function readData(result) {
  return result?.data?.content || result?.data?.settings || {};
}

function hasPublishedContent(content) {
  const metadata = new Set(['_id', '__v', 'singleton', 'createdAt', 'updatedAt', 'categories', 'seo']);
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
  const contentQuery = useQuery({ queryKey: ['photo'], queryFn: () => api.get('/api/photo/content'), staleTime: 300000, retry: 1 });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/api/settings'), staleTime: 300000, retry: 1 });
  const content = useMemo(() => readData(contentQuery.data), [contentQuery.data]);
  const settings = useMemo(() => readData(settingsQuery.data), [settingsQuery.data]);
  const hasContent = hasPublishedContent(content);
  const scenePhotos = useMemo(() => {
    const sections = settings.sections?.photo || {};
    const photos = [];
    if (sections.gallery !== false) photos.push(...(content.gallery || []).filter((photo) => photo.src));
    if (sections.stories !== false) {
      photos.push(...(content.stories || []).filter((story) => story.image).map((story) => ({
        id: story.id || story.image,
        src: story.image,
        title: story.title || 'Story',
        alt: story.title || ''
      })));
    }
    if (sections.about !== false && content.about?.photoURL) {
      photos.push({ id: 'about-photo', src: content.about.photoURL, title: content.about.photoAlt || 'About photo', alt: content.about.photoAlt || '' });
    }
    return [...new Map(photos.map((photo) => [photo.src, photo])).values()];
  }, [content, settings.sections?.photo]);
  const sceneStartSection = useMemo(() => {
    const sections = settings.sections?.photo || {};
    if (sections.gallery !== false && content.gallery?.some((photo) => photo.src)) return 'gallery';
    if (sections.stories !== false && content.stories?.some((story) => story.image)) return 'stories';
    if (sections.about !== false && content.about?.photoURL) return 'about';
    return 'darkroom-journey';
  }, [content, settings.sections?.photo]);
  const proPortfolioUrl = settings.photoSite?.crossLinkToPro ||
    (['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:5173' : '');

  const seo = content.seo || {};
  const pageTitle = seo.title || PAGE_TITLE;
  const gallerySchema = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: 'Tejas',
    description: seo.desc || content.hero?.subtitle || '',
    image: (content.gallery || []).filter((photo) => photo.src).map((photo) => photo.src)
  };

  return (
    <div className={`photo-app-shell ${is3DCapable ? 'photo-world-mode' : 'photo-page-mode'}`}>
      <CustomCursor theme="photo" />
      <Helmet>
        <title>{pageTitle}</title>
        {seo.desc && <meta name="description" content={seo.desc} />}
        {seo.keywords && <meta name="keywords" content={Array.isArray(seo.keywords) ? seo.keywords.join(', ') : seo.keywords} />}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={seo.desc || content.hero?.subtitle || ''} />
        {seo.ogImage && <meta property="og:image" content={seo.ogImage} />}
        <link rel="canonical" href={window.location.href.split('#')[0]} />
        <script type="application/ld+json">{JSON.stringify(gallerySchema).replace(/</g, '\\u003c')}</script>
      </Helmet>
      {!is3DCapable && hasContent && scenePhotos.length > 0 && (
        <LightFieldFallback photos={scenePhotos} reducedMotion={Boolean(reducedMotion)} />
      )}
      {is3DCapable && hasContent && scenePhotos.length > 0 && (
        <div className="darkroom-layer">
          <Suspense fallback={<ScenePlaceholder />}>
            <Darkroom photos={scenePhotos} reducedMotion={Boolean(reducedMotion)} startSection={sceneStartSection} />
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
            {proPortfolioUrl && <a className="photo-portfolio-switch empty-photo-portfolio-switch" href={proPortfolioUrl}>Open developer portfolio <ArrowUpRight size={14} /></a>}
            <small>The CMS needs Google OAuth credentials in <code>server/.env</code>.</small>
          </div>
        </main>
      ) : (
        <>
          <Preloader name={content.hero?.tagline || content.about?.openingLine} />
          <Portfolio content={content} settings={settings} canUse3D={is3DCapable} reducedMotion={Boolean(reducedMotion)} />
        </>
      )}
    </div>
  );
}
