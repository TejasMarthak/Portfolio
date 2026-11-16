async function sendContactEmail(contact) {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return { sent: false };
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });
    const color = contact.source === 'photo' ? '#e8a838' : '#7c5cff';
    const fields = ['name', 'email', 'phone', 'subject', 'projectType', 'message'];
    const rows = fields.filter((key) => contact[key]).map((key) =>
      `<tr><th align="left">${key}</th><td>${escapeHtml(contact[key])}</td></tr>`
    ).join('');
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      replyTo: contact.email,
      subject: `[${contact.source}] ${contact.subject}`,
      html: `<div style="font-family:Arial,sans-serif;color:#222"><h2 style="background:${color};padding:20px;color:white">New ${contact.source} portfolio message</h2><table>${rows}</table><p>Received ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p></div>`
    });
    return { sent: true };
  } catch (error) {
    console.error('[email] notification failed:', error.code || error.name);
    return { sent: false };
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

module.exports = { sendContactEmail };
