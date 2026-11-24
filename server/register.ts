import { randomBytes } from 'node:crypto';
import { GoogleAuth } from 'google-auth-library';
import {
  normalizeMobile,
  sanitizeRegistration,
  validateRegistration,
} from '../shared/validation';
import type { Registration } from '../shared/validation';

type ApiResult = { status: number; data: Record<string, unknown> };
export type ReceiptStorageInput = {
  registrationId: string;
  studentName: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
};
export type ReceiptStorageResult = { key: string; rollback: () => Promise<void> };
export type ReceiptStorage = (input: ReceiptStorageInput) => Promise<ReceiptStorageResult>;

export const SHEET_HEADERS = [
  'Timestamp (UTC)', 'Registration ID', 'Student Full Name',
  'Student WhatsApp', 'Father / Guardian Name', 'Gender',
  'City / District', 'Current Education Level', 'Class / Year / Semester',
  'School / College / University', 'Test Category (Assigned by GIST)',
  'Preferred GIST Course', 'Payment Receipt Blob Key',
];

class SetupError extends Error {
  constructor(readonly publicMessage: string) {
    super(publicMessage);
    this.name = 'SetupError';
  }
}

function unwrapEnvironmentValue(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') return parsed;
    } catch { /* use the original value below */ }
  }
  return trimmed;
}

function extractSpreadsheetId(value: string) {
  const unwrapped = unwrapEnvironmentValue(value);
  const urlMatch = unwrapped.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return urlMatch?.[1] ?? unwrapped;
}

function getConfiguration() {
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? '';
  let key = process.env.GOOGLE_PRIVATE_KEY ?? '';
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (credentialsJson) {
    try {
      const credentials = JSON.parse(credentialsJson) as { client_email?: unknown; private_key?: unknown };
      if (!email && typeof credentials.client_email === 'string') email = credentials.client_email.trim();
      if (!key && typeof credentials.private_key === 'string') key = credentials.private_key;
    } catch {
      throw new SetupError('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the complete service-account JSON value.');
    }
  }

  const rawId = process.env.GOOGLE_SHEET_ID?.trim() ?? '';
  const id = rawId ? extractSpreadsheetId(rawId) : '';
  const tab = process.env.GOOGLE_SHEET_TAB?.trim() || 'Registrations';
  key = key ? unwrapEnvironmentValue(key).replace(/\\n/g, '\n').trim() : '';

  const missing = [
    !id && 'GOOGLE_SHEET_ID',
    !email && 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    !key && 'GOOGLE_PRIVATE_KEY',
  ].filter(Boolean);
  if (missing.length) {
    throw new SetupError(`Missing Netlify environment variable${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new SetupError('GOOGLE_SHEET_ID is invalid. Paste either the spreadsheet ID or its full Google Sheets URL.');
  }
  if (!email.endsWith('.gserviceaccount.com')) {
    throw new SetupError('GOOGLE_SERVICE_ACCOUNT_EMAIL must be the client_email from the service-account JSON file.');
  }
  if (!key.includes('BEGIN PRIVATE KEY') || !key.includes('END PRIVATE KEY')) {
    throw new SetupError('GOOGLE_PRIVATE_KEY is invalid. Paste the complete private_key, including its BEGIN and END lines.');
  }
  return { id, tab, email, key };
}

async function getAccessToken(email: string, key: string) {
  try {
    const auth = new GoogleAuth({
      credentials: { client_email: email, private_key: key },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const token = await auth.getAccessToken();
    if (!token) throw new Error('No access token returned');
    return token;
  } catch {
    throw new SetupError('Google authentication failed. Check the service-account email and private key in Netlify.');
  }
}

async function sheetsRequest(
  url: string,
  token: string,
  method: 'GET' | 'PUT' | 'POST',
  body?: Record<string, unknown>,
): Promise<{ values?: string[][] }> {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    let googleMessage = '';
    try {
      const body = await response.json() as { error?: { message?: string } };
      googleMessage = body.error?.message ?? '';
    } catch { /* use the status-specific message below */ }
    if (response.status === 403) {
      throw new SetupError('Google denied access. Enable the Google Sheets API and share the spreadsheet with the service-account email as Editor.');
    }
    if (response.status === 404) {
      throw new SetupError('Google Sheet not found. Check GOOGLE_SHEET_ID and confirm the spreadsheet is shared with the service account.');
    }
    if (response.status === 400 && /range|sheet/i.test(googleMessage)) {
      throw new SetupError('The worksheet tab was not found. Rename the tab to match GOOGLE_SHEET_TAB (default: Registrations).');
    }
    throw new SetupError(`Google Sheets connection failed (${response.status}). ${googleMessage || 'Check the API and spreadsheet permissions.'}`);
  }
  return response.json() as Promise<{ values?: string[][] }>;
}

function spreadsheetRange(spreadsheetId: string, tab: string, range: string) {
  const safeTab = `'${tab.replace(/'/g, "''")}'`;
  const path = encodeURIComponent(`${safeTab}!${range}`);
  return `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${path}`;
}

