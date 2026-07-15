import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
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
  loading: boolean;
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
  const { revalidate, state: revalidationState } = useRevalidator();
  const loading = revalidationState !== 'idle';
  const refresh = useCallback(async () => {
    await revalidate();
  }, [revalidate]);
  const logout = useCallback(() => {
    session.clear();
    navigate('/login', { replace: true });
  }, [navigate]);
  const value = useMemo<AppContextValue>(
    () => ({ ...data, loading, refresh, logout }),
    [data, loading, refresh, logout],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context)
    throw new Error('useAppContext must be used within AppProvider');
  return context;
}
