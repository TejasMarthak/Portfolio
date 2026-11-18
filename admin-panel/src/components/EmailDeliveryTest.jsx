import { useMutation } from '@tanstack/react-query';
import { Mail, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

export default function EmailDeliveryTest() {
  const test = useMutation({
    mutationFn: () => api.post('/api/email/test', {}, { timeout: 45000 }),
    onSuccess: () => toast.success('Gmail accepted the test. Check the configured inbox and Spam.'),
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
          <p className="whatsapp-error" role="alert">
            Email test failed: {test.error.response.data.code}
            {test.error.response.data.responseCode ? ` (SMTP ${test.error.response.data.responseCode})` : ''}.
            {test.error.response.data.code === 'EAUTH' || test.error.response.data.responseCode === 535
              ? ' Gmail rejected authentication. Replace the API App Password with a current Google App Password.'
              : ' Check the API logs for the matching [email] diagnostic.'}
          </p>
        )}
        <p className="whatsapp-footnote"><Mail size={12} /> A successful test means Gmail accepted the message; also check Spam or Promotions.</p>
      </div>
    </section>
  );
}
