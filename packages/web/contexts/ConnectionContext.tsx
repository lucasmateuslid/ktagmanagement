
import * as React from 'react';
import { createContext, useContext, useState, ReactNode } from 'react';

export type ConnectionStatus = 'connected' | 'syncing' | 'offline' | 'error';

interface ConnectionContextType {
  status: ConnectionStatus;
  setStatus: (status: ConnectionStatus) => void;
  lastSync: number | null;
  setLastSync: (ts: number) => void;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export const ConnectionProvider = ({ children }: { children?: ReactNode }) => {
  const [status, setStatus] = useState<ConnectionStatus>('connected');
  const [lastSync, setLastSync] = useState<number | null>(null);

  return (
    <ConnectionContext.Provider value={{ status, setStatus, lastSync, setLastSync }}>
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (!context) throw new Error("useConnection must be used within a ConnectionProvider");
  return context;
};
