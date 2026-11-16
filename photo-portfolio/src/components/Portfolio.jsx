import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { ArrowDown, ArrowUpRight, Play } from 'lucide-react';
import { cloudinaryUrl } from '../api';
import ContactForm from './ContactForm';

function Showreel({ showreel }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showreel.videoURL) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    }, { threshold: 0.35 });
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [showreel.videoURL]);

  if (!showreel.videoURL) return null;
  return (
    <div className="showreel-frame">
      <video ref={videoRef} src={showreel.videoURL} poster={cloudinaryUrl(showreel.poster, 1600)} controls muted playsInline preload="none" aria-label="Portfolio showreel" />
    </div>
  );
}

function PhotoGallery({ gallery }) {
  const [index, setIndex] = useState(-1);
  const photos = gallery.filter((photo) => photo.src);
  const slides = photos.map((photo) => ({ src: photo.src, alt: photo.alt || photo.title || '' }));

  return (
    <>
      <div className="masonry-gallery">
        {photos.map((photo, photoIndex) => (
          <button type="button" className={`masonry-item aspect-${photo.aspect || 'portrait'}`} key={photo.id || photo.publicId || photo.src} onClick={() => setIndex(photoIndex)} aria-label={photo.title || photo.alt || 'Open photograph'}>
            <img src={cloudinaryUrl(photo.src, 1000)} alt={photo.alt || photo.title || ''} loading="lazy" />
            {(photo.title || photo.category) && <span className="gallery-caption"><span>{photo.category}</span>{photo.title}</span>}
          </button>
        ))}
      </div>
      <Lightbox open={index >= 0} index={index} slides={slides} close={() => setIndex(-1)} />
    </>
  );
}

