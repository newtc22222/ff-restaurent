import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { useTheme } from '../../app/providers/theme';

const mobileQuery = '(max-width: 639px)';

export default function ToastHost() {
  const { theme } = useTheme();
  const [mobile, setMobile] = useState(
    () => window.matchMedia(mobileQuery).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(mobileQuery);
    const update = () => setMobile(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <Toaster
      position={mobile ? 'top-center' : 'top-right'}
      toastOptions={{
        duration: 4000,
        ariaProps: { role: 'status', 'aria-live': 'polite' },
        style: {
          background: dark ? 'hsl(220 15% 13%)' : '#ffffff',
          border: `1px solid ${dark ? 'hsl(215 20% 25%)' : 'hsl(214 32% 91%)'}`,
          color: dark ? 'hsl(210 20% 92%)' : 'hsl(222 47% 11%)',
          maxWidth: 'min(24rem, calc(100vw - 2rem))',
          fontSize: '0.875rem',
        },
        success: { iconTheme: { primary: '#10b981', secondary: '#ffffff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } },
      }}
    />
  );
}
