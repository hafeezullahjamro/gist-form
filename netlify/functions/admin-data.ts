import { getAdminRegistrationData } from '../../server/register';
import { verifyAdminCookie } from '../../server/admin-auth';
import { withLambda } from '@netlify/aws-lambda-compat';
import type { HandlerResponse } from '@netlify/aws-lambda-compat';

type Event = {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
};

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  return `"${text.replace(/"/g, '""')}"`;
}

async function handler(event: Event): Promise<HandlerResponse> {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { ...jsonHeaders, Allow: 'GET' }, body: JSON.stringify({ message: 'Method not allowed.' }) };
  }
  if (!verifyAdminCookie(event.headers.cookie)) {
    return { statusCode: 401, headers: jsonHeaders, body: JSON.stringify({ message: 'Please sign in again.' }) };
  }
  const result = await getAdminRegistrationData();
  if (result.status !== 200) {
    return { statusCode: result.status, headers: jsonHeaders, body: JSON.stringify(result.data) };
  }
  if (event.queryStringParameters?.format === 'csv') {
    const headers = result.data.headers as string[];
    const rows = result.data.rows as string[][];
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="GIST-registrations-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
      body: `\uFEFF${csv}`,
    };
  }
  return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify(result.data) };
}

export default withLambda(handler);
