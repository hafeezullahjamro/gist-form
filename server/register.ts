import { createHash, randomBytes } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { normalizeMobile, sanitizeRegistration, validateRegistration } from '../shared/validation';

type ApiResult = { status: number; data: Record<string, unknown> };
export type ReceiptStorageInput = { registrationId: string; studentName: string; fileName: string; contentType: string; bytes: Uint8Array };
export type ReceiptStorageResult = { key: string; rollback: () => Promise<void> };
export type ReceiptStorage = (input: ReceiptStorageInput) => Promise<ReceiptStorageResult>;

export const REGISTRATION_HEADERS = [
  'Timestamp (UTC)', 'Registration ID', 'Student Full Name', 'Student CNIC / B-Form', 'Student WhatsApp',
  'Father / Guardian Name', 'Father / Guardian Contact', 'Father / Guardian Occupation',
  'Gender', 'City / District', 'Current Education Level',
  'Class / Year / Semester', 'School / College / University',
  'Test Category (Assigned by GIST)', 'Preferred GIST Course',
  'Scholarship Referral / Source', 'Payment Receipt Blob Key',
];

type StoredRegistration = {
  createdAt: string; registrationId: string; studentName: string; cnicNumber: string; studentMobile: string;
  guardianName: string; guardianMobile: string; guardianOccupation: string;
  gender: string; city: string; educationLevel: string;
  currentClass: string; institution: string; testCategory: string;
  coursePreference: string; referralSource: string; receiptKey: string;
};

const STORE_OPTIONS = { name: 'registration-submissions' } as const;

function normalizedName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function duplicateKey(studentName: string, studentMobile: string) {
  const digest = createHash('sha256')
    .update(`${normalizedName(studentName)}\n${normalizeMobile(studentMobile)}`)
    .digest('hex');
  return `duplicates/${digest}.json`;
}

function receiptBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('Invalid payment receipt data');
  return Uint8Array.from(Buffer.from(dataUrl.slice(comma + 1), 'base64'));
}

function storageErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown Netlify Blobs error';
}

function toRow(record: StoredRegistration) {
  return [record.createdAt, record.registrationId, record.studentName, record.cnicNumber ?? '', record.studentMobile,
    record.guardianName ?? '', record.guardianMobile ?? '', record.guardianOccupation ?? '',
    record.gender, record.city, record.educationLevel, record.currentClass,
    record.institution, record.testCategory, record.coursePreference,
    record.referralSource ?? '', record.receiptKey];
}

export async function checkRegistrationSetup(): Promise<ApiResult> {
  try {
    const store = getStore(STORE_OPTIONS);
    await store.list({ prefix: 'registrations/' });
    return { status: 200, data: {
      ok: true, message: 'Netlify storage is connected and ready.',
      registrationStorage: 'Netlify Blobs', receiptStorage: 'Netlify Blobs',
    } };
  } catch (error) {
    console.error('[GIST setup check]', storageErrorMessage(error));
    return { status: 503, data: { ok: false, message: 'Netlify storage is not ready yet. Check the latest deploy.' } };
  }
}

export async function getAdminRegistrationData(): Promise<ApiResult> {
  try {
    const store = getStore(STORE_OPTIONS);
    const { blobs } = await store.list({ prefix: 'registrations/' });
    const records = await Promise.all(
      blobs.map(blob => store.get(blob.key, { type: 'json' }) as Promise<StoredRegistration | null>),
    );
    const rows = records
      .filter((record): record is StoredRegistration => record !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toRow);
    return { status: 200, data: { headers: REGISTRATION_HEADERS, rows } };
  } catch (error) {
    console.error('[GIST admin data]', storageErrorMessage(error));
    return { status: 503, data: { message: 'The registration dashboard is temporarily unavailable.' } };
  }
}

export async function registerStudent(payload: unknown, storeReceipt?: ReceiptStorage): Promise<ApiResult> {
  if (JSON.stringify(payload ?? {}).length > 3_000_000) return { status: 413, data: { message: 'The request is too large.' } };
  const form = sanitizeRegistration(payload);
  const errors = validateRegistration(form);
  if (Object.keys(errors).length > 0) return { status: 422, data: { message: 'Please check the highlighted fields.', errors } };

  try {
    const store = getStore(STORE_OPTIONS);
    const phone = normalizeMobile(form.studentMobile);
    const dedupeKey = duplicateKey(form.studentName, phone);
    if (await store.get(dedupeKey, { type: 'json' })) {
      return { status: 409, data: { message: 'A registration with this student name and WhatsApp number already exists. Please contact GIST if you need to make a correction.' } };
    }

    const registrationId = `GIST-2026-${randomBytes(5).toString('hex').toUpperCase()}`;
    if (!storeReceipt) throw new Error('Payment receipt storage is not configured');
    const storedReceipt = await storeReceipt({
      registrationId, studentName: form.studentName, fileName: form.paymentReceiptName,
      contentType: form.paymentReceiptType, bytes: receiptBytes(form.paymentReceiptData),
    });
    const record: StoredRegistration = {
      createdAt: new Date().toISOString(), registrationId, studentName: form.studentName,
      cnicNumber: form.cnicNumber.replace(/\s/g, ''),
      studentMobile: phone, guardianName: form.guardianName,
      guardianMobile: form.guardianMobile ? normalizeMobile(form.guardianMobile) : '',
      guardianOccupation: form.guardianOccupation, gender: form.gender, city: form.city,
      educationLevel: form.educationLevel, currentClass: form.currentClass,
      institution: form.institution, testCategory: 'Pending GIST assignment',
      coursePreference: form.coursePreference, referralSource: form.referralSource,
      receiptKey: storedReceipt.key,
    };

    try {
      await store.setJSON(`registrations/${record.createdAt}_${registrationId}.json`, record);
      await store.setJSON(dedupeKey, { registrationId, createdAt: record.createdAt });
    } catch (error) {
      await storedReceipt.rollback().catch(() => undefined);
      throw error;
    }
    return { status: 201, data: { message: 'Your registration has been received.', registrationId } };
  } catch (error) {
    console.error('[GIST registration]', storageErrorMessage(error));
    return { status: 503, data: { message: 'Registration is temporarily unavailable. Please try again or contact GIST.' } };
  }
}
