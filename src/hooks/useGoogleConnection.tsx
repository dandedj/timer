import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import type { User } from '../auth/IAuthProvider';
import type { AuthStatus, SyncStatus } from '../types/sync';
import { GoogleAuthProvider } from '../auth/GoogleAuthProvider';
import { GoogleDriveStorageProvider } from '../storage/GoogleDriveStorageProvider';
import { UnifiedStorageProvider } from '../storage/UnifiedStorageProvider';

interface GoogleConnectionState {
  authStatus: AuthStatus;
  isConnected: boolean;
  user: User | null;
  connecting: boolean;
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  driveAvailable: boolean;
  connect: () => Promise<void>;
  disconnect: (revoke?: boolean) => Promise<void>;
  syncNow: () => Promise<void>;
  storage: UnifiedStorageProvider;
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

const GoogleConnectionContext = createContext<GoogleConnectionState>({
  authStatus: 'local',
  isConnected: false,
  user: null,
  connecting: false,
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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);

  // Silent token refresh, deduplicated across concurrent callers.
  const refreshingRef = useRef<Promise<boolean> | null>(null);
  const tryRefresh = useCallback(async (): Promise<boolean> => {
    if (!auth) return false;
    if (refreshingRef.current) return refreshingRef.current;
    const p = auth.refreshToken();
    refreshingRef.current = p;
    const ok = await p;
    refreshingRef.current = null;
    return ok;
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

  const goConnected = useCallback(async () => {
    if (!driveProvider) return;
    storage.setDrive(driveProvider);
    setAuthStatus('connected');
    await storage.sync();
  }, [driveProvider, storage]);

  // Restore the session on mount: resolve a real connection status before committing.
  useEffect(() => {
    if (!auth) { setAuthStatus('local'); return; }
    let cancelled = false;
    (async () => {
      if (auth.isAuthenticated()) {
        const u = await auth.getCurrentUser();
        if (!cancelled && u) setUser(u);
        if (!cancelled) await goConnected();
      } else if (auth.hasStoredSession()) {
        const stored = await auth.getCurrentUser();
        if (!cancelled && stored) setUser(stored);
        const ok = await tryRefresh();
        if (cancelled) return;
        if (ok) {
          const u = await auth.getCurrentUser();
          if (!cancelled && u) setUser(u);
          await goConnected();
        } else {
          setAuthStatus('local');
        }
      } else {
        setAuthStatus('local');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  const connect = useCallback(async () => {
    if (!auth || !driveProvider) return;
    setConnecting(true);
    try {
      const u = await auth.signIn();
      setUser(u);
      await goConnected();
    } catch (err) {
      if (!(err instanceof Error && err.message === 'popup_closed_by_user')) {
        console.error('Google sign-in failed:', err);
      }
    } finally {
      setConnecting(false);
    }
  }, [auth, driveProvider, goConnected]);

  const disconnect = useCallback(async (revoke = false) => {
    if (!auth) return;
    // Flush anything pending before going offline so nothing is lost.
    await storage.sync().catch(() => {});
    await auth.signOut(revoke);
    storage.setDrive(null);
    setUser(null);
    setAuthStatus('local');
    setSyncStatus('idle');
  }, [auth, storage]);

  const syncNow = useCallback(() => storage.sync(), [storage]);

  const value = useMemo<GoogleConnectionState>(() => ({
    authStatus,
    isConnected: authStatus === 'connected',
    user,
    connecting,
    syncStatus,
    lastSyncedAt,
    driveAvailable: !!CLIENT_ID,
    connect,
    disconnect,
    syncNow,
    storage,
  }), [authStatus, user, connecting, syncStatus, lastSyncedAt, connect, disconnect, syncNow, storage]);

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
