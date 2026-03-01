import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
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

  // Restore user from auth on mount
  useEffect(() => {
    if (auth?.isAuthenticated()) {
      auth.getCurrentUser().then(u => {
        if (u) {
          setUser(u);
          setIsConnected(true);
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

  const storageProvider = useMemo<IStorageProvider>(() => {
    if (!isConnected || !driveProvider) return localProvider;

    // Wrap drive provider to catch auth expired errors
    return {
      async listTimers() {
        try { return await driveProvider.listTimers(); }
        catch (err) {
          if (err instanceof AuthExpiredError) {
            setIsConnected(false);
            setUser(null);
            return localProvider.listTimers();
          }
          throw err;
        }
      },
      async getTimer(id: string) {
        try { return await driveProvider.getTimer(id); }
        catch (err) {
          if (err instanceof AuthExpiredError) {
            setIsConnected(false);
            setUser(null);
            return localProvider.getTimer(id);
          }
          throw err;
        }
      },
      async saveTimer(timer) {
        try { return await driveProvider.saveTimer(timer); }
        catch (err) {
          if (err instanceof AuthExpiredError) {
            setIsConnected(false);
            setUser(null);
            return localProvider.saveTimer(timer);
          }
          throw err;
        }
      },
      async deleteTimer(id: string) {
        try { return await driveProvider.deleteTimer(id); }
        catch (err) {
          if (err instanceof AuthExpiredError) {
            setIsConnected(false);
            setUser(null);
            return localProvider.deleteTimer(id);
          }
          throw err;
        }
      },
    };
  }, [isConnected, driveProvider, localProvider]);

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
