async function sendContactEmail(contact) {
  try {
    const gmailUser = String(process.env.GMAIL_USER || '').trim();
    const gmailAppPassword = String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
    const missingSettings = [
      !gmailUser && 'GMAIL_USER',
      !gmailAppPassword && 'GMAIL_APP_PASSWORD'
    ].filter(Boolean);
    if (missingSettings.length) {
      const error = `Missing ${missingSettings.join(' and ')}`;
      console.error('[email] notification skipped:', error);
      return { sent: false, error, errorCode: 'EMAIL_CONFIG_MISSING' };
    }
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      auth: { user: gmailUser, pass: gmailAppPassword }
    });
    const color = contact.source === 'photo' ? '#e8a838' : '#7c5cff';
    const fields = ['name', 'email', 'phone', 'subject', 'projectType', 'message'];
    const rows = fields.filter((key) => contact[key]).map((key) =>
      `<tr><th align="left">${key}</th><td>${escapeHtml(contact[key])}</td></tr>`
    ).join('');
    await transporter.sendMail({
      from: gmailUser,
      to: gmailUser,
      replyTo: contact.email,
      subject: `[${contact.source}] ${contact.subject}`,
      html: `<div style="font-family:Arial,sans-serif;color:#222"><h2 style="background:${color};padding:20px;color:white">New ${contact.source} portfolio message</h2><table>${rows}</table><p>Received ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p></div>`
    });
    return { sent: true };
  } catch (error) {
    const errorCode = /^[A-Z0-9_]{1,40}$/.test(String(error.code || error.name || ''))
      ? String(error.code || error.name)
      : 'EMAIL_SEND_FAILED';
    const responseCode = Number.isInteger(error.responseCode) ? error.responseCode : undefined;
    console.error('[email] notification failed:', {
      code: errorCode,
      responseCode
    });
    return {
      sent: false,
      error: 'Email provider rejected the notification.',
      errorCode,
      responseCode
    };
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

module.exports = { sendContactEmail };
