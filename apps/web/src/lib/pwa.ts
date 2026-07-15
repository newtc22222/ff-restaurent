export const canRegisterServiceWorker = (
  production: boolean,
  serviceWorkerSupported: boolean,
) => production && serviceWorkerSupported;

export async function registerServiceWorker() {
  if (
    !canRegisterServiceWorker(
      import.meta.env.PROD,
      'serviceWorker' in window.navigator,
    )
  ) {
    return;
  }
  try {
    await window.navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      type: 'module',
    });
  } catch (error) {
    console.warn('Service worker registration failed', error);
  }
}
