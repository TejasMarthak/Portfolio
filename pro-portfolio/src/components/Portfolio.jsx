import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowUpRight, ExternalLink, FileText, Github, Menu, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cloudinaryUrl } from '../api';
import { cloudinaryBackgroundRemovalUrl } from '../../../shared/cloudinaryBackgroundRemoval.js';
import MediaViewer, { MediaLink, MediaTrigger } from '../../../shared/MediaViewer.jsx';
import SiteContactDetails from '../../../shared/SiteContactDetails.jsx';
import ContactForm from './ContactForm';

function Section({ id, title, eyebrow, children, className = '' }) {
  const sectionRef = useRef(null);
  const panelRef = useRef(null);
  const contentRef = useRef(null);
  const [panelOverflow, setPanelOverflow] = useState(0);
  const reducedMotion = Boolean(useReducedMotion());
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -panelOverflow]);

  useEffect(() => {
    const panel = panelRef.current;
    const content = contentRef.current;
    if (!panel || !content) return undefined;

    const measureOverflow = () => {
      const style = window.getComputedStyle(panel);
      const availableHeight = panel.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      setPanelOverflow(Math.max(0, content.scrollHeight - availableHeight));
    };

    measureOverflow();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measureOverflow);
    observer?.observe(panel);
    observer?.observe(content);
    window.addEventListener('resize', measureOverflow);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measureOverflow);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id={id}
      className={`journey-section ${className}`}
      aria-label={title || eyebrow}
      style={{ '--panel-overflow': `${panelOverflow}px` }}
    >
      <div className="section-panel-stage">
        <div ref={panelRef} className="section-panel">
          <motion.div
            ref={contentRef}
            className="section-panel-content"
            style={reducedMotion ? undefined : { y: contentY }}
            initial={reducedMotion ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.05 }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {(eyebrow || title) && (
              <div className="section-panel-heading">
                {eyebrow && <p className="eyebrow"><span />{eyebrow}</p>}
                {title && <h2>{title}</h2>}
              </div>
            )}
            {children}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function TypingWords({ words }) {
  const [text, setText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || words.length < 2) {
      setText(words[0] || '');
      return undefined;
    }

    let active = true;
    let currentIndex = 0;
    let characterIndex = 0;
    let deleting = false;
    let timeout;
    const tick = () => {
      if (!active) return;
      const currentWord = words[currentIndex];
      if (deleting) {
        characterIndex -= 1;
        setText(currentWord.slice(0, Math.max(0, characterIndex)));
      } else {
        characterIndex += 1;
        setText(currentWord.slice(0, characterIndex));
      }

      if (!deleting && characterIndex >= currentWord.length) {
        deleting = true;
        timeout = window.setTimeout(tick, 1200);
        return;
      }
      if (deleting && characterIndex <= 0) {
        deleting = false;
        currentIndex = (currentIndex + 1) % words.length;
        setWordIndex(currentIndex);
      }
      timeout = window.setTimeout(tick, deleting ? 38 : 75);
    };

    timeout = window.setTimeout(tick, 450);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [reducedMotion, words]);

  if (!words.length) return null;
  return <p className="typing-line" aria-label={words.join(', ')}><span aria-hidden="true">{text}</span><span className="typing-cursor" aria-hidden="true">|</span><span className="sr-only">{words[wordIndex]}</span></p>;
}

