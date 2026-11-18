const EMAIL_TIMEOUT_MS = 12000;

function logFailure(errorCode, responseCode) {
  const details = responseCode ? { code: errorCode, responseCode } : { code: errorCode };
  console.error('[email] notification failed:', details);

  const result = {
    sent: false,
    error: 'Email provider could not accept the notification.',
    errorCode
  };
  if (responseCode) result.responseCode = responseCode;
  return result;
}

async function sendContactEmail(contact) {
  const recipient = String(process.env.GMAIL_USER || '').trim();
  if (!recipient) {
    console.error('[email] notification skipped:', 'Missing GMAIL_USER');
    return {
      sent: false,
      error: 'Missing GMAIL_USER',
      errorCode: 'EMAIL_CONFIG_MISSING'
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
  let response;
  let result;
  try {
    response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(recipient)}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        _subject: `[${contact.source || 'portfolio'}] ${contact.subject || 'New contact request'}`,
        _replyto: contact.email || recipient,
        _template: 'table',
        source: contact.source || '',
        name: contact.name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        subject: contact.subject || '',
        projectType: contact.projectType || '',
        message: contact.message || ''
      })
    });
    try {
      result = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      return logFailure('FORMSUBMIT_INVALID_RESPONSE', response.status);
    }
  } catch (error) {
    const errorCode = error.name === 'AbortError'
      ? 'FORMSUBMIT_TIMEOUT'
      : 'FORMSUBMIT_NETWORK_ERROR';
    return logFailure(errorCode);
  } finally {
    clearTimeout(timeout);
  }

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return logFailure('FORMSUBMIT_INVALID_RESPONSE', response.status);
  }

  const message = typeof result.message === 'string' ? result.message : '';
  if (/confirm|activat|verif/i.test(message)) {
    return logFailure('FORMSUBMIT_CONFIRMATION_REQUIRED', response.status);
  }

  if (!response.ok) {
    const errorCode = response.status === 429
      ? 'FORMSUBMIT_RATE_LIMIT'
      : response.status >= 500
        ? 'FORMSUBMIT_UNAVAILABLE'
        : 'FORMSUBMIT_REJECTED';
    return logFailure(errorCode, response.status);
  }

  if (result.success === true || result.success === 'true') {
    return { sent: true };
  }

  return logFailure('FORMSUBMIT_REJECTED', response.status);
}

module.exports = { sendContactEmail };
