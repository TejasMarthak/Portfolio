import { useMutation } from '@tanstack/react-query';
import { Mail, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

export default function EmailDeliveryTest() {
  const test = useMutation({
    mutationFn: () => api.post('/api/email/test', {}, { timeout: 45000 }),
    onSuccess: () => toast.success('The email provider accepted the test. Check the configured inbox and Spam.'),
    onError: (error) => toast.error(error.response?.data?.code
      ? `Email test failed (${error.response.data.code}${error.response.data.responseCode ? `/${error.response.data.responseCode}` : ''}).`
      : error.response?.data?.error || 'Email test could not be completed.')
  });

  return (
    <section className="panel whatsapp-panel" aria-labelledby="email-test-heading">
      <div className="panel-title">
        <div>
          <h2 id="email-test-heading">Email notifications</h2>
          <p>Send a test email to the Gmail account configured on the API.</p>
        </div>
        <button type="button" className="button button-muted" onClick={() => test.mutate()} disabled={test.isPending}>
          <Send size={14} />{test.isPending ? 'Sending test…' : 'Send test email'}
        </button>
      </div>
      <div className="whatsapp-content">
        {test.isError && test.error.response?.data?.code && (
          <EmailTestError error={test.error.response.data} />
        )}
        <p className="whatsapp-footnote"><Mail size={12} /> A successful test means the provider accepted the message; also check Spam or Promotions.</p>
      </div>
    </section>
  );
}

function EmailTestError({ error }) {
  const isResendError = error.code.startsWith('EMAIL_API_') ||
    ['EMAIL_SENDER_REJECTED', 'EMAIL_RATE_LIMIT'].includes(error.code);
  const responseLabel = isResendError ? 'HTTP' : 'SMTP';
  const guidance = error.code === 'EAUTH' || error.responseCode === 535
    ? ' Gmail rejected authentication. Replace the API App Password with a current Google App Password.'
    : error.code === 'ETIMEDOUT'
      ? ' Gmail SMTP timed out. Configure RESEND_API_KEY and EMAIL_FROM in the API environment to use HTTPS instead.'
      : error.code === 'EMAIL_API_AUTH'
        ? ' Resend rejected the API key. Check RESEND_API_KEY in the API environment.'
        : error.code === 'EMAIL_SENDER_REJECTED'
          ? ' Verify the EMAIL_FROM sender in Resend and make sure it is permitted for this API key.'
          : error.code === 'EMAIL_CONFIG_MISSING'
            ? ' Set GMAIL_USER and either Gmail SMTP credentials or both Resend variables in the API environment.'
            : ' Check the API logs for the matching [email] diagnostic.';
  return (
    <p className="whatsapp-error" role="alert">
      Email test failed: {error.code}
      {error.responseCode ? ` (${responseLabel} ${error.responseCode})` : ''}.{guidance}
    </p>
  );
}
