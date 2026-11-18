import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUpRight, Menu, Play, X } from 'lucide-react';
import { cloudinaryUrl } from '../api';
import MediaViewer, { MediaLink, MediaTrigger } from '../../../shared/MediaViewer.jsx';
import SiteContactDetails from '../../../shared/SiteContactDetails.jsx';
import ContactForm from './ContactForm';

function VideoCard({ video, label, items }) {
  const poster = video.thumb
    ? cloudinaryUrl(video.thumb, 1000)
    : video.videoURL?.includes('/video/upload/')
      ? video.videoURL.replace('/video/upload/', '/video/upload/so_0,f_jpg,q_auto,w_900/')
      : '';
  const content = (
    <>
      {poster
        ? <img src={poster} alt="" loading="lazy" />
        : <span className="video-poster-placeholder" aria-hidden="true" />}
      <span className="video-play" aria-hidden="true"><Play size={16} fill="currentColor" /></span>
    </>
  );
  if (!video.videoURL) return <div className="video-card">{content}</div>;
  return <MediaLink className="video-card" href={video.videoURL} title={video.title || label} items={items} target="_blank" rel="noreferrer">{content}</MediaLink>;
}

function VideoGrid({ videos, label, itemLabel }) {
  const [columns, setColumns] = useState(() => window.innerWidth <= 760 ? 2 : 3);

  useEffect(() => {
    const updateColumns = () => setColumns(window.innerWidth <= 760 ? 2 : 3);
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  const pageSize = columns === 2 ? 4 : 3;
  const pages = Array.from({ length: Math.ceil(videos.length / pageSize) }, (_value, index) =>
    videos.slice(index * pageSize, (index + 1) * pageSize)
  );
  const mediaItems = videos
    .filter((video) => video.videoURL)
    .map((video) => ({ src: video.videoURL, title: video.title || itemLabel }));

  return (
    <div className="video-carousel" role="region" aria-label={`${label}, scroll horizontally for more`} tabIndex={0}>
      {pages.map((page, index) => (
        <div className="video-grid-page" key={index}>
          {Array.from({ length: pageSize }, (_value, slot) => {
            const video = page[slot];
            return video
              ? <VideoCard key={video.id || video.publicId || `${index}-${slot}`} video={video} items={mediaItems} label={itemLabel} />
              : <div key={`empty-${slot}`} className="video-card video-card-empty" aria-hidden="true" />;
          })}
        </div>
      ))}
    </div>
  );
}

function hasRenderableContent(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.some(hasRenderableContent);
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, item]) =>
      !['_id', 'id', 'updatedAt'].includes(key) && !/publicId$/i.test(key) && hasRenderableContent(item)
    );
  }
  return false;
}

function PhotoGallery({ gallery }) {
  const photos = gallery.filter((photo) => photo.src);
  const mediaItems = photos.map((photo) => ({ src: photo.src, title: photo.title || photo.alt || 'Photograph' }));

  return (
    <div className="masonry-gallery">
      {photos.map((photo, index) => (
        <MediaTrigger className={`masonry-item aspect-${photo.aspect || 'portrait'}`} src={photo.src} title={photo.title || photo.alt || 'Photograph'} items={mediaItems} key={`${photo.id || photo.publicId || photo.src}-${index}`}>
          <img src={cloudinaryUrl(photo.src, 1000)} alt={photo.alt || photo.title || ''} loading="lazy" />
          {(photo.title || photo.category) && <span className="gallery-caption"><span>{photo.category}</span>{photo.title}</span>}
        </MediaTrigger>
      ))}
    </div>
  );
}

