export const canRequestPushPermission = (
  serviceWorkerSupported: boolean,
  notificationSupported: boolean,
) => serviceWorkerSupported && notificationSupported;

export const pushRegistrationState = (
  serviceWorkerSupported: boolean,
  notificationSupported: boolean,
  configured: boolean,
  permission: NotificationPermission,
  allowPrompt = true,
): 'unavailable' | 'denied' | 'ready' | 'prompt' => {
  if (
    !canRequestPushPermission(serviceWorkerSupported, notificationSupported) ||
    !configured
  ) {
    return 'unavailable';
  }
  if (permission === 'denied') return 'denied';
  if (permission === 'granted') return 'ready';
  if (!allowPrompt) return 'unavailable';
  return 'prompt';
};

export type PushTokenResult =
  | { status: 'registered'; token: string }
  | { status: 'denied' }
  | { status: 'unavailable' };

export async function requestPushToken(
  options: { prompt?: boolean } = {},
): Promise<PushTokenResult> {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  const configured =
    Object.values(firebaseConfig).every((value) => Boolean(value?.trim())) &&
    Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim());
  let state = pushRegistrationState(
    'serviceWorker' in window.navigator,
    'Notification' in window,
    configured,
    'Notification' in window ? Notification.permission : 'default',
    options.prompt ?? true,
  );
  if (state === 'unavailable') return { status: 'unavailable' };
  if (state === 'denied') return { status: 'denied' };
  if (state === 'prompt') {
    try {
      const permission = await Notification.requestPermission();
      state = pushRegistrationState(true, true, true, permission);
    } catch {
      return { status: 'unavailable' };
    }
    if (state === 'denied') return { status: 'denied' };
    if (state !== 'ready') return { status: 'unavailable' };
  }
  try {
    const { getApps, initializeApp } = await import('firebase/app');
    const { getMessaging, getToken } = await import('firebase/messaging');
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    const messaging = getMessaging(app);
    const registration = await window.navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return token ? { status: 'registered', token } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}
