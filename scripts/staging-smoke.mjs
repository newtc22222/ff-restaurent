const apiUrl = process.env.API_URL?.replace(/\/$/, '');
const webUrl = process.env.WEB_URL?.replace(/\/$/, '');

if (!apiUrl) throw new Error('API_URL is required');

const expectOk = async (url, init) => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.headers.get('content-type')?.includes('application/json')
    ? response.json()
    : response.text();
};

await expectOk(`${apiUrl}/health`);
await expectOk(`${apiUrl}/ready`);

if (webUrl) await expectOk(webUrl);

if (process.env.SMOKE_USERNAME && process.env.SMOKE_PASSWORD) {
  const session = await expectOk(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      identifier: process.env.SMOKE_USERNAME,
      password: process.env.SMOKE_PASSWORD,
    }),
  });
  const headers = { authorization: `Bearer ${session.token}` };
  await expectOk(`${apiUrl}/me`, { headers });
  await expectOk(`${apiUrl}/bills`, { headers });
  await expectOk(`${apiUrl}/notifications`, { headers });
}

console.log('Staging smoke checks passed');
