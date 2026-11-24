import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'gist_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;

function configuration() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD ?? '';
  const secret = process.env.ADMIN_SESSION_SECRET ?? '';
  if (!username || !password || secret.length < 32) {
    throw new Error('Admin login environment variables are missing or invalid');
  }
  return { username, password, secret };
}

function constantTimeEqual(left: string, right: string) {
  const leftDigest = createHmac('sha256', 'gist-admin-compare').update(left).digest();
  const rightDigest = createHmac('sha256', 'gist-admin-compare').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function signature(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function authenticateAdmin(username: string, password: string) {
  const expected = configuration();
  return constantTimeEqual(username.trim(), expected.username) && constantTimeEqual(password, expected.password);
}

export function createAdminToken() {
  const { username, secret } = configuration();
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = Buffer.from(JSON.stringify({ username, expires }), 'utf8').toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyAdminCookie(cookieHeader: string | undefined) {
  try {
    const { username, secret } = configuration();
    const cookie = (cookieHeader ?? '').split(';').map(value => value.trim())
      .find(value => value.startsWith(`${COOKIE_NAME}=`));
    const token = cookie?.slice(COOKIE_NAME.length + 1);
    if (!token) return false;
    const [payload, suppliedSignature] = token.split('.');
    if (!payload || !suppliedSignature || !constantTimeEqual(suppliedSignature, signature(payload, secret))) return false;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { username?: unknown; expires?: unknown };
    return decoded.username === username && typeof decoded.expires === 'number' && decoded.expires > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function adminSessionCookie(token: string, secure: boolean) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure ? '; Secure' : ''}`;
}

export function clearAdminSessionCookie(secure: boolean) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function isSecureRequest(headers: Record<string, string | undefined>) {
  const forwarded = headers['x-forwarded-proto'];
  const host = headers.host ?? '';
  return forwarded === 'https' || (!host.includes('localhost') && !host.startsWith('127.0.0.1'));
}