function candidateRow(data: Registration, id: string, receiptKey: string): string[] {
  return [
    new Date().toISOString(), id, data.studentName,
    normalizeMobile(data.studentMobile), data.guardianName, data.gender,
    data.city, data.educationLevel, data.currentClass, data.institution,
    'Pending GIST assignment', data.coursePreference, receiptKey,
  ];
}

function receiptBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('Invalid payment receipt data');
  return Uint8Array.from(Buffer.from(dataUrl.slice(comma + 1), 'base64'));
}

function headersMatch(row: string[] | undefined) {
  return Boolean(row) && SHEET_HEADERS.every((header, index) => row?.[index] === header);
}

export async function checkRegistrationSetup(): Promise<ApiResult> {
  try {
    const { id, tab, email, key } = getConfiguration();
    const token = await getAccessToken(email, key);
    const sheet = await sheetsRequest(spreadsheetRange(id, tab, 'A1:M2'), token, 'GET');
    const rows = sheet.values ?? [];
    const headerState = !rows[0]?.length ? 'empty' : headersMatch(rows[0]) ? 'ready' : 'needs-new-empty-tab';
    if (headerState === 'needs-new-empty-tab') {
      throw new SetupError('The Sheet has an older or changed header layout. Create a new empty tab named Registrations, or clear the old tab before accepting registrations.');
    }
    return {
      status: 200,
      data: {
        ok: true,
        message: headerState === 'empty'
          ? 'Google Sheets is connected. The header row will be created on the first registration.'
          : 'Google Sheets is connected and ready.',
        tab,
        receiptStorage: 'Netlify Blobs',
      },
    };
  } catch (error) {
    const message = error instanceof SetupError
      ? error.publicMessage
      : 'Setup check failed. Review the Netlify function logs for details.';
    console.error('[GIST setup check]', error instanceof Error ? error.message : 'Unknown error');
    return { status: 503, data: { ok: false, message } };
  }
}

export async function getAdminRegistrationData(): Promise<ApiResult> {
  try {
    const { id, tab, email, key } = getConfiguration();
    const token = await getAccessToken(email, key);
    const sheet = await sheetsRequest(spreadsheetRange(id, tab, 'A1:M'), token, 'GET');
    const rows = sheet.values ?? [];
    if (!rows[0]?.length) {
      return { status: 200, data: { headers: SHEET_HEADERS, rows: [] } };
    }
    if (!headersMatch(rows[0])) {
      throw new SetupError('The Sheet header layout does not match the registration form.');
    }
    const normalizedRows = rows.slice(1)
      .filter(row => row.some(Boolean))
      .map(row => SHEET_HEADERS.map((_, index) => row[index] ?? ''));
    return { status: 200, data: { headers: SHEET_HEADERS, rows: normalizedRows } };
  } catch (error) {
    const message = error instanceof SetupError
      ? error.publicMessage
      : 'The registration dashboard is temporarily unavailable.';
    console.error('[GIST admin data]', error instanceof Error ? error.message : 'Unknown error');
    return { status: 503, data: { message } };
  }
}