function Project({ project }) {
  return (
    <article className="project-card">
      {project.imageURL && <MediaTrigger className="project-media-trigger" src={project.imageURL} title={project.title || 'Project image'}><img src={cloudinaryUrl(project.imageURL, 900)} alt={project.title || ''} loading="lazy" /></MediaTrigger>}
      <div className="project-copy">
        <div className="project-heading"><h3>{project.title}</h3>{project.featured && <Sparkles size={16} aria-label="Featured" />}</div>
        <p>{project.desc}</p>
        <ul className="tag-list">{[...new Set([...(project.tags || []), ...(project.skills || [])])].map((tag) => <li key={tag}>{tag}</li>)}</ul>
        <div className="project-links">
          {project.liveURL && <MediaLink href={project.liveURL} title={`${project.title || 'Project'} live media`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Live</MediaLink>}
          {project.githubURL && <MediaLink href={project.githubURL} title={`${project.title || 'Project'} source`} target="_blank" rel="noreferrer"><Github size={15} /> Source</MediaLink>}
        </div>
      </div>
    </article>
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

export default function Portfolio({ content, settings, canUse3D }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [portraitFallbackKey, setPortraitFallbackKey] = useState('');
  const heroRef = useRef(null);
  const reducedMotion = Boolean(useReducedMotion());
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end end'] });
  const heroCopyOpacity = useTransform(scrollYProgress, [0, 0.58, 1], [1, 1, 0]);
  const heroCopyY = useTransform(scrollYProgress, [0, 0.58, 1], [0, 0, -30]);
  const portraitScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const portraitOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.78]);
  const hero = content.hero || {};
  const about = content.about || {};
  const resume = content.resume || {};
  const hobby = content.hobby || {};
  const photoPortfolioUrl = settings.proSite?.crossLinkToPhoto ||
    (['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:5174' : '');
  const sectionSettings = settings.sections?.pro || {};
  const isVisible = (id, hasContent) => hasContent && sectionSettings[id] !== false;
  const aboutVisible = isVisible('about', hasRenderableContent(about));
  const skillsVisible = isVisible('skills', hasRenderableContent(content.skills));
  const projectsVisible = isVisible('projects', hasRenderableContent(content.projects));
  const hobbyVisible = isVisible('hobby', hasRenderableContent(hobby));
  const contactVisible = sectionSettings.contact !== false;
  const transformedPortrait = hero.removePhotoBackground
    ? cloudinaryBackgroundRemovalUrl(hero.photoURL, 1200)
    : '';
  const backgroundRemovalEnabled = Boolean(transformedPortrait && transformedPortrait !== hero.photoURL);
  const portraitKey = `${hero.photoURL || ''}:${Boolean(hero.removePhotoBackground)}`;
  const portraitTransformFailed = portraitFallbackKey === portraitKey;
  const portraitUrl = backgroundRemovalEnabled && !portraitTransformFailed
    ? transformedPortrait
    : cloudinaryUrl(hero.photoURL, 1000);
  const sections = [
    { id: 'home', label: 'Home' },
    ...(aboutVisible ? [{ id: 'about', label: about.title || 'About' }] : []),
    ...(skillsVisible ? [{ id: 'skills', label: content.skillsTitle || 'Skills' }] : []),
    ...(projectsVisible ? [{ id: 'projects', label: content.projectsTitle || 'Projects' }] : []),
    ...(hobbyVisible ? [{ id: 'hobby', label: hobby.title || 'Beyond the code' }] : []),
    ...(contactVisible ? [{ id: 'contact', label: content.contactTitle || 'Contact' }] : [])
  ];
  const firstSection = sections.find(({ id }) => id !== 'home')?.id || 'home';

  return (
    <MediaViewer theme="pro">
      <>
      <header className={`topbar ${mobileMenuOpen ? 'mobile-nav-open' : ''}`}>
        <a className="wordmark" href="#home" aria-label="Tejas Marthak home">Tejas Marthak</a>
        <nav aria-label="Main navigation">
          {sections.map((section) => <a key={section.id} href={`#${section.id}`} onClick={() => setMobileMenuOpen(false)}>{section.label}</a>)}
        </nav>
        <button className="nav-menu-toggle" type="button" aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <div className="header-actions">
          {photoPortfolioUrl && <a className="portfolio-switch" href={photoPortfolioUrl}>Photo portfolio <ArrowUpRight size={14} /></a>}
        </div>
      </header>

      <main id="journey" className={canUse3D ? 'journey' : 'journey journey-readable'}>
        <section
          ref={heroRef}
          id="home"
          className={`journey-section hero-section${hero.photoURL ? ' hero-section-with-photo' : ''}${reducedMotion ? ' hero-section-reduced' : ''}`}
          aria-label={hero.headline || 'Portfolio introduction'}
        >
          <div className="hero-stage">
            {hero.photoURL && (
              <motion.figure className="hero-portrait-frame" style={reducedMotion ? undefined : { scale: portraitScale, opacity: portraitOpacity }}>
                <img
                  className="hero-portrait"
                  src={portraitUrl}
                  alt={hero.photoAlt || hero.headline || ''}
                  loading="eager"
                  fetchpriority="high"
                  onError={backgroundRemovalEnabled && !portraitTransformFailed ? () => {
                    console.warn('[pro-hero] Cloudinary background removal failed; showing the original portrait.');
                    setPortraitFallbackKey(portraitKey);
                  } : undefined}
                />
              </motion.figure>
            )}
            <motion.div className="hero-copy" style={reducedMotion ? undefined : { opacity: heroCopyOpacity, y: heroCopyY }}>
              <p className="eyebrow"><span />{hero.eyebrow || 'Independent developer'}</p>
              <h1>{hero.headline || ''}<span className="hero-period">.</span></h1>
              <p className="hero-subtitle">{hero.subheadline || ''}</p>
              <TypingWords words={hero.typingWords || []} />
              <div className="hero-actions">
                {hero.cta1?.url && <MediaLink className="button button-primary" href={hero.cta1.url} title={hero.cta1.text || 'Portfolio media'}>{hero.cta1.text || ''}<ArrowUpRight size={17} /></MediaLink>}
                {hero.cta2?.url && <MediaLink className="button button-quiet" href={hero.cta2.url} title={hero.cta2.text || 'Portfolio media'}>{hero.cta2.text || ''}</MediaLink>}
                {hero.showResumeButton !== false && resume.fileURL && (
                  <MediaLink className="button button-quiet resume-button" href={resume.fileURL} title="Resume">
                    <FileText size={16} />{hero.resumeButtonText || 'View resume'}
                  </MediaLink>
                )}
              </div>
              <a className="scroll-cue" href={`#${firstSection}`}><ArrowDown size={16} /> Scroll to explore</a>
            </motion.div>
            <div className="hero-coordinate" aria-hidden="true"><span>01</span><i /></div>
          </div>
        </section>

        {aboutVisible && <Section id="about" title={about.title || 'About'} eyebrow={about.eyebrow || 'A little context'}>
          <div className="about-layout">
            {about.photoURL && <MediaTrigger className="about-media-trigger" src={about.photoURL} title={about.photoAlt || 'About photo'}><img className="about-photo" src={cloudinaryUrl(about.photoURL, 700)} alt={about.photoAlt || ''} loading="lazy" /></MediaTrigger>}
            <div className="about-copy">
              <p className="large-copy">{about.bio || ''}</p>
              <div className="stats-row">{(about.stats || []).map((stat, index) => <div key={`${stat.label}-${index}`}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>
              <ul className="tag-list">{(about.tags || []).map((tag) => <li key={tag}>{tag}</li>)}</ul>
            </div>
          </div>
        </Section>}

        {skillsVisible && <Section id="skills" title={content.skillsTitle || 'Skills'} eyebrow={content.skillsEyebrow || 'Tools for the work'}>
          <div className="skills-orbit">
            {(content.skills || []).map((category, index) => (
              <article className={`skill-cluster cluster-${index % 3}`} key={`${category.category}-${index}`}>
                <h3>{category.category}</h3>
                <div>{(category.items || []).map((skill, skillIndex) => <span className="skill-node" key={`${skill.name}-${skillIndex}`}>{skill.name}</span>)}</div>
              </article>
            ))}
          </div>
        </Section>}

        {projectsVisible && <Section id="projects" title={content.projectsTitle || 'Projects'} eyebrow={content.projectsEyebrow || 'Selected work'}>
          <div className="project-grid">{(content.projects || []).map((project, index) => <Project key={project.id || `${project.title || 'project'}-${index}`} project={project} />)}</div>
        </Section>}

        {hobbyVisible && <Section id="hobby" title={hobby.title || 'Beyond the code'} eyebrow={hobby.subtitle || ''}>
          <div className="hobby-layout">
            {(hobby.photos || []).map((photo, index) => (
              <figure key={`${photo.publicId || photo.src || photo.caption || 'photo'}-${index}`}>
                <MediaTrigger className="hobby-media-trigger" src={photo.src} title={photo.caption || 'Hobby photo'}><img src={cloudinaryUrl(photo.src, 850)} alt={photo.caption || ''} loading="lazy" /></MediaTrigger>
                {photo.caption && <figcaption>{photo.caption}</figcaption>}
              </figure>
            ))}
            {hobby.ctaURL && <MediaLink className="button button-primary hobby-link" href={hobby.ctaURL} title={hobby.ctaText || 'Hobby media'}>{hobby.ctaText || ''}<ArrowUpRight size={17} /></MediaLink>}
          </div>
        </Section>}

        {contactVisible && <Section id="contact" title={content.contactTitle || 'Let’s make something'} eyebrow={content.contactEyebrow || 'Have a good one in mind?'}>
          <ContactForm />
          <SiteContactDetails contact={settings.contact} social={settings.social} className="contact-meta" />
          <footer className="site-footer">
            <span>© {new Date().getFullYear()} Tejas. All rights reserved.</span>
            {settings.proSite?.crossLinkToPhoto && <a href={settings.proSite.crossLinkToPhoto}>More work <ArrowUpRight size={14} /></a>}
          </footer>
        </Section>}
      </main>
    </>
    </MediaViewer>
  );
}
