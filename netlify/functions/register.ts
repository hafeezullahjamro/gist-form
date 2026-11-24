import { getStore } from '@netlify/blobs';
import { withLambda } from '@netlify/aws-lambda-compat';
import { checkRegistrationSetup, registerStudent } from '../../server/register';
import type { ReceiptStorage } from '../../server/register';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

async function handler(event: { httpMethod: string; body: string | null }) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  if (event.httpMethod === 'GET') {
    const result = await checkRegistrationSetup();
    return { statusCode: result.status, headers, body: JSON.stringify(result.data) };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...headers, Allow: 'GET, POST' }, body: JSON.stringify({ message: 'Method not allowed.' }) };
  }
  let payload: unknown = {};
  try { payload = JSON.parse(event.body ?? '{}'); } catch { /* invalid JSON handled by validation */ }
  const store = getStore({ name: 'payment-receipts' });
  const storeReceipt: ReceiptStorage = async receipt => {
    const extension = EXTENSIONS[receipt.contentType] ?? 'bin';
    const key = `receipts/${receipt.registrationId}.${extension}`;
    const copiedBytes = new Uint8Array(receipt.bytes.byteLength);
    copiedBytes.set(receipt.bytes);
    await store.set(key, new Blob([copiedBytes.buffer], { type: receipt.contentType }), {
      metadata: {
        registrationId: receipt.registrationId,
        studentName: receipt.studentName,
        originalFileName: receipt.fileName,
        contentType: receipt.contentType,
        uploadedAt: new Date().toISOString(),
      },
    });
    return { key, rollback: () => store.delete(key) };
  };
  const result = await registerStudent(payload, storeReceipt);
  return { statusCode: result.status, headers, body: JSON.stringify(result.data) };
}

export default withLambda(handler);
