import {
  CLASSES_BY_LEVEL,
  EDUCATION_LEVELS,
  GENDERS,
  GIST_COURSES,
} from './options';

export type Registration = {
  studentName: string;
  guardianName: string;
  guardianMobile: string;
  guardianOccupation: string;
  gender: string;
  studentMobile: string;
  city: string;
  educationLevel: string;
  currentClass: string;
  institution: string;
  coursePreference: string;
  referralSource: string;
  paymentReceiptName: string;
  paymentReceiptType: string;
  paymentReceiptData: string;
};

export type FieldKey = keyof Registration;
export type Errors = Partial<Record<FieldKey, string>>;

export const EMPTY_REGISTRATION: Registration = {
  studentName: '', guardianName: '', guardianMobile: '', guardianOccupation: '', gender: '', studentMobile: '',
  city: '', educationLevel: '', currentClass: '', institution: '',
  coursePreference: '', referralSource: '', paymentReceiptName: '', paymentReceiptType: '',
  paymentReceiptData: '',
};

export const STEP_FIELDS: FieldKey[][] = [
  ['studentName', 'guardianName', 'guardianMobile', 'guardianOccupation', 'gender', 'studentMobile', 'city'],
  ['educationLevel', 'currentClass', 'institution', 'coursePreference', 'paymentReceiptData'],
];

const PHONE_PATTERN = /^(?:\+92|92|0)3\d{9}$/;
export const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
export const PAYMENT_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
const asString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export function receiptByteLength(value: string): number {
  const comma = value.indexOf(',');
  if (comma < 0) return 0;
  const base64 = value.slice(comma + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
}

function receiptMatchesType(value: string, contentType: string): boolean {
  try {
    const base64 = value.slice(value.indexOf(',') + 1, value.indexOf(',') + 33);
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    if (contentType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (contentType === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (contentType === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
    if (contentType === 'application/pdf') return String.fromCharCode(...bytes.slice(0, 4)) === '%PDF';
    return false;
  } catch {
    return false;
  }
}

export function normalizeMobile(value: string): string {
  const cleaned = value.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('03')) return `92${cleaned.slice(1)}`;
  if (cleaned.startsWith('+92')) return cleaned.slice(1);
  return cleaned;
}

export function sanitizeRegistration(value: unknown): Registration {
  const source = value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
  const output = { ...EMPTY_REGISTRATION };
  (Object.keys(output) as FieldKey[]).forEach(key => {
    output[key] = asString(source[key]);
  });
  return output;
}

export function validateRegistration(data: Registration): Errors {
  const errors: Errors = {};
  const required: FieldKey[] = [
    'studentName', 'guardianOccupation', 'gender', 'studentMobile', 'city', 'educationLevel',
    'currentClass', 'institution', 'coursePreference', 'paymentReceiptData',
  ];
  required.forEach(key => { if (!data[key]) errors[key] = 'This field is required.'; });

  if (data.studentName && data.studentName.length < 3) errors.studentName = 'Please enter your full name.';
  if (data.guardianName && data.guardianName.length < 3) errors.guardianName = 'Please enter the guardian’s full name.';
  if (data.guardianMobile && !PHONE_PATTERN.test(data.guardianMobile.replace(/[\s\-()]/g, ''))) {
    errors.guardianMobile = 'Use a valid Pakistan number, e.g. 03001234567.';
  }
  if (data.studentMobile && !PHONE_PATTERN.test(data.studentMobile.replace(/[\s\-()]/g, ''))) {
    errors.studentMobile = 'Use a valid Pakistan number, e.g. 03001234567.';
  }
  const allowed: Partial<Record<FieldKey, readonly string[]>> = {
    gender: GENDERS,
    educationLevel: EDUCATION_LEVELS,
    coursePreference: GIST_COURSES,
  };
  for (const [key, options] of Object.entries(allowed)) {
    const field = key as FieldKey;
    if (data[field] && !options.includes(data[field])) errors[field] = 'Please select a valid option.';
  }
  if (data.currentClass && data.educationLevel && data.educationLevel !== 'Other') {
    const classes = CLASSES_BY_LEVEL[data.educationLevel] ?? [];
    if (!classes.includes(data.currentClass)) errors.currentClass = 'Please choose a valid class or semester.';
  }
  if (data.paymentReceiptData) {
    if (!data.paymentReceiptName || !data.paymentReceiptType) {
      errors.paymentReceiptData = 'Please choose the payment receipt again.';
    } else if (!PAYMENT_RECEIPT_TYPES.includes(data.paymentReceiptType as typeof PAYMENT_RECEIPT_TYPES[number])) {
      errors.paymentReceiptData = 'Upload a JPG, PNG, WebP, or PDF receipt.';
    } else if (!data.paymentReceiptData.startsWith(`data:${data.paymentReceiptType};base64,`)) {
      errors.paymentReceiptData = 'The selected receipt could not be read safely.';
    } else if (!receiptMatchesType(data.paymentReceiptData, data.paymentReceiptType)) {
      errors.paymentReceiptData = 'The selected file does not match its receipt format.';
    } else if (receiptByteLength(data.paymentReceiptData) > MAX_RECEIPT_BYTES) {
      errors.paymentReceiptData = 'The receipt must be 2 MB or smaller.';
    }
  }
  // Length limits protect the database from extremely large or malformed inputs.
  for (const key of Object.keys(data) as FieldKey[]) {
    if (key !== 'paymentReceiptData' && data[key].length > 180) errors[key] = 'Please keep your answer under 180 characters.';
  }
  return errors;
}
