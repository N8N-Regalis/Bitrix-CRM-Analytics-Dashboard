import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { AlertCircle, Building2 } from 'lucide-react';
import { useAuth } from '@/components/layout/AuthProvider';
import { useTheme } from '@/components/layout/ThemeProvider';
import { ALLOWED_DOMAIN, AUTH_ERRORS, GOOGLE_CLIENT_ID } from '@/services/googleAuth';

export default function Login() {
  const { status, error, signIn, failSignIn, clearError } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname ?? '/';

  // Drop any stale error when arriving at the page fresh.
  useEffect(() => {
    clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'authenticated') {
    return <Navigate to={from} replace />;
  }

  function handleSuccess(credentialResponse) {
    if (signIn(credentialResponse.credential)) {
      navigate(from, { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="font-display text-xl font-bold uppercase tracking-wide text-foreground">Regalis CRM</h1>
          <p className="glow-text text-xs font-medium uppercase">Analytics</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-center text-base font-semibold text-card-foreground">Sign in</h2>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Use your <span className="font-medium text-foreground">@{ALLOWED_DOMAIN}</span> account to continue.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-5 flex justify-center">
            {GOOGLE_CLIENT_ID ? (
              <GoogleLogin
                // Remount on theme change so GSI paints a fresh button rather
                // than re-rendering into the existing container.
                key={theme}
                onSuccess={handleSuccess}
                onError={() => failSignIn(AUTH_ERRORS.malformed)}
                hosted_domain={ALLOWED_DOMAIN}
                theme={theme === 'dark' ? 'filled_black' : 'outline'}
                shape="pill"
                width="280"
                text="signin_with"
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                Google sign-in is not configured. Set <code className="font-mono text-xs">VITE_GOOGLE_CLIENT_ID</code>{' '}
                in the environment and reload.
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          Built by <span className="glow-text font-bold uppercase">Automations Team</span>
        </p>
      </div>
    </div>
  );
}
