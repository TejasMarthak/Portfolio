import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUpRight, ExternalLink, Github, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cloudinaryUrl } from '../api';
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
      {project.imageURL && <img src={cloudinaryUrl(project.imageURL, 900)} alt={project.title || ''} loading="lazy" />}
      <div className="project-copy">
        <div className="project-heading"><h3>{project.title}</h3>{project.featured && <Sparkles size={16} aria-label="Featured" />}</div>
        <p>{project.desc}</p>
        <ul className="tag-list">{(project.tags || []).map((tag) => <li key={tag}>{tag}</li>)}</ul>
        <div className="project-links">
          {project.liveURL && <a href={project.liveURL} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Live</a>}
          {project.githubURL && <a href={project.githubURL} target="_blank" rel="noreferrer"><Github size={15} /> Source</a>}
        </div>
      </div>
    </article>
  );
}

export default function Portfolio({ content, settings, showAsPage, setShowAsPage }) {
  const hero = content.hero || {};
  const about = content.about || {};
  const hobby = content.hobby || {};
  const seo = content.seo || {};
  const sections = [
    { id: 'about', label: about.title || 'About' },
    { id: 'skills', label: content.skillsTitle || 'Skills' },
    { id: 'projects', label: content.projectsTitle || 'Projects' },
    { id: 'hobby', label: hobby.title || 'Beyond the code' },
    { id: 'contact', label: content.contactTitle || 'Contact' }
  ];

  return (
    <>
      <header className="topbar">
        <a className="wordmark" href="#home" aria-label={hero.headline || 'Home'}>{hero.headline?.split(' ')[0] || '•'}</a>
        <nav aria-label="Main navigation">
          {sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}
        </nav>
        <button className="view-toggle" type="button" onClick={() => setShowAsPage(!showAsPage)}>
          {showAsPage ? 'Enter the build plane' : 'View as page'}
        </button>
      </header>

      <main id="journey" className={showAsPage ? 'journey journey-readable' : 'journey'}>
        <section id="home" className="journey-section hero-section" aria-label={hero.headline || 'Portfolio introduction'}>
          <motion.div className="hero-copy" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}>
            <p className="eyebrow"><span />{hero.eyebrow || 'Independent developer'}</p>
            <h1>{hero.headline || ''}<span className="hero-period">.</span></h1>
            <p className="hero-subtitle">{hero.subheadline || ''}</p>
            <TypingWords words={hero.typingWords || []} />
            <div className="hero-actions">
              {hero.cta1?.url && <a className="button button-primary" href={hero.cta1.url}>{hero.cta1.text || ''}<ArrowUpRight size={17} /></a>}
              {hero.cta2?.url && <a className="button button-quiet" href={hero.cta2.url}>{hero.cta2.text || ''}</a>}
            </div>
            <a className="scroll-cue" href="#about"><ArrowDown size={16} /> Scroll to explore</a>
          </motion.div>
          <div className="hero-coordinate" aria-hidden="true"><span>01</span><i /></div>
        </section>

        <Section id="about" title={about.title || 'About'} eyebrow={about.eyebrow || 'A little context'}>
          <div className="about-layout">
            {about.photoURL && <img className="about-photo" src={cloudinaryUrl(about.photoURL, 700)} alt={about.photoAlt || ''} loading="lazy" />}
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
                <img src={cloudinaryUrl(photo.src, 850)} alt={photo.caption || ''} loading="lazy" />
                {photo.caption && <figcaption>{photo.caption}</figcaption>}
              </figure>
            ))}
            {hobby.ctaURL && <a className="button button-primary hobby-link" href={hobby.ctaURL}>{hobby.ctaText || ''}<ArrowUpRight size={17} /></a>}
          </div>
        </Section>

        <Section id="contact" title={content.contactTitle || 'Let’s make something'} eyebrow={content.contactEyebrow || 'Have a good one in mind?'}>
          <ContactForm />
          <div className="contact-meta">
            {settings.contact?.email && <a href={`mailto:${settings.contact.email}`}>{settings.contact.email}</a>}
            {settings.contact?.location && <span>{settings.contact.location}</span>}
          </div>
        </Section>
      </main>
      <footer className="site-footer">
        <span>{seo.title || hero.headline || ''}</span>
        <div>{Object.entries(settings.social || {}).filter(([, value]) => value).map(([name, value]) => <a key={name} href={value} target="_blank" rel="noreferrer">{name}</a>)}</div>
        {settings.proSite?.crossLinkToPhoto && <a href={settings.proSite.crossLinkToPhoto}>More work <ArrowUpRight size={14} /></a>}
      </footer>
    </>
  );
}
