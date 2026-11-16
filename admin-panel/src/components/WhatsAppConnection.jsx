import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, LoaderCircle, QrCode, Smartphone, Unplug, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

const activeStatuses = new Set(['connecting', 'qr', 'pairing-code', 'reconnecting']);

export default function WhatsAppConnection() {
  const queryClient = useQueryClient();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const statusQuery = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: () => api.get('/api/whatsapp'),
    refetchInterval: (query) => activeStatuses.has(query.state.data?.data?.whatsapp?.status) ? 1500 : false
  });
  const whatsapp = statusQuery.data?.data?.whatsapp;

  const connectQr = useMutation({
    mutationFn: () => api.post('/api/whatsapp/connect'),
    onSuccess: async () => {
      setPairingCode('');
      await queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Could not start WhatsApp linking.')
  });
  const connectPhone = useMutation({
    mutationFn: (number) => api.post('/api/whatsapp/pairing-code', { phoneNumber: number }),
    onSuccess: async (response) => {
      setPairingCode(response.data.whatsapp.pairingCode || '');
      await queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Could not request a WhatsApp pairing code.')
  });
  const disconnect = useMutation({
    mutationFn: () => api.post('/api/whatsapp/disconnect'),
    onSuccess: async (response) => {
      setPairingCode('');
      await queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
      if (response.data.whatsapp.logoutWarning) {
        toast.error('The local session was cleared. If the device still appears in WhatsApp, remove it from Linked devices.');
      } else {
        toast.success('WhatsApp disconnected.');
      }
    },
    onError: (error) => toast.error(error.response?.data?.error || 'WhatsApp could not be disconnected.')
  });
  const sendTest = useMutation({
    mutationFn: () => api.post('/api/whatsapp/test'),
    onSuccess: () => toast.success('Test notification sent to the configured WhatsApp recipient.'),
    onError: (error) => toast.error(error.response?.data?.error || 'WhatsApp test message could not be sent.')
  });

  const busy = connectQr.isPending || connectPhone.isPending || disconnect.isPending || sendTest.isPending;
  const linked = whatsapp?.connected;
  const pairing = whatsapp && activeStatuses.has(whatsapp.status);

  return (
    <section className="panel whatsapp-panel" aria-labelledby="whatsapp-heading">
      <div className="panel-title">
        <div>
          <h2 id="whatsapp-heading">WhatsApp notifications</h2>
          <p>Link your WhatsApp account to receive new contact-form inquiries. The API keeps the connection alive when you close this CMS.</p>
        </div>
        <span className={`whatsapp-status ${linked ? 'whatsapp-status-connected' : ''}`} role="status">
          <i />{linked ? 'Connected' : whatsapp?.status === 'reconnecting' ? 'Reconnecting' : pairing ? 'Waiting for link' : 'Not connected'}
        </span>
      </div>

      <div className="whatsapp-content">
        {statusQuery.isPending ? (
          <p className="whatsapp-message">Checking connection…</p>
        ) : statusQuery.isError ? (
          <p className="whatsapp-error" role="alert">Could not read WhatsApp connection status. Check the API connection and try again.</p>
        ) : linked ? (
          <div className="whatsapp-linked">
            <div className="whatsapp-linked-copy">
              <span className="whatsapp-icon"><Link2 size={18} /></span>
              <div><strong>{whatsapp.phoneNumber || 'WhatsApp account linked'}</strong><small>Notifications are sent by the API to this linked account.</small></div>
            </div>
            <div className="whatsapp-linked-actions">
              <button type="button" className="button button-muted" onClick={() => sendTest.mutate()} disabled={busy}><Send size={14} />{sendTest.isPending ? 'Sending test…' : 'Send test notification'}</button>
              <button type="button" className="button button-danger" onClick={() => disconnect.mutate()} disabled={busy}><Unplug size={15} />{disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}</button>
            </div>
          </div>
        ) : pairing ? (
          <div className="whatsapp-pairing">
            {whatsapp.qrDataUrl && whatsapp.status === 'qr' ? (
              <div className="whatsapp-qr">
                <img src={whatsapp.qrDataUrl} alt="Temporary WhatsApp device-linking QR code" />
                <p>On your phone, open WhatsApp → Linked devices → Link a device, then scan this QR.</p>
              </div>
            ) : whatsapp.pairingCode || pairingCode ? (
              <div className="whatsapp-pairing-code">
                <p>On your phone, open WhatsApp → Linked devices → Link with phone number, then enter this code:</p>
                <strong>{(whatsapp.pairingCode || pairingCode).match(/.{1,4}/g)?.join('-')}</strong>
                <small>Keep this pairing code private. It expires; request a new one if it does.</small>
              </div>
            ) : (
              <p className="whatsapp-message"><LoaderCircle size={16} className="whatsapp-spinner" /> Waiting for WhatsApp to prepare the link…</p>
            )}
            <button type="button" className="button button-muted" onClick={() => disconnect.mutate()} disabled={busy}>Cancel linking</button>
          </div>
        ) : (
          <div className="whatsapp-options">
            <div className="whatsapp-option">
              <span className="whatsapp-icon"><QrCode size={18} /></span>
              <div><strong>Connect with QR code</strong><small>Scan a temporary code with WhatsApp on your phone.</small></div>
              <button type="button" className="button button-primary" onClick={() => connectQr.mutate()} disabled={busy}><QrCode size={15} />Show QR code</button>
            </div>
            <form className="whatsapp-phone-form" onSubmit={(event) => {
              event.preventDefault();
              connectPhone.mutate(phoneNumber);
            }}>
              <label htmlFor="whatsapp-phone"><Smartphone size={17} /> Connect with phone number</label>
              <p>Enter your number in international format, including its country code (for example, +91…).</p>
              <div><input id="whatsapp-phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+919876543210" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required minLength={8} maxLength={20} /><button type="submit" className="button button-muted" disabled={busy}>{connectPhone.isPending ? 'Requesting…' : 'Get pairing code'}</button></div>
            </form>
          </div>
        )}

        {whatsapp?.status === 'reconnecting' && <p className="whatsapp-message">The API is reconnecting to the linked account. It will keep retrying while the API service is running.</p>}
        {whatsapp?.connectionError && <p className="whatsapp-error" role="alert">{whatsapp.connectionError}</p>}
        <p className="whatsapp-footnote">Linking is optional. Contact requests are still saved if WhatsApp is unavailable. The WhatsApp service runs on the API, not in this browser; it reconnects after an API restart using credentials stored in MongoDB.</p>
      </div>
    </section>
  );
}
