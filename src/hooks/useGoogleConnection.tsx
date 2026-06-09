import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import type { User } from '../auth/IAuthProvider';
import type { AuthStatus, SyncStatus } from '../types/sync';
import { GoogleAuthProvider, ensureGisLoaded } from '../auth/GoogleAuthProvider';
import { GoogleDriveStorageProvider } from '../storage/GoogleDriveStorageProvider';
import { UnifiedStorageProvider } from '../storage/UnifiedStorageProvider';

interface GoogleConnectionState {
  authStatus: AuthStatus;
  isConnected: boolean;
  user: User | null;
  connecting: boolean;
  connectError: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  driveAvailable: boolean;
  connect: () => Promise<void>;
  disconnect: (revoke?: boolean) => Promise<void>;
  syncNow: () => Promise<void>;
  storage: UnifiedStorageProvider;
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

/** A failed silent refresh means a blocked popup; don't retrigger one per Drive op. */
const REFRESH_FAILURE_COOLDOWN_MS = 60000;

const POPUP_BLOCKED_MESSAGE = "Couldn't open Google sign-in — allow popups and try again";

const GoogleConnectionContext = createContext<GoogleConnectionState>({
  authStatus: 'local',
  isConnected: false,
  user: null,
  connecting: false,
  connectError: null,
  syncStatus: 'idle',
  driveAvailable: false,
  connect: async () => {},
  disconnect: async () => {},
  syncNow: async () => {},
  storage: new UnifiedStorageProvider(),
});

export function GoogleConnectionProvider({ children }: { children: ReactNode }) {
  const [auth] = useState(() => (CLIENT_ID ? new GoogleAuthProvider(CLIENT_ID) : null));
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() =>
    auth?.hasStoredSession() ? 'restoring' : 'local'
  );
  const [user, setUser] = useState<User | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);

  // Silent token refresh, deduplicated across concurrent callers and rate-limited
  // after a failure (the storage layer retriggers it per Drive op mid-sync).
  const refreshingRef = useRef<Promise<boolean> | null>(null);
  const lastRefreshFailureRef = useRef(0);
  const tryRefresh = useCallback(async (): Promise<boolean> => {
    if (!auth) return false;
    if (refreshingRef.current) return refreshingRef.current;
    if (Date.now() - lastRefreshFailureRef.current < REFRESH_FAILURE_COOLDOWN_MS) return false;
    const p = (async () => {
      const ok = await auth.refreshToken();
      if (ok) {
        lastRefreshFailureRef.current = 0;
      } else if (!auth.isAuthenticated()) {
        // Ignore a stale failure (e.g. an orphaned 10s backstop) when a concurrent
        // Reconnect already minted a fresh token — never downgrade a live session.
        lastRefreshFailureRef.current = Date.now();
        // Silent refresh is popup-blocked outside a user gesture by design — keep the
        // session and ask for a one-tap reconnect instead of dropping to local.
        if (auth.hasStoredSession()) setAuthStatus('reauth');
      }
      return ok;
    })();
    refreshingRef.current = p;
    try {
      return await p;
    } finally {
      refreshingRef.current = null;
    }
  }, [auth]);
  const tryRefreshRef = useRef(tryRefresh);
  useEffect(() => { tryRefreshRef.current = tryRefresh; }, [tryRefresh]);

  // One stable storage provider for the whole app — it NEVER swaps, so the library
  // is never re-fetched-and-replaced out from under the user.
  const [storage] = useState(() => new UnifiedStorageProvider({
    onStatus: (s, t) => {
      setSyncStatus(s);
      if (t) setLastSyncedAt(t);
    },
    tryRefresh: () => tryRefreshRef.current(),
  }));

  const driveProvider = useMemo(
    () => (auth ? new GoogleDriveStorageProvider(() => auth.getAccessToken()) : null),
    [auth]
  );

  const goConnected = useCallback(async (u: User | null) => {
    if (!driveProvider) return;
    // The stable Google account id lets the storage layer detect account switches.
    storage.setDrive(driveProvider, u?.id || u?.email || undefined);
    lastRefreshFailureRef.current = 0;
    setConnectError(null);
    setAuthStatus('connected');
    await storage.sync();
  }, [driveProvider, storage]);

  // Restore the session on mount: resolve a real connection status before committing.
  useEffect(() => {
    if (!auth) { setAuthStatus('local'); return; }
    let cancelled = false;
    (async () => {
      if (!auth.isAuthenticated() && !auth.hasStoredSession()) {
        setAuthStatus('local');
        return;
      }
      // Surface the stored profile right away while the connection resolves.
      const stored = await auth.getCurrentUser();
      if (cancelled) return;
      if (stored) setUser(stored);
      if (auth.isAuthenticated()) {
        await goConnected(stored);
        return;
      }
      // Token expired: the GIS script loads async from accounts.google.com, so stay
      // in 'restoring' until it arrives before attempting the silent refresh.
      const gisReady = await ensureGisLoaded();
      if (cancelled) return;
      if (!gisReady) {
        // The script didn't load (e.g. the PWA was opened offline) but the session
        // exists — show Reconnect, whose tap retries the script, not 'Connect Drive'.
        setAuthStatus('reauth');
        return;
      }
      const ok = await tryRefresh();
      if (cancelled) return;
      if (ok) {
        const u = await auth.getCurrentUser();
        if (cancelled) return;
        if (u) setUser(u);
        await goConnected(u ?? stored);
      } else if (!auth.hasStoredSession()) {
        // tryRefresh already moved a stored session to 'reauth'; only a sessionless
        // failure falls back to local mode.
        setAuthStatus('local');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  const connect = useCallback(async () => {
    if (!auth || !driveProvider) return;
    setConnecting(true);
    setConnectError(null);
    try {
      if (!(await ensureGisLoaded())) {
        setConnectError("Couldn't reach Google sign-in — check your connection and try again");
        return;
      }
      const u = await auth.signIn();
      setUser(u);
      await goConnected(u);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'popup_closed' || msg === 'popup_closed_by_user' || msg === 'access_denied') {
        // The user dismissed the popup — nothing to surface.
      } else if (msg === 'popup_failed_to_open' || msg === 'Google Identity Services not loaded') {
        setConnectError(POPUP_BLOCKED_MESSAGE);
      } else {
        console.error('Google sign-in failed:', err);
        setConnectError('Google sign-in failed — please try again');
      }
    } finally {
      setConnecting(false);
    }
  }, [auth, driveProvider, goConnected]);

  const disconnect = useCallback(async (revoke = false) => {
    if (!auth) return;
    // Disconnect must be instant and reliable — never block on the network. Edits are
    // already pushed write-through on save, so there is nothing to flush here. Update
    // the UI immediately, then sign out (best-effort: the local session is cleared
    // even when the GIS script is unavailable or revoke fails).
    storage.setDrive(null);
    setUser(null);
    setAuthStatus('local');
    setSyncStatus('idle');
    setConnectError(null);
    lastRefreshFailureRef.current = 0;
    try {
      await auth.signOut(revoke);
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  }, [auth, storage]);

  const syncNow = useCallback(() => storage.sync(), [storage]);

  const value = useMemo<GoogleConnectionState>(() => ({
    authStatus,
    // 'reauth' still counts as connected for the library UI: the session exists and
    // the Drive section must stay visible — only the token needs a one-tap refresh.
    isConnected: authStatus === 'connected' || authStatus === 'reauth',
    user,
    connecting,
    connectError,
    syncStatus,
    lastSyncedAt,
    driveAvailable: !!CLIENT_ID,
    connect,
    disconnect,
    syncNow,
    storage,
  }), [authStatus, user, connecting, connectError, syncStatus, lastSyncedAt, connect, disconnect, syncNow, storage]);

  return (
    <GoogleConnectionContext.Provider value={value}>
      {children}
    </GoogleConnectionContext.Provider>
  );
}

export function useGoogleConnection() {
  return useContext(GoogleConnectionContext);
}

export function isGoogleDriveAvailable(): boolean {
  return !!CLIENT_ID;
}
