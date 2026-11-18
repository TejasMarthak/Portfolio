import { lazy, Suspense, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import Lenis from 'lenis';
import { api } from './api';
import CustomCursor from '../../shared/CustomCursor.jsx';
import { useIs3DCapable } from './hooks/useIs3DCapable';
import Portfolio from './components/Portfolio';
import BuildPlaneFallback from './scene/BuildPlaneFallback';
import '../../shared/media-viewer.css';
import './styles.css';

const BuildPlane = lazy(() => import('./scene/BuildPlane'));
const PAGE_TITLE = 'Tejas | FullStack Developer';

function readData(result) {
  return result?.data?.content || result?.data?.settings || {};
}

function hasPublishedContent(content) {
  const metadata = new Set(['_id', '__v', 'singleton', 'createdAt', 'updatedAt', 'seo']);
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
  return <div className="scene-placeholder" aria-hidden="true"><div className="placeholder-ring" /><div className="placeholder-grid" /></div>;
}

export default function App() {
  const is3DCapable = useIs3DCapable();
  const reducedMotion = useReducedMotion();
  const contentQuery = useQuery({ queryKey: ['pro'], queryFn: () => api.get('/api/pro/content'), staleTime: 300000, retry: 1 });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/api/settings'), staleTime: 300000, retry: 1 });
  const content = useMemo(() => readData(contentQuery.data), [contentQuery.data]);
  const settings = useMemo(() => readData(settingsQuery.data), [settingsQuery.data]);
  const hasContent = hasPublishedContent(content);
  const sceneContent = useMemo(() => ({
    ...content,
    skills: settings.sections?.pro?.skills === false ? [] : content.skills || [],
    projects: settings.sections?.pro?.projects === false ? [] : content.projects || []
  }), [content, settings.sections?.pro?.skills, settings.sections?.pro?.projects]);
  const photoPortfolioUrl = settings.proSite?.crossLinkToPhoto ||
    (['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:5174' : '');

  useEffect(() => {
    if (is3DCapable) return undefined;
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
  }, [is3DCapable]);

  const seo = content.seo || {};
  const pageTitle = seo.title || PAGE_TITLE;
  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Tejas',
    description: seo.desc || content.hero?.subheadline || '',
    url: typeof window !== 'undefined' ? window.location.origin : '',
    image: seo.ogImage || content.about?.photoURL || ''
  };

  return (
    <div className={`app-shell ${is3DCapable ? 'world-mode' : 'page-mode'}`}>
      <CustomCursor theme="pro" />
      <Helmet>
        <title>{pageTitle}</title>
        {seo.desc && <meta name="description" content={seo.desc} />}
        {seo.keywords && <meta name="keywords" content={Array.isArray(seo.keywords) ? seo.keywords.join(', ') : seo.keywords} />}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={seo.desc || content.hero?.subheadline || ''} />
        {seo.ogImage && <meta property="og:image" content={seo.ogImage} />}
        <link rel="canonical" href={window.location.href.split('#')[0]} />
        <script type="application/ld+json">{JSON.stringify(personSchema).replace(/</g, '\\u003c')}</script>
      </Helmet>
      {!is3DCapable && hasContent && <BuildPlaneFallback content={sceneContent} reducedMotion={Boolean(reducedMotion)} />}
      {is3DCapable && hasContent && (
        <div className="scene-layer" aria-hidden="true">
          <Suspense fallback={<ScenePlaceholder />}>
            <BuildPlane content={sceneContent} reducedMotion={Boolean(reducedMotion)} />
          </Suspense>
        </div>
      )}
      {!hasContent && (contentQuery.isPending || settingsQuery.isPending) ? (
        <div className="loading-state" role="status"><ScenePlaceholder /><span>Loading portfolio</span></div>
      ) : contentQuery.isError ? (
        <main className="error-state" role="alert">Portfolio content is temporarily unavailable.</main>
      ) : settings.proSite?.live === false ? (
        <main className="maintenance-state" role="status">{settings.proSite.maintenanceMsg || ''}</main>
      ) : !hasContent ? (
        <main className="empty-content-state" role="status">
          <div className="empty-content-card">
            <p className="eyebrow"><span />Build plane ready</p>
            <h1>Your portfolio is ready for its story.</h1>
            <p>Add your hero, about, skills, and projects in the CMS to publish your content here.</p>
            {photoPortfolioUrl && <a className="portfolio-switch empty-portfolio-switch" href={photoPortfolioUrl}>Open photo portfolio <ArrowUpRight size={14} /></a>}
            <a href="#setup">What needs to be configured?</a>
            <small id="setup">The CMS needs Google OAuth credentials in <code>server/.env</code>.</small>
          </div>
        </main>
      ) : (
        <Portfolio content={content} settings={settings} canUse3D={is3DCapable} />
      )}
      {reducedMotion && <motion.span className="sr-only" aria-live="polite">Reduced motion is enabled.</motion.span>}
    </div>
  );
}
