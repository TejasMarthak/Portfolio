async function sendContactEmail(contact) {
  const gmailUser = String(process.env.GMAIL_USER || '').trim();
  const resendApiKey = String(process.env.RESEND_API_KEY || '').trim();
  const emailFrom = String(process.env.EMAIL_FROM || '').trim();
  if (!gmailUser || (!resendApiKey && !String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, ''))) {
    const missingSettings = [
      !gmailUser && 'GMAIL_USER',
      !resendApiKey && !String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '') && 'GMAIL_APP_PASSWORD'
    ].filter(Boolean);
    const error = `Missing ${missingSettings.join(' and ')}`;
    console.error('[email] notification skipped:', error);
    return { sent: false, error, errorCode: 'EMAIL_CONFIG_MISSING' };
  }
  if (resendApiKey && !emailFrom) {
    const error = 'EMAIL_FROM is required when RESEND_API_KEY is configured';
    console.error('[email] notification skipped:', error);
    return { sent: false, error, errorCode: 'EMAIL_CONFIG_MISSING' };
  }

  const message = createMessage(contact);
  if (resendApiKey) return sendWithResend(message, gmailUser, emailFrom, resendApiKey);
  return sendWithGmailSmtp(message, gmailUser);
}

function createMessage(contact) {
  const color = contact.source === 'photo' ? '#e8a838' : '#7c5cff';
  const fields = ['name', 'email', 'phone', 'subject', 'projectType', 'message'];
  const rows = fields.filter((key) => contact[key]).map((key) =>
    `<tr><th align="left">${key}</th><td>${escapeHtml(contact[key])}</td></tr>`
  ).join('');
  return {
    replyTo: contact.email,
    subject: `[${contact.source}] ${contact.subject}`,
    html: `<div style="font-family:Arial,sans-serif;color:#222"><h2 style="background:${color};padding:20px;color:white">New ${escapeHtml(contact.source)} portfolio message</h2><table>${rows}</table><p>Received ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p></div>`
  };
}

async function sendWithResend(message, recipient, from, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        reply_to: message.replyTo,
        subject: message.subject,
        html: message.html
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const errorCode = response.status === 401
        ? 'EMAIL_API_AUTH'
        : response.status === 403 || response.status === 422
          ? 'EMAIL_SENDER_REJECTED'
          : response.status === 429
            ? 'EMAIL_RATE_LIMIT'
            : response.status >= 500
              ? 'EMAIL_API_UNAVAILABLE'
              : 'EMAIL_API_REJECTED';
      return logEmailFailure(errorCode, response.status);
    }
    return { sent: true };
  } catch (error) {
    const errorCode = controller.signal.aborted
      ? 'EMAIL_API_TIMEOUT'
      : /^[A-Z0-9_]{1,40}$/.test(String(error.cause?.code || error.code || ''))
        ? String(error.cause?.code || error.code)
        : 'EMAIL_API_FAILED';
    return logEmailFailure(errorCode);
  } finally {
    clearTimeout(timeout);
  }
}

async function sendWithGmailSmtp(message, gmailUser) {
  try {
    const gmailAppPassword = String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      auth: { user: gmailUser, pass: gmailAppPassword }
    });
    await transporter.sendMail({
      from: gmailUser,
      to: gmailUser,
      replyTo: message.replyTo,
      subject: message.subject,
      html: message.html
    });
    return { sent: true };
  } catch (error) {
    const errorCode = /^[A-Z0-9_]{1,40}$/.test(String(error.code || error.name || ''))
      ? String(error.code || error.name)
      : 'EMAIL_SEND_FAILED';
    return logEmailFailure(errorCode, Number.isInteger(error.responseCode) ? error.responseCode : undefined);
  }
}

function logEmailFailure(errorCode, responseCode) {
  console.error('[email] notification failed:', { code: errorCode, responseCode });
  return {
    sent: false,
    error: 'Email provider could not accept the notification.',
    errorCode,
    responseCode
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

module.exports = { sendContactEmail };
