function normalizeWhatsAppPhoneNumber(value) {
  const formatted = String(value || '').trim().replace(/[\s()-]/g, '');
  if (!/^\+?[1-9]\d{7,14}$/.test(formatted)) return '';

  const digits = formatted.startsWith('+') ? formatted.slice(1) : formatted;
  if (digits.length === 10 || (digits.startsWith('91') && !/^91[6-9]\d{9}$/.test(digits))) return '';
  return digits;
}

module.exports = { normalizeWhatsAppPhoneNumber };