export async function registerStudent(payload: unknown, storeReceipt?: ReceiptStorage): Promise<ApiResult> {
  if (JSON.stringify(payload ?? {}).length > 3_000_000) {
    return { status: 413, data: { message: 'The request is too large.' } };
  }
  const form = sanitizeRegistration(payload);
  const errors = validateRegistration(form);
  if (Object.keys(errors).length > 0) {
    return { status: 422, data: { message: 'Please check the highlighted fields.', errors } };
  }

  try {
    const { id: spreadsheetId, tab, email, key } = getConfiguration();
    const token = await getAccessToken(email, key);

    const headerSheet = await sheetsRequest(spreadsheetRange(spreadsheetId, tab, 'A1:M2'), token, 'GET');
    const headerRows = headerSheet.values ?? [];

    // Provision the column titles on a new, empty Registrations tab.
    if (!headerRows.length || !headerRows[0]?.length) {
      const headerUrl = `${spreadsheetRange(spreadsheetId, tab, 'A1:M1')}?valueInputOption=RAW`;
      await sheetsRequest(headerUrl, token, 'PUT', { values: [SHEET_HEADERS] });
    } else if (!headersMatch(headerRows[0])) {
      // It is safe to repair a header-only tab, but never rewrite a tab that already has registrations.
      if (headerRows[1]?.some(Boolean)) {
        throw new SetupError('The Sheet uses an older column layout. Create a new empty Registrations tab before reopening registrations.');
      }
      const headerUrl = `${spreadsheetRange(spreadsheetId, tab, 'A1:M1')}?valueInputOption=RAW`;
      await sheetsRequest(headerUrl, token, 'PUT', { values: [SHEET_HEADERS] });
    }

    // Duplicate detection uses both name and phone so siblings can share a contact.
    const duplicateSheet = await sheetsRequest(spreadsheetRange(spreadsheetId, tab, 'C2:D'), token, 'GET');
    const existingCandidates = duplicateSheet.values ?? [];
    const normalizedName = form.studentName.replace(/\s+/g, ' ').toLocaleLowerCase();
    const normalizedPhone = normalizeMobile(form.studentMobile);
    const duplicate = existingCandidates.some(row =>
      (row[0] ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase() === normalizedName &&
      normalizeMobile(row[1] ?? '') === normalizedPhone
    );
    if (duplicate) {
      return {
        status: 409,
        data: { message: 'A registration with this student name and WhatsApp number already exists. Please contact GIST if you need to make a correction.' },
      };
    }

    const registrationId = `GIST-2026-${randomBytes(5).toString('hex').toUpperCase()}`;
    if (!storeReceipt) throw new Error('Payment receipt storage is not configured');
    const storedReceipt = await storeReceipt({
      registrationId,
      studentName: form.studentName,
      fileName: form.paymentReceiptName,
      contentType: form.paymentReceiptType,
      bytes: receiptBytes(form.paymentReceiptData),
    });
    const appendUrl = `${spreadsheetRange(spreadsheetId, tab, 'A:M')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    try {
      await sheetsRequest(appendUrl, token, 'POST', { values: [candidateRow(form, registrationId, storedReceipt.key)] });
    } catch (error) {
      await storedReceipt.rollback().catch(() => undefined);
      throw error;
    }
    return {
      status: 201,
      data: { message: 'Your registration has been received.', registrationId },
    };
  } catch (error) {
    console.error('[GIST registration]', error instanceof Error ? error.message : 'Unknown error');
    return {
      status: 503,
      data: {
        message: error instanceof SetupError
          ? 'Registration setup is incomplete. Please contact GIST administration.'
          : 'Registration is temporarily unavailable. Please try again or contact GIST.',
      },
    };
  }
}
