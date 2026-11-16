import { ArrowUpRight, Layers3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export default function Login() {
  const apiUrl = api.defaults.baseURL;
  const authStatus = useQuery({
    queryKey: ['auth-status'],
    queryFn: () => api.get('/api/auth/status'),
    retry: false,
    staleTime: 30000
  });
  const signInConfigured = authStatus.data?.data?.googleSignInConfigured === true;
  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-symbol"><Layers3 size={24} /></div>
        <p className="eyebrow">Portfolio system</p>
        <h1>One place for the work.</h1>
        <p>Manage both portfolio sites, media, and incoming inquiries.</p>
        {authStatus.isError ? (
          <div className="login-setup-notice" role="alert">Cannot reach the API at {apiUrl}. Start the local apps with <code>npm run all</code>.</div>
        ) : !signInConfigured ? (
          <div className="login-setup-notice" role="status">Google sign-in is not configured. Add <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, <code>GOOGLE_CALLBACK_URL</code>, and <code>ADMIN_EMAIL</code> to <code>server/.env</code>, then restart the API.</div>
        ) : (
          <a className="button button-primary login-button" href={`${apiUrl}/api/auth/google`}>Continue with Google <ArrowUpRight size={17} /></a>
        )}
        <small>Access is restricted to the configured administrator account.</small>
      </div>
    </main>
  );
}