export default function Portfolio({ content, settings, canUse3D, reducedMotion }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hero = content.hero || {};
  const about = content.about || {};
  const proPortfolioUrl = settings.photoSite?.crossLinkToPro ||
    (['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:5173' : '');
  const gallery = (content.gallery || []).filter((item) => item.src);
  const stories = (content.stories || []).filter(hasRenderableContent);
  const reels = (content.reels || []).filter(hasRenderableContent);
  const videos = (content.videos || []).filter(hasRenderableContent);
  const clients = (content.clients || []).filter((client) => client.name || client.logoURL);
  const storyMediaItems = stories
    .filter((story) => story.image)
    .map((story) => ({ src: story.image, title: story.title || 'Story photograph' }));
  const clientMediaItems = clients
    .filter((client) => client.logoURL)
    .map((client) => ({ src: client.logoURL, title: `${client.name} logo` }));
  const sectionSettings = settings.sections?.photo || {};
  const isVisible = (id, hasContent) => hasContent && sectionSettings[id] !== false;
  const galleryVisible = isVisible('gallery', gallery.length > 0);
  const storiesVisible = isVisible('stories', stories.length > 0);
  const reelsVisible = isVisible('reels', reels.length > 0);
  const videosVisible = isVisible('videos', videos.length > 0);
  const clientsVisible = isVisible('clients', clients.length > 0);
  const aboutVisible = isVisible('about', hasRenderableContent(about));
  const contactVisible = sectionSettings.contact !== false;
  const hasScenePhotos = (galleryVisible && gallery.length > 0) ||
    (storiesVisible && stories.some((story) => story.image)) ||
    (aboutVisible && Boolean(about.photoURL));
  const sections = [
    { id: 'home', label: 'Home' },
    ...(galleryVisible ? [{ id: 'gallery', label: content.galleryTitle || 'Gallery' }] : []),
    ...(storiesVisible ? [{ id: 'stories', label: content.storiesTitle || 'Stories' }] : []),
    ...(reelsVisible ? [{ id: 'reels', label: content.reelsTitle || 'Reels' }] : []),
    ...(videosVisible ? [{ id: 'videos', label: content.videosTitle || 'Videos' }] : []),
    ...(clientsVisible ? [{ id: 'clients', label: content.clientsTitle || 'Clients' }] : []),
    ...(aboutVisible ? [{ id: 'about', label: about.openingLine || 'About' }] : []),
    ...(contactVisible ? [{ id: 'contact', label: content.contactTitle || 'Contact' }] : [])
  ];
  const firstSection = sections.find(({ id }) => id !== 'home')?.id || 'home';
  const categoryLists = content.categories || {};
  const projectTypes = [...new Set([
    ...['gallery', 'stories', 'reels', 'videos'].flatMap((section) =>
      Array.isArray(categoryLists[section]) ? categoryLists[section] : []
    ),
    ...gallery.map((item) => item.category),
    ...reels.map((item) => item.category),
    ...videos.map((item) => item.category),
    ...stories.map((item) => item.category)
  ].filter((category) => typeof category === 'string' && category.trim()))];

  return (
    <MediaViewer theme="photo">
      <>
      <header className={`photo-topbar ${mobileMenuOpen ? 'mobile-nav-open' : ''}`}>
        <a className="photo-mark" href="#home" aria-label="Tejas Marthak home">Tejas Marthak</a>
        <nav aria-label="Main navigation">
          {sections.map((section) => <a key={section.id} href={`#${section.id}`} onClick={() => setMobileMenuOpen(false)}>{section.label}</a>)}
        </nav>
        <button className="nav-menu-toggle" type="button" aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <div className="photo-header-actions">
          {proPortfolioUrl && <a className="photo-portfolio-switch" href={proPortfolioUrl}>Developer portfolio <ArrowUpRight size={14} /></a>}
        </div>
      </header>

      <main id="darkroom-journey" className={`photo-journey ${canUse3D ? '' : 'photo-readable'}`}>
        <section id="home" className="photo-section photo-hero" aria-label={hero.tagline || 'Portfolio introduction'} style={hero.bgURL ? { backgroundImage: `linear-gradient(90deg, #0b0907dd, #0b090766), url("${cloudinaryUrl(hero.bgURL, 1800)}")` } : undefined}>
          <motion.div className="photo-hero-copy" initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
            <span className="photo-kicker">{hero.kicker || ''}</span>
            <h1>{hero.tagline || ''}</h1>
            <p>{hero.subtitle || ''}</p>
            <a className="photo-scroll-cue" href={`#${firstSection}`}><ArrowDown size={16} /> Explore the work</a>
          </motion.div>
          {hero.bgURL && <MediaTrigger className="photo-hero-media-trigger" src={hero.bgURL} title="Portfolio cover image">View cover image</MediaTrigger>}
          {hero.bgURL && <img className="hero-asset-preload" src={cloudinaryUrl(hero.bgURL, 1800)} alt="" fetchpriority="high" />}
        </section>

        {galleryVisible && <section id="gallery" className="photo-section" aria-label={content.galleryTitle || 'Gallery'}>
          <div className="photo-section-heading"><span className="photo-kicker">{content.galleryEyebrow || 'Selected frames'}</span><h2>{content.galleryTitle || 'The gallery'}</h2></div>
          <PhotoGallery gallery={gallery} />
        </section>}

        {storiesVisible && <section id="stories" className="photo-section" aria-label={content.storiesTitle || 'Stories'}>
          <div className="photo-section-heading"><span className="photo-kicker">{content.storiesEyebrow || 'Behind the frame'}</span><h2>{content.storiesTitle || 'Stories in light'}</h2></div>
          <div className="stories-list">{stories.map((story, index) => (
            <article className="story-row" key={`${story.title}-${index}`}>
              {story.image && <MediaTrigger className="story-media-trigger" src={story.image} title={story.title || 'Story photograph'} items={storyMediaItems}><img src={cloudinaryUrl(story.image, 900)} alt={story.title || ''} loading="lazy" /></MediaTrigger>}
              <div><span className="photo-kicker">{story.category || ''}</span><h3>{story.title || ''}</h3><p>{story.story || ''}</p></div>
            </article>
          ))}</div>
        </section>}

        {reelsVisible && <section id="reels" className="photo-section" aria-label={content.reelsTitle || 'Reels'}>
          <div className="photo-section-heading"><span className="photo-kicker">{content.reelsEyebrow || 'Short films'}</span><h2>{content.reelsTitle || 'Reels'}</h2></div>
          <VideoGrid videos={reels} label="Reels" itemLabel="Reel" />
        </section>}

        {videosVisible && <section id="videos" className="photo-section" aria-label={content.videosTitle || 'Video projects'}>
          <div className="photo-section-heading"><span className="photo-kicker">{content.videosEyebrow || 'Motion studies'}</span><h2>{content.videosTitle || 'Moving stories'}</h2></div>
          <VideoGrid videos={videos} label="Video projects" itemLabel="Video project" />
        </section>}

        {clientsVisible && <section id="clients" className="clients-section" aria-label={content.clientsTitle || 'Clients'}>
          <div className="photo-section-heading">
            <span className="photo-kicker">{content.clientsEyebrow || 'Selected collaborators'}</span>
            <h2>{content.clientsTitle || 'Clients'}</h2>
          </div>
          <div className="client-track">{clients.map((client, index) => (
            <div className="client-item" key={`${client.id || client.name || 'client'}-${index}`}>
              {client.logoURL && <MediaTrigger className="client-logo-trigger" src={client.logoURL} title={`${client.name || 'Client'} logo`} items={clientMediaItems}><img src={cloudinaryUrl(client.logoURL, 260)} alt={client.name || 'Client logo'} loading="lazy" /></MediaTrigger>}
              {client.name && <span className="client-name">{client.name}</span>}
            </div>
          ))}</div>
        </section>}

        {aboutVisible && <section id="about" className="photo-section about-section" aria-label={about.title || content.aboutTitle || about.openingLine || 'About'}>
          <div className={`about-photo-copy ${about.photoURL ? 'has-photo' : 'without-photo'}`}>
            {about.photoURL && <MediaTrigger className="about-media-trigger" src={about.photoURL} title={about.photoAlt || 'About photo'}><img src={cloudinaryUrl(about.photoURL, 1000)} alt={about.photoAlt || ''} loading="lazy" /></MediaTrigger>}
            <div>
              {about.openingLine && about.openingLine !== (about.title || content.aboutTitle || 'About') && <span className="photo-kicker">{about.openingLine}</span>}
              <h2>{about.title || content.aboutTitle || 'About'}</h2>
              {about.bio && <p>{about.bio}</p>}
              {!!about.gear?.length && <ul>{about.gear.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>}
              {about.availability && <p className="availability">{about.availability}</p>}
            </div>
          </div>
        </section>}

        {canUse3D && !reducedMotion && contactVisible && hasScenePhotos && <div className="photo-scene-runway" aria-hidden="true" />}
        {contactVisible && <section id="contact" className="photo-section photo-contact-section" aria-label={content.contactTitle || 'Contact'}>
          <div className="photo-section-heading"><span className="photo-kicker">{content.contactEyebrow || ''}</span><h2>{content.contactTitle || 'Let’s create something'}</h2></div>
          <ContactForm projectTypes={projectTypes} />
          <SiteContactDetails contact={settings.contact} social={settings.social} className="photo-contact-meta" />
        </section>}
      </main>
      <footer className="photo-footer">
        <span>© {new Date().getFullYear()} Tejas. All rights reserved.</span>
        {settings.photoSite?.crossLinkToPro && <a href={settings.photoSite.crossLinkToPro}>Developer portfolio <ArrowUpRight size={14} /></a>}
      </footer>
      </>
    </MediaViewer>
  );
}
