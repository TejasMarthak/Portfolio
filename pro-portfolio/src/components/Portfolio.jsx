import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUpRight, ExternalLink, FileText, Github, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cloudinaryUrl } from '../api';
import MediaViewer, { MediaLink, MediaTrigger } from '../../../shared/MediaViewer.jsx';
import SiteContactDetails, { SocialLinks } from '../../../shared/SiteContactDetails.jsx';
import ContactForm from './ContactForm';

function Section({ id, title, eyebrow, children, className = '' }) {
  return (
    <section id={id} className={`journey-section ${className}`} aria-label={title || eyebrow}>
      <motion.div
        className="section-panel"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {eyebrow && <p className="eyebrow"><span />{eyebrow}</p>}
        {title && <h2>{title}</h2>}
        {children}
      </motion.div>
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
        <ul className="tag-list">{(project.tags || []).map((tag) => <li key={tag}>{tag}</li>)}</ul>
        <div className="project-links">
          {project.liveURL && <MediaLink href={project.liveURL} title={`${project.title || 'Project'} live media`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Live</MediaLink>}
          {project.githubURL && <MediaLink href={project.githubURL} title={`${project.title || 'Project'} source`} target="_blank" rel="noreferrer"><Github size={15} /> Source</MediaLink>}
        </div>
      </div>
    </article>
  );
}

function getSafeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export default function Portfolio({ content, settings, showAsPage, setShowAsPage }) {
  const hero = content.hero || {};
  const about = content.about || {};
  const hobby = content.hobby || {};
  const seo = content.seo || {};
  const photoPortfolioUrl = settings.proSite?.crossLinkToPhoto ||
    (['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:5174' : '');
  const resumeUrl = getSafeExternalUrl(content.resume?.fileURL);
  const sections = [
    { id: 'about', label: about.title || 'About' },
    { id: 'skills', label: content.skillsTitle || 'Skills' },
    { id: 'projects', label: content.projectsTitle || 'Projects' },
    { id: 'hobby', label: hobby.title || 'Beyond the code' },
    { id: 'contact', label: content.contactTitle || 'Contact' }
  ];

  return (
    <MediaViewer theme="pro">
      <>
      <header className="topbar">
        <a className="wordmark" href="#home" aria-label={hero.headline || 'Home'}>{hero.headline?.split(' ')[0] || '•'}</a>
        <nav aria-label="Main navigation">
          {sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}
        </nav>
        <div className="header-actions">
          {photoPortfolioUrl && <a className="portfolio-switch" href={photoPortfolioUrl}>Photo portfolio <ArrowUpRight size={14} /></a>}
          <button className="view-toggle" type="button" onClick={() => setShowAsPage(!showAsPage)}>
            {showAsPage ? 'Enter the build plane' : 'View as page'}
          </button>
        </div>
      </header>

      <main id="journey" className={showAsPage ? 'journey journey-readable' : 'journey'}>
        <section id="home" className="journey-section hero-section" aria-label={hero.headline || 'Portfolio introduction'}>
          <motion.div className="hero-copy" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}>
            <p className="eyebrow"><span />{hero.eyebrow || 'Independent developer'}</p>
            <h1>{hero.headline || ''}<span className="hero-period">.</span></h1>
            <p className="hero-subtitle">{hero.subheadline || ''}</p>
            <TypingWords words={hero.typingWords || []} />
            <div className="hero-actions">
              {hero.cta1?.url && <MediaLink className="button button-primary" href={hero.cta1.url} title={hero.cta1.text || 'Portfolio media'}>{hero.cta1.text || ''}<ArrowUpRight size={17} /></MediaLink>}
              {hero.cta2?.url && <MediaLink className="button button-quiet" href={hero.cta2.url} title={hero.cta2.text || 'Portfolio media'}>{hero.cta2.text || ''}</MediaLink>}
              {resumeUrl && <MediaTrigger className="button button-quiet resume-button" src={resumeUrl} type="pdf" title="Resume"><FileText size={16} />View resume</MediaTrigger>}
            </div>
            <a className="scroll-cue" href="#about"><ArrowDown size={16} /> Scroll to explore</a>
          </motion.div>
          <div className="hero-coordinate" aria-hidden="true"><span>01</span><i /></div>
        </section>

        <Section id="about" title={about.title || 'About'} eyebrow={about.eyebrow || 'A little context'}>
          <div className="about-layout">
            {about.photoURL && <MediaTrigger className="about-media-trigger" src={about.photoURL} title={about.photoAlt || 'About photo'}><img className="about-photo" src={cloudinaryUrl(about.photoURL, 700)} alt={about.photoAlt || ''} loading="lazy" /></MediaTrigger>}
            <div className="about-copy">
              <p className="large-copy">{about.bio || ''}</p>
              <div className="stats-row">{(about.stats || []).map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>
              <ul className="tag-list">{(about.tags || []).map((tag) => <li key={tag}>{tag}</li>)}</ul>
            </div>
          </div>
        </Section>

        <Section id="skills" title={content.skillsTitle || 'Skills'} eyebrow={content.skillsEyebrow || 'Tools for the work'}>
          <div className="skills-orbit">
            {(content.skills || []).map((category, index) => (
              <article className={`skill-cluster cluster-${index % 3}`} key={`${category.category}-${index}`}>
                <h3>{category.category}</h3>
                <div>{(category.items || []).map((skill) => <span className="skill-node" key={skill.name}>{skill.name}</span>)}</div>
              </article>
            ))}
          </div>
        </Section>

        <Section id="projects" title={content.projectsTitle || 'Projects'} eyebrow={content.projectsEyebrow || 'Selected work'}>
          <div className="project-grid">{(content.projects || []).map((project) => <Project key={project.id || project.title} project={project} />)}</div>
        </Section>

        <Section id="hobby" title={hobby.title || 'Beyond the code'} eyebrow={hobby.subtitle || ''}>
          <div className="hobby-layout">
            {(hobby.photos || []).slice(0, 3).map((photo) => (
              <figure key={photo.publicId || photo.src}>
                <MediaTrigger className="hobby-media-trigger" src={photo.src} title={photo.caption || 'Hobby photo'}><img src={cloudinaryUrl(photo.src, 850)} alt={photo.caption || ''} loading="lazy" /></MediaTrigger>
                {photo.caption && <figcaption>{photo.caption}</figcaption>}
              </figure>
            ))}
            {hobby.ctaURL && <MediaLink className="button button-primary hobby-link" href={hobby.ctaURL} title={hobby.ctaText || 'Hobby media'}>{hobby.ctaText || ''}<ArrowUpRight size={17} /></MediaLink>}
          </div>
        </Section>

        <Section id="contact" title={content.contactTitle || 'Let’s make something'} eyebrow={content.contactEyebrow || 'Have a good one in mind?'}>
          <ContactForm />
        <SiteContactDetails contact={settings.contact} social={settings.social} className="contact-meta" />
        </Section>
      </main>
      <footer className="site-footer">
        <span>{seo.title || hero.headline || ''}</span>
      <SocialLinks social={settings.social} className="site-footer-socials" />
        {settings.proSite?.crossLinkToPhoto && <a href={settings.proSite.crossLinkToPhoto}>More work <ArrowUpRight size={14} /></a>}
      </footer>
    </>
    </MediaViewer>
  );
}
