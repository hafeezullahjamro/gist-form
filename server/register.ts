import { randomBytes } from 'node:crypto';
import { getDatabase } from '@netlify/database';
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

export const REGISTRATION_HEADERS = [
  'Timestamp (UTC)', 'Registration ID', 'Student Full Name',
  'Student WhatsApp', 'Father / Guardian Name', 'Gender',
  'City / District', 'Current Education Level', 'Class / Year / Semester',
  'School / College / University', 'Test Category (Assigned by GIST)',
  'Preferred GIST Course', 'Payment Receipt Blob Key',
];

type RegistrationRow = {
  created_at: Date | string;
  registration_id: string;
  student_name: string;
  student_mobile: string;
  guardian_name: string;
  gender: string;
  city: string;
  education_level: string;
  current_class: string;
  institution: string;
  test_category: string;
  course_preference: string;
  receipt_key: string;
};

function normalizedName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function receiptBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('Invalid payment receipt data');
  return Uint8Array.from(Buffer.from(dataUrl.slice(comma + 1), 'base64'));
}

function databaseErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown database error';
}

function isDuplicateError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function toIsoTimestamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

export async function checkRegistrationSetup(): Promise<ApiResult> {
  try {
    const db = getDatabase();
    await db.sql`SELECT registration_id FROM registrations LIMIT 1`;
    return {
      status: 200,
      data: {
        ok: true,
        message: 'Netlify Database is connected and ready.',
        registrationStorage: 'Netlify Database',
        receiptStorage: 'Netlify Blobs',
      },
    };
  } catch (error) {
    console.error('[GIST setup check]', databaseErrorMessage(error));
    return {
      status: 503,
      data: {
        ok: false,
        message: 'Netlify Database is not ready yet. Check the latest deploy and database migration.',
      },
    };
  }
}

export async function getAdminRegistrationData(): Promise<ApiResult> {
  try {
    const db = getDatabase();
    const rows = await db.sql<RegistrationRow>`
      SELECT
        created_at, registration_id, student_name, student_mobile,
        guardian_name, gender, city, education_level, current_class,
        institution, test_category, course_preference, receipt_key
      FROM registrations
      ORDER BY created_at DESC
    `;
    const normalizedRows = rows.map(row => [
      toIsoTimestamp(row.created_at),
      row.registration_id,
      row.student_name,
      row.student_mobile,
      row.guardian_name,
      row.gender,
      row.city,
      row.education_level,
      row.current_class,
      row.institution,
      row.test_category,
      row.course_preference,
      row.receipt_key,
    ]);
    return { status: 200, data: { headers: REGISTRATION_HEADERS, rows: normalizedRows } };
  } catch (error) {
    console.error('[GIST admin data]', databaseErrorMessage(error));
    return {
      status: 503,
      data: { message: 'The registration dashboard is temporarily unavailable.' },
    };
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
    const db = getDatabase();
    const normalizedStudentName = normalizedName(form.studentName);
    const normalizedPhone = normalizeMobile(form.studentMobile);
    const duplicate = await db.sql<{ registration_id: string }>`
      SELECT registration_id
      FROM registrations
      WHERE student_name_normalized = ${normalizedStudentName}
        AND student_mobile = ${normalizedPhone}
      LIMIT 1
    `;
    if (duplicate.length > 0) {
      return {
        status: 409,
        data: {
          message: 'A registration with this student name and WhatsApp number already exists. Please contact GIST if you need to make a correction.',
        },
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

    try {
      await db.sql`
        INSERT INTO registrations (
          registration_id, student_name, student_name_normalized,
          student_mobile, guardian_name, gender, city, education_level,
          current_class, institution, test_category, course_preference,
          receipt_key
        ) VALUES (
          ${registrationId}, ${form.studentName}, ${normalizedStudentName},
          ${normalizedPhone}, ${form.guardianName}, ${form.gender},
          ${form.city}, ${form.educationLevel}, ${form.currentClass},
          ${form.institution}, 'Pending GIST assignment',
          ${form.coursePreference}, ${storedReceipt.key}
        )
      `;
    } catch (error) {
      await storedReceipt.rollback().catch(() => undefined);
      if (isDuplicateError(error)) {
        return {
          status: 409,
          data: {
            message: 'A registration with this student name and WhatsApp number already exists. Please contact GIST if you need to make a correction.',
          },
        };
      }
      throw error;
    }

    return {
      status: 201,
      data: { message: 'Your registration has been received.', registrationId },
    };
  } catch (error) {
    console.error('[GIST registration]', databaseErrorMessage(error));
    return {
      status: 503,
      data: {
        message: 'Registration is temporarily unavailable. Please try again or contact GIST.',
      },
    };
  }
}