export default function Portfolio({ content, settings, showAsPage, canUse3D, setShowAsPage }) {
  const hero = content.hero || {};
  const about = content.about || {};
  const seo = content.seo || {};
  const gallery = content.gallery || [];
  const projectTypes = [...new Set([
    ...gallery.map((item) => item.category),
    ...(content.videos || []).map((item) => item.category),
    ...(content.stories || []).map((item) => item.category)
  ].filter(Boolean))];

  return (
    <>
      <header className="photo-topbar">
        <a className="photo-mark" href="#home" aria-label={hero.tagline || 'Home'}>{hero.tagline?.split(' ')[0] || '•'}</a>
        <nav aria-label="Main navigation">
          <a href="#gallery">{content.galleryTitle || 'Gallery'}</a>
          <a href="#stories">{content.storiesTitle || 'Stories'}</a>
          <a href="#about">{about.openingLine || 'About'}</a>
          <a href="#contact">{content.contactTitle || 'Contact'}</a>
        </nav>
        {canUse3D && <button className="photo-view-toggle" type="button" onClick={() => setShowAsPage(!showAsPage)}>{showAsPage ? 'Enter the light field' : 'View as page'}</button>}
      </header>

      <main id="darkroom-journey" className={`photo-journey ${showAsPage ? 'photo-readable' : ''}`}>
        <section id="home" className="photo-section photo-hero" aria-label={hero.tagline || 'Portfolio introduction'} style={hero.bgURL ? { backgroundImage: `linear-gradient(90deg, #0b0907dd, #0b090766), url("${cloudinaryUrl(hero.bgURL, 1800)}")` } : undefined}>
          <motion.div className="photo-hero-copy" initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
            <span className="photo-kicker">{hero.kicker || ''}</span>
            <h1>{hero.tagline || ''}</h1>
            <p>{hero.subtitle || ''}</p>
            <a className="photo-scroll-cue" href="#gallery"><ArrowDown size={16} /> Explore the work</a>
          </motion.div>
          {hero.bgURL && <img className="hero-asset-preload" src={cloudinaryUrl(hero.bgURL, 1800)} alt="" fetchPriority="high" />}
        </section>

        <section id="gallery" className="photo-section" aria-label={content.galleryTitle || 'Gallery'}>
          <div className="photo-section-heading"><span className="photo-kicker">{content.galleryEyebrow || 'Selected frames'}</span><h2>{content.galleryTitle || 'The gallery'}</h2></div>
          <PhotoGallery gallery={gallery} />
        </section>

        <section id="stories" className="photo-section" aria-label={content.storiesTitle || 'Stories'}>
          <div className="photo-section-heading"><span className="photo-kicker">{content.storiesEyebrow || 'Behind the frame'}</span><h2>{content.storiesTitle || 'Stories in light'}</h2></div>
          <div className="stories-list">{(content.stories || []).map((story, index) => (
            <article className="story-row" key={`${story.title}-${index}`}>
              {story.image && <img src={cloudinaryUrl(story.image, 900)} alt={story.title || ''} loading="lazy" />}
              <div><span className="photo-kicker">{story.category || ''}</span><h3>{story.title || ''}</h3><p>{story.story || ''}</p></div>
            </article>
          ))}</div>
        </section>

        <section id="showreel" className="photo-section photo-reel-section" aria-label={content.showreelTitle || 'Showreel'}>
          <div className="photo-section-heading"><span className="photo-kicker">{content.showreelEyebrow || 'Moving images'}</span><h2>{content.showreelTitle || 'Showreel'}</h2></div>
          <Showreel showreel={content.showreel || {}} />
        </section>

        <section id="videos" className="photo-section" aria-label={content.videosTitle || 'Video projects'}>
          <div className="photo-section-heading"><span className="photo-kicker">{content.videosEyebrow || 'Motion studies'}</span><h2>{content.videosTitle || 'Moving stories'}</h2></div>
          <div className="video-grid">{(content.videos || []).map((video) => (
            <a className="video-card" href={video.videoURL || '#videos'} key={video.id || video.title} target={video.videoURL ? '_blank' : undefined} rel={video.videoURL ? 'noreferrer' : undefined}>
              {video.thumb && <img src={cloudinaryUrl(video.thumb, 1000)} alt="" loading="lazy" />}
              <span className="video-play"><Play size={16} fill="currentColor" /></span>
              <span className="video-title">{video.category && <small>{video.category}</small>}{video.title}</span>
            </a>
          ))}</div>
        </section>

        {!!content.clients?.length && <section className="clients-section" aria-label={content.clientsTitle || 'Clients'}><span className="photo-kicker">{content.clientsTitle || ''}</span><div className="client-track">{content.clients.map((client) => <div key={client.name}>{client.logoURL ? <img src={cloudinaryUrl(client.logoURL, 260)} alt={client.name} loading="lazy" /> : <span>{client.name}</span>}</div>)}</div></section>}

        <section id="about" className="photo-section about-section" aria-label={about.openingLine || 'About'}>
          <div className="about-photo-copy">
            {about.photoURL && <img src={cloudinaryUrl(about.photoURL, 1000)} alt={about.photoAlt || ''} loading="lazy" />}
            <div><span className="photo-kicker">{about.openingLine || ''}</span><h2>{content.aboutTitle || ''}</h2><p>{about.bio || ''}</p><ul>{(about.gear || []).map((item) => <li key={item}>{item}</li>)}</ul>{about.availability && <p className="availability">{about.availability}</p>}</div>
          </div>
        </section>

        <section id="contact" className="photo-section photo-contact-section" aria-label={content.contactTitle || 'Contact'}>
          <div className="photo-section-heading"><span className="photo-kicker">{content.contactEyebrow || ''}</span><h2>{content.contactTitle || 'Let’s create something'}</h2></div>
          <ContactForm projectTypes={projectTypes} />
          <div className="photo-contact-meta">{settings.contact?.email && <a href={`mailto:${settings.contact.email}`}>{settings.contact.email}</a>}{settings.contact?.location && <span>{settings.contact.location}</span>}</div>
        </section>
      </main>
      <footer className="photo-footer">
        <span>{seo.title || hero.tagline || ''}</span>
        <div>{Object.entries(settings.social || {}).filter(([, value]) => value).map(([name, value]) => <a href={value} key={name} target="_blank" rel="noreferrer">{name}</a>)}</div>
        {settings.photoSite?.crossLinkToPro && <a href={settings.photoSite.crossLinkToPro}>Developer portfolio <ArrowUpRight size={14} /></a>}
      </footer>
    </>
  );
}
