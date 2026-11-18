import { useMutation } from '@tanstack/react-query';
import { Mail, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

export default function EmailDeliveryTest() {
  const test = useMutation({
    mutationFn: () => api.post('/api/email/test', {}, { timeout: 45000 }),
    onSuccess: () => toast.success('FormSubmit accepted the test. Check the configured inbox and Spam.'),
    onError: (error) => toast.error(error.response?.data?.code
      ? `Email test failed (${error.response.data.code}${error.response.data.responseCode ? `/${error.response.data.responseCode}` : ''}).`
      : error.response?.data?.error || 'Email test could not be completed.')
  });

  return (
    <section className="panel whatsapp-panel" aria-labelledby="email-test-heading">
      <div className="panel-title">
        <div>
          <h2 id="email-test-heading">Email notifications</h2>
          <p>Send a test email to the recipient configured as GMAIL_USER on the API.</p>
        </div>
        <button type="button" className="button button-muted" onClick={() => test.mutate()} disabled={test.isPending}>
          <Send size={14} />{test.isPending ? 'Sending test…' : 'Send test email'}
        </button>
      </div>
      <div className="whatsapp-content">
        {test.isError && test.error.response?.data?.code && (
          <EmailTestError error={test.error.response.data} />
        )}
        <p className="whatsapp-footnote"><Mail size={12} /> FormSubmit needs a one-time email confirmation on first use. Check Spam too.</p>
      </div>
    </section>
  );
}

function EmailTestError({ error }) {
  const guidance = error.code === 'FORMSUBMIT_CONFIRMATION_REQUIRED'
    ? ' Open the FormSubmit confirmation email sent to GMAIL_USER (check Spam) and click its activation link.'
    : error.code === 'FORMSUBMIT_REJECTED'
      ? error.responseCode === 403
        ? ' FormSubmit returned 403. Check the recipient confirmation and the API client URL environment settings.'
        : ' Check that GMAIL_USER is a valid recipient and complete any FormSubmit confirmation.'
      : error.code === 'FORMSUBMIT_TIMEOUT' || error.code === 'FORMSUBMIT_NETWORK_ERROR'
        ? ' The API could not reach FormSubmit over HTTPS. Check the API logs and outbound network access.'
        : error.code === 'EMAIL_CONFIG_MISSING'
          ? ' Set GMAIL_USER to the inbox that should receive contact notifications. No API key is required.'
          : error.code === 'FORMSUBMIT_RATE_LIMIT'
            ? ' FormSubmit rate-limited the request; wait before trying again.'
            : ' Check the API logs for the matching [email] diagnostic.';
  return (
    <p className="whatsapp-error" role="alert">
      Email test failed: {error.code}
      {error.responseCode ? ` (HTTP ${error.responseCode})` : ''}.{guidance}
    </p>
  );
}
