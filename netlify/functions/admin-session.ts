import {
  adminSessionCookie,
  authenticateAdmin,
  clearAdminSessionCookie,
  createAdminToken,
  isSecureRequest,
  verifyAdminCookie,
} from '../../server/admin-auth';

type Event = {
  httpMethod: string;
  body: string | null;
  headers: Record<string, string | undefined>;
};

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export async function handler(event: Event) {
  const secure = isSecureRequest(event.headers);
  if (event.httpMethod === 'GET') {
    const authenticated = verifyAdminCookie(event.headers.cookie);
    return { statusCode: authenticated ? 200 : 401, headers: jsonHeaders, body: JSON.stringify({ authenticated }) };
  }
  if (event.httpMethod === 'DELETE') {
    return {
      statusCode: 200,
      headers: { ...jsonHeaders, 'Set-Cookie': clearAdminSessionCookie(secure) },
      body: JSON.stringify({ authenticated: false }),
    };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...jsonHeaders, Allow: 'GET, POST, DELETE' }, body: JSON.stringify({ message: 'Method not allowed.' }) };
  }

  let credentials: { username?: unknown; password?: unknown } = {};
  try { credentials = JSON.parse(event.body ?? '{}') as typeof credentials; } catch { /* rejected below */ }
  if (typeof credentials.username !== 'string' || typeof credentials.password !== 'string') {
    return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ message: 'Enter your username and password.' }) };
  }

  try {
    if (!authenticateAdmin(credentials.username, credentials.password)) {
      return { statusCode: 401, headers: jsonHeaders, body: JSON.stringify({ message: 'Incorrect username or password.' }) };
    }
    const token = createAdminToken();
    return {
      statusCode: 200,
      headers: { ...jsonHeaders, 'Set-Cookie': adminSessionCookie(token, secure) },
      body: JSON.stringify({ authenticated: true }),
    };
  } catch (error) {
    console.error('[GIST admin login]', error instanceof Error ? error.message : 'Unknown error');
    return { statusCode: 503, headers: jsonHeaders, body: JSON.stringify({ message: 'Admin login is not configured yet.' }) };
  }
}
