import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

export type Accent = 'saffron' | 'basil' | 'chili';

export const ACCENTS: Accent[] = ['saffron', 'basil', 'chili'];

const STORAGE_KEY = 'ff-accent';
const DEFAULT_ACCENT: Accent = 'saffron';

const isAccent = (value: unknown): value is Accent =>
  ACCENTS.includes(value as Accent);

const applyAccent = (accent: Accent) => {
  document.documentElement.dataset.accent = accent;
};

const getStoredAccent = (): Accent => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isAccent(stored) ? stored : DEFAULT_ACCENT;
};

export const initializeAccent = () => {
  applyAccent(getStoredAccent());
};

interface AccentContextValue {
  accent: Accent;
  setAccent: (accent: Accent) => void;
}

const AccentContext = createContext<AccentContextValue | null>(null);

export function AccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<Accent>(getStoredAccent);

  const setAccent = useCallback((newAccent: Accent) => {
    localStorage.setItem(STORAGE_KEY, newAccent);
    setAccentState(newAccent);
    applyAccent(newAccent);
  }, []);

  useLayoutEffect(() => {
    applyAccent(accent);
  }, [accent]);

  const value = useMemo(() => ({ accent, setAccent }), [accent, setAccent]);

  return (
    <AccentContext.Provider value={value}>{children}</AccentContext.Provider>
  );
}

export const useAccent = () => {
  const context = useContext(AccentContext);
  if (!context) throw new Error('useAccent must be used within AccentProvider');
  return context;
};
