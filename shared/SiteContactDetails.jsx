import {
  AtSign, BookOpen, Dribbble, Facebook, Github, Globe2, Instagram, Linkedin,
  Mail, MapPin, MessageCircle, Music2, Palette, Phone, Pin, Send, Twitch, Twitter, Youtube
} from 'lucide-react';

const socialIcons = {
  instagram: Instagram,
  facebook: Facebook,
  github: Github,
  linkedin: Linkedin,
  youtube: Youtube,
  twitter: Twitter,
  x: Twitter,
  twitch: Twitch,
  dribbble: Dribbble,
  behance: Palette,
  pinterest: Pin,
  tiktok: Music2,
  threads: AtSign,
  telegram: Send,
  whatsapp: MessageCircle,
  medium: BookOpen
};
const socialHosts = [
  ['youtube.com', 'youtube'], ['youtu.be', 'youtube'], ['x.com', 'x'], ['twitter.com', 'twitter'],
  ['twitch.tv', 'twitch'], ['behance.net', 'behance'], ['threads.net', 'threads'],
  ['tiktok.com', 'tiktok'], ['pinterest.com', 'pinterest'], ['linkedin.com', 'linkedin'],
  ['instagram.com', 'instagram'], ['facebook.com', 'facebook'], ['github.com', 'github'],
  ['dribbble.com', 'dribbble'], ['medium.com', 'medium'], ['t.me', 'telegram'], ['wa.me', 'whatsapp']
];

function socialIcon(name, url) {
  const key = name.toLowerCase().replace(/[^a-z]/g, '');
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  })();
  const fromHost = socialHosts.find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1];
  return socialIcons[key] || socialIcons[fromHost] || Globe2;
}

export function getEnabledSocialLinks(social = {}) {
  return Object.entries(social).flatMap(([name, value]) => {
    const url = typeof value === 'string' ? value : value?.url;
    if (!url || (typeof value === 'object' && value?.enabled === false)) return [];
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol) ? [{ name, url: parsed.href }] : [];
    } catch {
      return [];
    }
  });
}

function telephoneUrl(value) {
  const formatted = String(value || '').trim().replace(/[\s().-]/g, '');
  if (!/^\+?[1-9]\d{7,14}$/.test(formatted)) return '';
  const digits = formatted.replace(/^\+/, '');
  if (digits.length === 10 || (digits.startsWith('91') && !/^91[6-9]\d{9}$/.test(digits))) return '';
  return `tel:${formatted}`;
}

function whatsappUrl(value) {
  const formatted = String(value || '').trim().replace(/[\s().-]/g, '');
  if (!/^\+?[1-9]\d{7,14}$/.test(formatted)) return '';
  const digits = formatted.replace(/^\+/, '');
  if (digits.length === 10 || (digits.startsWith('91') && !/^91[6-9]\d{9}$/.test(digits))) return '';
  return `https://wa.me/${digits}`;
}

function emailUrl(value) {
  const email = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : '';
}

export function SocialLinks({ social, className = 'site-social-links' }) {
  const links = getEnabledSocialLinks(social);
  if (!links.length) return null;
  return <div className={className}>{links.map(({ name, url }) => {
    const Icon = socialIcon(name, url);
    return <a key={name} href={url} target="_blank" rel="noreferrer" aria-label={name} title={name}><Icon size={16} aria-hidden="true" /><span>{name}</span></a>;
  })}</div>;
}

export default function SiteContactDetails({ contact = {}, social, className = '' }) {
  const emailHref = emailUrl(contact.email);
  const phoneHref = telephoneUrl(contact.phone);
  const whatsappHref = whatsappUrl(contact.whatsapp);
  const hasDetails = emailHref || phoneHref || whatsappHref || contact.location;
  const hasSocial = getEnabledSocialLinks(social).length > 0;
  if (!hasDetails && !hasSocial) return null;

  return (
    <div className={`site-contact-details ${className}`.trim()}>
      {emailHref && <a href={emailHref}><Mail size={15} /><span>{contact.email}</span></a>}
      {phoneHref && <a href={phoneHref}><Phone size={15} /><span>{contact.phone}</span></a>}
      {whatsappHref && <a href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={15} /><span>WhatsApp</span></a>}
      {contact.location && <span className="site-contact-location"><MapPin size={15} /><span>{contact.location}</span></span>}
      <SocialLinks social={social} className="site-contact-socials" />
    </div>
  );
}
