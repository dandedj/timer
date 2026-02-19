import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { IAuthProvider } from './IAuthProvider';
import { NoAuthProvider } from './NoAuthProvider';

const AuthContext = createContext<IAuthProvider>(new NoAuthProvider());

export function AuthProvider({
  provider,
  children,
}: {
  provider?: IAuthProvider;
  children: ReactNode;
}) {
  const value = useMemo(() => provider ?? new NoAuthProvider(), [provider]);
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): IAuthProvider {
  return useContext(AuthContext);
}
