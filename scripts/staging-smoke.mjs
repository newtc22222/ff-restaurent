import { pathToFileURL } from 'node:url';

const retryableStatus = (status) =>
  status === 408 || status === 429 || status >= 500;

export const expectOk = async (
  url,
  init,
  {
    attempts = Number(process.env.SMOKE_ATTEMPTS ?? 6),
    timeoutMs = Number(process.env.SMOKE_ATTEMPT_TIMEOUT_MS ?? 20_000),
    delayMs = Number(process.env.SMOKE_RETRY_DELAY_MS ?? 2_000),
    fetchImpl = fetch,
    sleep = (duration) =>
      new Promise((resolve) => setTimeout(resolve, duration)),
  } = {},
) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const error = new Error(`${url} returned ${response.status}`);
        if (!retryableStatus(response.status)) {
          error.permanent = true;
          throw error;
        }
        lastError = error;
      } else {
        return response.headers
          .get('content-type')
          ?.includes('application/json')
          ? response.json()
          : response.text();
      }
    } catch (error) {
      if (error?.permanent) throw error;
      lastError = error;
      if (attempt === attempts) break;
    }
    if (attempt < attempts) {
      console.warn(
        `Smoke attempt ${attempt}/${attempts} failed for ${url}; retrying`,
      );
      await sleep(delayMs * attempt);
    }
  }
  throw new Error(
    `${url} failed after ${attempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
};

export const runSmoke = async () => {
  const apiUrl = process.env.API_URL?.replace(/\/$/, '');
  const webUrl = process.env.WEB_URL?.replace(/\/$/, '');
  if (!apiUrl) throw new Error('API_URL is required');

  const apiIdentityHeaders = process.env.API_CLOUD_RUN_IDENTITY_TOKEN
    ? {
        'x-serverless-authorization': `Bearer ${process.env.API_CLOUD_RUN_IDENTITY_TOKEN}`,
      }
    : undefined;
  const webIdentityHeaders = process.env.WEB_CLOUD_RUN_IDENTITY_TOKEN
    ? {
        'x-serverless-authorization': `Bearer ${process.env.WEB_CLOUD_RUN_IDENTITY_TOKEN}`,
      }
    : undefined;

  await expectOk(`${apiUrl}/health`, { headers: apiIdentityHeaders });
  await expectOk(`${apiUrl}/ready`, { headers: apiIdentityHeaders });
  if (webUrl) await expectOk(webUrl, { headers: webIdentityHeaders });

  if (process.env.SMOKE_USERNAME && process.env.SMOKE_PASSWORD) {
    const session = await expectOk(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...apiIdentityHeaders,
      },
      body: JSON.stringify({
        identifier: process.env.SMOKE_USERNAME,
        password: process.env.SMOKE_PASSWORD,
      }),
    });
    const headers = {
      authorization: `Bearer ${session.token}`,
      ...apiIdentityHeaders,
    };
    await expectOk(`${apiUrl}/me`, { headers });
    await expectOk(`${apiUrl}/bills`, { headers });
    await expectOk(`${apiUrl}/notifications`, { headers });
  }
  console.log('Staging smoke checks passed');
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await runSmoke();
}
