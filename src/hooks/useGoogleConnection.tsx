import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import type { IStorageProvider } from '../types/storage';
import type { User } from '../auth/IAuthProvider';
import { GoogleAuthProvider, AuthExpiredError } from '../auth/GoogleAuthProvider';
import { GoogleDriveStorageProvider } from '../storage/GoogleDriveStorageProvider';
import { LocalStorageProvider } from '../storage/LocalStorageProvider';

interface GoogleConnectionState {
  isConnected: boolean;
  user: User | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  storageProvider: IStorageProvider;
}

const GoogleConnectionContext = createContext<GoogleConnectionState>({
  isConnected: false,
  user: null,
  connecting: false,
  connect: async () => {},
  disconnect: async () => {},
  storageProvider: new LocalStorageProvider(),
});

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export function GoogleConnectionProvider({ children }: { children: ReactNode }) {
  const [auth] = useState(() => CLIENT_ID ? new GoogleAuthProvider(CLIENT_ID) : null);
  const [isConnected, setIsConnected] = useState(() => auth?.isAuthenticated() ?? false);
  const [user, setUser] = useState<User | null>(null);
  const [connecting, setConnecting] = useState(false);
  const localProvider = useMemo(() => new LocalStorageProvider(), []);
  const refreshingRef = useRef<Promise<boolean> | null>(null);

  // Restore session on mount — try silent token refresh if token expired but session exists
  useEffect(() => {
    if (!auth) return;
    if (auth.isAuthenticated()) {
      auth.getCurrentUser().then(u => {
        if (u) {
          setUser(u);
          setIsConnected(true);
        }
      });
    } else if (auth.hasStoredSession()) {
      // Token expired but user was previously connected — try silent refresh
      auth.refreshToken().then(success => {
        if (success) {
          auth.getCurrentUser().then(u => {
            if (u) {
              setUser(u);
              setIsConnected(true);
            }
          });
        }
      });
    }
  }, [auth]);

  const driveProvider = useMemo(() => {
    if (!auth) return null;
    return new GoogleDriveStorageProvider(() => auth.getAccessToken());
  }, [auth]);

  const connect = useCallback(async () => {
    if (!auth) return;
    setConnecting(true);
    try {
      const u = await auth.signIn();
      setUser(u);
      setIsConnected(true);
    } catch (err) {
      if (err instanceof Error && err.message === 'popup_closed_by_user') {
        // user closed popup, not an error
      } else {
        console.error('Google sign-in failed:', err);
      }
    } finally {
      setConnecting(false);
    }
  }, [auth]);

  const disconnect = useCallback(async () => {
    if (!auth) return;
    await auth.signOut();
    setUser(null);
    setIsConnected(false);
  }, [auth]);

  // Try a silent token refresh, returns true on success. Deduplicates concurrent calls.
  const tryRefresh = useCallback(async (): Promise<boolean> => {
    if (!auth) return false;
    if (refreshingRef.current) return refreshingRef.current;
    const promise = auth.refreshToken();
    refreshingRef.current = promise;
    const success = await promise;
    refreshingRef.current = null;
    return success;
  }, [auth]);

  const storageProvider = useMemo<IStorageProvider>(() => {
    if (!isConnected || !driveProvider) return localProvider;

    // Helper: wrap a Drive operation with silent token refresh on 401
    function withRetry<T>(op: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
      return op().catch(async (err) => {
        if (err instanceof AuthExpiredError) {
          const refreshed = await tryRefresh();
          if (refreshed) {
            return op();
          }
          // Refresh failed — disconnect and fall back to local
          setIsConnected(false);
          setUser(null);
          return fallback();
        }
        throw err;
      });
    }

    return {
      listTimers: () => withRetry(() => driveProvider.listTimers(), () => localProvider.listTimers()),
      getTimer: (id) => withRetry(() => driveProvider.getTimer(id), () => localProvider.getTimer(id)),
      saveTimer: (timer) => withRetry(() => driveProvider.saveTimer(timer), () => localProvider.saveTimer(timer)),
      deleteTimer: (id) => withRetry(() => driveProvider.deleteTimer(id), () => localProvider.deleteTimer(id)),
    };
  }, [isConnected, driveProvider, localProvider, tryRefresh]);

  const value = useMemo<GoogleConnectionState>(() => ({
    isConnected,
    user,
    connecting,
    connect,
    disconnect,
    storageProvider,
  }), [isConnected, user, connecting, connect, disconnect, storageProvider]);

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
