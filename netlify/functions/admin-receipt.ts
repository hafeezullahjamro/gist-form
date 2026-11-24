import { getStore } from '@netlify/blobs';
import { verifyAdminCookie } from '../../server/admin-auth';

type Event = {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
};

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
};
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

export async function handler(event: Event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { ...jsonHeaders, Allow: 'GET' }, body: JSON.stringify({ message: 'Method not allowed.' }) };
  }
  if (!verifyAdminCookie(event.headers.cookie)) {
    return { statusCode: 401, headers: jsonHeaders, body: JSON.stringify({ message: 'Please sign in again.' }) };
  }
  const key = event.queryStringParameters?.key ?? '';
  const match = key.match(/^receipts\/(GIST-2026-[A-F0-9]{10})\.(jpg|png|webp|pdf)$/);
  if (!match) {
    return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ message: 'Invalid receipt reference.' }) };
  }
  try {
    const store = getStore({ name: 'payment-receipts', region: 'ap-southeast-1' });
    const receipt = await store.get(key, { type: 'arrayBuffer' });
    if (!receipt) {
      return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ message: 'Receipt not found.' }) };
    }
    const extension = match[2];
    return {
      statusCode: 200,
      headers: {
        'Content-Type': CONTENT_TYPES[extension],
        'Content-Disposition': `inline; filename="${match[1]}.${extension}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
      body: Buffer.from(receipt).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('[GIST receipt download]', error instanceof Error ? error.message : 'Unknown error');
    return { statusCode: 503, headers: jsonHeaders, body: JSON.stringify({ message: 'Receipt is temporarily unavailable.' }) };
  }
}
