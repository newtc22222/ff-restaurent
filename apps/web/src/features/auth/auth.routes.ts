import toast from 'react-hot-toast';
import { type ActionFunctionArgs, data, redirect } from 'react-router';

import { ApiError } from '@/api/client';
import { session } from '@/lib/session';

export type LoginActionData = {
  error?: string;
  code?: string;
  success?: boolean;
  intent: 'login' | 'register' | 'forgot-request' | 'forgot-reset';
};

export async function loginLoader() {
  if (session.getToken()) throw redirect('/bills');
  void session
    .api()
    .request('/health')
    .catch(() => undefined);
  return null;
}

export async function loginAction({ request }: ActionFunctionArgs) {
  const body = await request.json();
  const api = session.api();
  const intent: LoginActionData['intent'] =
    body.intent === 'register' ||
    body.intent === 'forgot-request' ||
    body.intent === 'forgot-reset'
      ? body.intent
      : 'login';

  try {
    if (intent === 'forgot-request') {
      await api.request('/auth/password-reset-requests', {
        method: 'POST',
        body: JSON.stringify({ identifier: body.identifier }),
      });
      return { success: true, intent } satisfies LoginActionData;
    }
    if (intent === 'forgot-reset') {
      await api.request('/auth/password-reset', {
        method: 'POST',
        body: JSON.stringify({
          identifier: body.identifier,
          code: body.code,
          newPassword: body.newPassword,
          confirmation: body.confirmation,
        }),
      });
      return { success: true, intent } satisfies LoginActionData;
    }
    const result =
      intent === 'register'
        ? await api.register(
            body.name,
            body.username,
            body.phone,
            body.password,
            body.inviteCode,
          )
        : await api.login(body.identifier, body.password);
    session.setToken(result.token);
    if (typeof body.toastSuccess === 'string') {
      toast.success(body.toastSuccess);
    }
    return redirect('/bills');
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status >= 400 &&
      error.status < 500
    ) {
      return data<LoginActionData>(
        { error: error.message, code: error.code, intent },
        { status: error.status },
      );
    }
    throw error;
  }
}
