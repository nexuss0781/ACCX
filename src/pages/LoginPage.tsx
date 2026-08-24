import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Github, Globe2, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button';
import { accxApi } from '../lib/accxApi';

function callbackError(value: string | null): string {
  if (value === 'nexuss_auth_account_link_required') return 'This Nexuss Auth account matches an existing ACCX account. Sign in to that account once, then link Nexuss Auth from account settings.';
  if (value === 'nexuss_auth_identity_unverified') return 'Nexuss Auth could not verify the returned identity. Please try again.';
  if (value) return 'The Nexuss Auth sign-in could not be completed. Please try again.';
  return '';
}

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<'github' | 'google' | ''>('');
  const location = useLocation();
  const navigate = useNavigate();
  const queryError = new URLSearchParams(location.search).get('error');

  const continueWithNexuss = async (provider: 'github' | 'google') => {
    setError('');
    setLoading(provider);
    try {
      const { authorizationUrl } = await accxApi.nexussStart(provider, '/');
      window.location.assign(authorizationUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nexuss Auth is unavailable.');
      setLoading('');
    }
  };

  return <div className="min-h-screen flex"><div className="hidden lg:flex lg:w-1/2 gradient-brand relative overflow-hidden"><div className="absolute inset-0 opacity-10"><div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" /><div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" /></div><div className="relative z-10 flex flex-col justify-center px-16 text-white"><div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-8"><Shield className="w-7 h-7" /></div><h1 className="text-4xl font-bold mb-4 tracking-tight">ACCX</h1><p className="text-xl text-white/80 mb-8 max-w-md">Your cloud credential control plane for secure account metadata, dynamic references, and protected execution.</p><div className="space-y-4">{['Envelope-encrypted custody', 'No browser secret exposure', 'Cross-device cloud metadata'].map(feature => <div key={feature} className="flex items-center gap-3 text-white/70"><div className="w-1.5 h-1.5 rounded-full bg-white/50" /><span className="text-sm">{feature}</span></div>)}</div></div></div><div className="flex-1 flex items-center justify-center p-8 bg-bg-base"><div className="w-full max-w-md animate-fade-in"><div className="lg:hidden flex items-center gap-3 mb-8"><div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center"><Shield className="w-5 h-5 text-white" /></div><span className="text-xl font-bold tracking-tight">ACCX</span></div><h2 className="text-2xl font-bold text-text-primary mb-1">Welcome back</h2><p className="text-text-muted mb-8">Continue securely with your Nexuss Auth identity.</p><div className="space-y-3"><Button type="button" loading={loading === 'github'} onClick={() => void continueWithNexuss('github')} className="w-full" size="lg" icon={<Github className="w-4 h-4" />}>Continue with GitHub</Button><Button type="button" loading={loading === 'google'} onClick={() => void continueWithNexuss('google')} variant="secondary" className="w-full" size="lg" icon={<Globe2 className="w-4 h-4" />}>Continue with Google</Button></div>{(error || queryError) && <div className="mt-4 p-3 rounded-xl bg-danger-subtle border border-danger-theme/20 text-sm text-danger-theme animate-scale-in">{error || callbackError(queryError)}</div>}<div className="mt-8 p-4 rounded-2xl bg-bg-surface border border-border-theme"><p className="text-sm font-medium text-text-primary">One identity for ACCX</p><p className="text-sm text-text-muted mt-1">Nexuss Auth handles provider sign-in. ACCX then creates its own protected session for your control plane.</p></div><p className="text-center text-sm text-text-muted mt-6">New to ACCX? <Link to="/register" className="text-accent hover:text-accent-hover font-medium inline-flex items-center gap-1">Create an account <ArrowRight className="w-3.5 h-3.5" /></Link></p><button type="button" className="block mx-auto mt-4 text-xs text-text-muted hover:text-text-primary" onClick={() => navigate('/login')}>Clear sign-in message</button></div></div></div>;
}
