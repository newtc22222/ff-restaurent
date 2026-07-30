import 'react-datepicker/dist/react-datepicker.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import { API_URL } from './api/client';
import { I18nProvider } from './app/providers/i18n';
import { QueryProvider } from './app/providers/query';
import { ThemeProvider } from './app/providers/theme';
import { router } from './app/router';
import ToastHost from './components/ui/ToastHost';

import './index.css';

const apiOrigin = new URL(API_URL, window.location.href).origin;
if (apiOrigin !== window.location.origin) {
  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = apiOrigin;
  preconnect.crossOrigin = 'anonymous';
  document.head.append(preconnect);
}

if (import.meta.env.PROD) {
  void import('./lib/pwa').then(({ registerServiceWorker }) =>
    registerServiceWorker(),
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryProvider>
        <I18nProvider>
          <ToastHost />
          <RouterProvider router={router} />
        </I18nProvider>
      </QueryProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
