const EMAIL_TIMEOUT_MS = 12000;

function createEmailError(code, responseCode) {
  const error = new Error('FormSubmit could not accept the email.');
  error.code = code;
  if (responseCode) error.responseCode = responseCode;
  return error;
}

function statusErrorCode(status) {
  return status === 429
    ? 'FORMSUBMIT_RATE_LIMIT'
    : status >= 500
      ? 'FORMSUBMIT_UNAVAILABLE'
      : 'FORMSUBMIT_REJECTED';
}

export async function sendFormSubmit(recipient, fields) {
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
        ...fields,
        _subject: `[${fields.source || 'portfolio'}] ${fields.subject || 'New contact request'}`,
        _replyto: fields.email || recipient,
        _template: 'table'
      })
    });

    try {
      result = JSON.parse(await response.text());
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw createEmailError(
        response.ok ? 'FORMSUBMIT_INVALID_RESPONSE' : statusErrorCode(response.status),
        response.status
      );
    }
  } catch (error) {
    if (error.code) throw error;
    throw createEmailError(error.name === 'AbortError'
      ? 'FORMSUBMIT_TIMEOUT'
      : 'FORMSUBMIT_NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
  }

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw createEmailError('FORMSUBMIT_INVALID_RESPONSE', response.status);
  }

  if (typeof result.message === 'string' && /confirm|activat|verif/i.test(result.message)) {
    throw createEmailError('FORMSUBMIT_CONFIRMATION_REQUIRED', response.status);
  }
  if (!response.ok) throw createEmailError(statusErrorCode(response.status), response.status);
  if (result.success !== true && result.success !== 'true') {
    throw createEmailError('FORMSUBMIT_REJECTED', response.status);
  }
}
