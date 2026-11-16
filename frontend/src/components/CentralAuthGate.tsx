import { useEffect, useRef, useState, type ReactNode } from 'react';
import { signIn } from '@/services/auth-session';

export default function CentralAuthGate({ active, loading, authenticated, error, onSignOut, children }: {
  active: boolean; loading: boolean; authenticated: boolean; error: string | null;
  onSignOut: () => Promise<void>; children: ReactNode;
}) {
  const requested = useRef(false);
  const [failure, setFailure] = useState('');
  useEffect(() => {
    if (authenticated) requested.current = false;
    if (!active || loading || authenticated || error || requested.current) return;
    requested.current = true;
    void signIn().catch(e => setFailure(e instanceof Error ? e.message : 'Unable to open Chiro Auth.'));
  }, [active, loading, authenticated, error]);
  if (!active) return <>{children}</>;
  if (loading || (!authenticated && !error && !failure)) return <main role="status" className="min-h-screen flex items-center justify-center">Opening Chiro Auth...</main>;
  if (!authenticated || failure) return <main className="min-h-screen flex items-center justify-center p-6">
    <section className="w-full max-w-md space-y-4 rounded-xl border bg-background p-6 shadow-sm">
      <h1 className="text-xl font-semibold">CHRMS access unavailable</h1>
      <p role="alert">{failure || error}</p>
      <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground" onClick={() => window.location.reload()}>Retry access</button>
      <button className="block rounded-md border px-4 py-2" onClick={() => void onSignOut().catch(e => setFailure(e.message || 'Unable to sign out.'))}>Sign out / switch account</button>
    </section>
  </main>;
  return <>{children}</>;
}
