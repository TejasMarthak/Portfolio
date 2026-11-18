const EMAIL_TIMEOUT_MS = 12000;
const CLIENT_URL_ENV_BY_SOURCE = {
  pro: 'PRO_CLIENT_URL',
  photo: 'PHOTO_CLIENT_URL',
  admin: 'ADMIN_CLIENT_URL'
};

function getClientOrigin(source) {
  const envKey = CLIENT_URL_ENV_BY_SOURCE[source];
  if (!envKey || !process.env[envKey]) return null;
  try {
    return new URL(process.env[envKey]).origin;
  } catch {
    return null;
  }
}

function getHttpFailureCode(status) {
  return status === 429
    ? 'FORMSUBMIT_RATE_LIMIT'
    : status >= 500
      ? 'FORMSUBMIT_UNAVAILABLE'
      : 'FORMSUBMIT_REJECTED';
}

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

  const origin = getClientOrigin(contact.source);
  if (!origin) {
    return logFailure('FORMSUBMIT_ORIGIN_CONFIG_MISSING');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
  let response;
  let result;
  try {
    response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(recipient)}`, {
      method: 'POST',
      headers: {
        Origin: origin,
        Referer: `${origin}/`,
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
      result = JSON.parse(await response.text());
    } catch (error) {
      if (controller.signal.aborted) throw error;
      return logFailure(
        response.ok ? 'FORMSUBMIT_INVALID_RESPONSE' : getHttpFailureCode(response.status),
        response.status
      );
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
    return logFailure(getHttpFailureCode(response.status), response.status);
  }

  if (result.success === true || result.success === 'true') {
    return { sent: true };
  }

  return logFailure('FORMSUBMIT_REJECTED', response.status);
}

module.exports = { sendContactEmail };
