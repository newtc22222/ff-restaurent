export const canRequestPushPermission = (
  serviceWorkerSupported: boolean,
  notificationSupported: boolean,
) => serviceWorkerSupported && notificationSupported;

export async function requestPushToken(): Promise<string | null> {
  if (
    !canRequestPushPermission(
      'serviceWorker' in window.navigator,
      'Notification' in window,
    )
  ) {
    return null;
  }
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
  } else if (Notification.permission !== 'granted') {
    return null;
  }
  try {
    const { initializeApp } = await import('firebase/app');
    const { getMessaging, getToken } = await import('firebase/messaging');
    const app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });
    const messaging = getMessaging(app);
    const registration = await window.navigator.serviceWorker.ready;
    return await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
  } catch (error) {
    console.warn('Push token request failed', error);
    return null;
  }
}
