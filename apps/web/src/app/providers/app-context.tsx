import { createContext, useContext, useState, type ReactNode } from 'react';
import { useNavigate, useRevalidator } from 'react-router';
import type {
  Bill,
  Notification,
  RestaurantEntry,
  Stats,
  User,
} from '../../lib/api';
import { session } from '../../lib/session';

export interface AppLoaderData {
  user: User;
  bills: Bill[];
  restaurants: RestaurantEntry[];
  users: User[];
  stats: Stats | null;
  notifications: Notification[];
  warning: string | null;
}

interface AppContextValue extends AppLoaderData {
  error: string | null;
  loading: boolean;
  setError: (error: string | null) => void;
  refresh: () => Promise<void>;
  logout: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  data,
  children,
}: {
  data: AppLoaderData;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [error, setError] = useState<string | null>(null);
  const value: AppContextValue = {
    ...data,
    error,
    loading: revalidator.state !== 'idle',
    setError,
    refresh: async () => {
      await revalidator.revalidate();
    },
    logout: () => {
      session.clear();
      navigate('/login', { replace: true });
    },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context)
    throw new Error('useAppContext must be used within AppProvider');
  return context;
}
