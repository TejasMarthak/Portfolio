import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';

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
  return <div className={className}>{links.map(({ name, url }) => <a key={name} href={url} target="_blank" rel="noreferrer">{name}</a>)}</div>;
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
