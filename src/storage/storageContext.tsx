import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { IStorageProvider } from '../types/storage';
import { LocalStorageProvider } from './LocalStorageProvider';

const StorageContext = createContext<IStorageProvider>(
  new LocalStorageProvider()
);

export function StorageProvider({
  provider,
  children,
}: {
  provider?: IStorageProvider;
  children: ReactNode;
}) {
  const value = useMemo(() => provider ?? new LocalStorageProvider(), [provider]);
  return (
    <StorageContext.Provider value={value}>
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage(): IStorageProvider {
  return useContext(StorageContext);
}
