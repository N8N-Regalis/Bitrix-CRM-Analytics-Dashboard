import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { googleLogout } from '@react-oauth/google';
import {
  AUTH_ERRORS,
  clearSession,
  loadSession,
  saveSession,
  verifyCredential,
} from '@/services/googleAuth';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  // Hydrate synchronously so a signed-in user never sees the login page flash
  // on refresh (same approach as ThemeProvider's getInitialTheme).
  const [user, setUser] = useState(loadSession);
  const [error, setError] = useState(null);

  const signIn = useCallback((credential) => {
    const result = verifyCredential(credential);
    if (!result.ok) {
      googleLogout();
      clearSession();
      setUser(null);
      setError(AUTH_ERRORS[result.reason] ?? AUTH_ERRORS.malformed);
      return false;
    }
    saveSession(result.user);
    setUser(result.user);
    setError(null);
    return true;
  }, []);

  const signOut = useCallback(() => {
    googleLogout();
    clearSession();
    setUser(null);
    setError(null);
  }, []);

  const failSignIn = useCallback((message) => {
    setError(message ?? AUTH_ERRORS.malformed);
  }, []);

  // Expire an open tab the moment the session lapses, rather than leaving it
  // usable until the next reload. setTimeout is capped at ~24.8 days, which is
  // comfortably above the session TTL.
  useEffect(() => {
    if (!user) return undefined;
    const remaining = user.expiresAt - Date.now();
    if (remaining <= 0) {
      signOut();
      return undefined;
    }
    const timer = window.setTimeout(signOut, remaining);
    return () => window.clearTimeout(timer);
  }, [user, signOut]);

  const value = useMemo(
    () => ({
      user,
      status: user ? 'authenticated' : 'unauthenticated',
      error,
      signIn,
      signOut,
      failSignIn,
      clearError: () => setError(null),
    }),
    [user, error, signIn, signOut, failSignIn]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
