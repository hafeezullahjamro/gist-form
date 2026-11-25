import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import {
  Check, CheckCircle2,
  ChevronDown, CircleHelp, ClipboardCheck, GraduationCap, LockKeyhole,
  ShieldCheck, UserRound, Trophy, Copy,
} from 'lucide-react';
import {
  CLASSES_BY_LEVEL, EDUCATION_LEVELS, GENDERS, GIST_COURSES, TEST_CATEGORIES,
} from '../shared/options';
import {
  EMPTY_REGISTRATION, MAX_RECEIPT_BYTES, PAYMENT_RECEIPT_TYPES,
  STEP_FIELDS, validateRegistration,
} from '../shared/validation';
import type { Registration, FieldKey, Errors } from '../shared/validation';
import desktopBanner from '../images/pc banner.png';
import mobileBanner from '../images/Mobile Banner.png';
import AdminPortal from './AdminPortal';

const EASYPAISA_ACCOUNT_TITLE = import.meta.env.VITE_EASYPAISA_ACCOUNT_TITLE?.trim() || 'Majid Ali shah';
const EASYPAISA_ACCOUNT_NUMBER = import.meta.env.VITE_EASYPAISA_ACCOUNT_NUMBER?.trim() || '03053940500';
const PAYMENT_DETAILS_READY = EASYPAISA_ACCOUNT_NUMBER !== 'Configure before launch' && !EASYPAISA_ACCOUNT_NUMBER.includes('X');

const STEP_INFO = [
  { short: 'Student details', title: 'Student details', description: 'Only the essential information needed for the scholarship test.', icon: UserRound },
  { short: 'Education & course', title: 'Education and course choice', description: 'GIST will assign the test category from these education details.', icon: GraduationCap },
];

type Option = string;
type Screen = 'dashboard' | 'registration' | 'admin';
type FieldProps = {
  id: FieldKey;
  label: string;
  required?: boolean;
  description?: string;
  children: ReactNode;
  errors: Errors;
};

function Field({ id, label, required, description, children, errors }: FieldProps) {
  return (
    <div className={`field ${errors[id] ? 'field--error' : ''}`}>
      <label className="field-label" htmlFor={id}>{label}{required && <span className="required"> *</span>}</label>
      {description && <div className="field-description">{description}</div>}
      {children}
      {errors[id] && <p className="field-error" id={`${id}-error`} role="alert">{errors[id]}</p>}
    </div>
  );
}

function SelectInput({ id, placeholder, value, options, onChange, hasError, disabled }: {
  id: FieldKey; placeholder: string; value: string; options: readonly Option[];
  onChange: (value: string) => void; hasError: boolean; disabled?: boolean;
}) {
  return (
    <div className="select-wrap">
      <select
        id={id} value={value} onChange={event => onChange(event.target.value)}
        aria-invalid={hasError} aria-describedby={hasError ? `${id}-error` : undefined}
        className={`control select-control ${value ? '' : 'select-placeholder'}`}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronDown className="select-arrow" size={18} aria-hidden="true" />
    </div>
  );
}

function TextInput({ id, value, onChange, placeholder, hasError, type = 'text', inputMode, autoComplete }: {
  id: FieldKey; value: string; onChange: (value: string) => void;
  placeholder: string; hasError: boolean; type?: string;
  inputMode?: 'text' | 'tel' | 'email'; autoComplete?: string;
}) {
  return <input
    className="control" id={id} name={id} type={type} inputMode={inputMode}
    autoComplete={autoComplete} value={value} maxLength={180}
    placeholder={placeholder} onChange={event => onChange(event.target.value)}
    aria-invalid={hasError} aria-describedby={hasError ? `${id}-error` : undefined}
  />;
}

function ScholarshipBanner({ interactive = false, onRegister }: { interactive?: boolean; onRegister?: () => void }) {
  const picture = (
    <picture>
      <source media="(max-width: 760px)" srcSet={mobileBanner} />
      <img src={desktopBanner} alt="GIST Scholarship Program 2026 — Big dreams start here" />
    </picture>
  );
  return interactive ? (
    <button className="scholarship-banner scholarship-banner--interactive" type="button" onClick={onRegister} aria-label="Open the GIST scholarship registration form">
      {picture}
    </button>
  ) : <div className="scholarship-banner">{picture}</div>;
}

function screenFromHash(): Screen {
  if (window.location.hash === '#admin') return 'admin';
  if (window.location.hash === '#register') return 'registration';
  return 'dashboard';
}

function App() {
  const [screen, setScreen] = useState<Screen>(screenFromHash);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Registration>({ ...EMPTY_REGISTRATION });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [confirmationId, setConfirmationId] = useState('');
  const [copied, setCopied] = useState(false);
  const [paymentCopied, setPaymentCopied] = useState(false);
  const [receiptInputKey, setReceiptInputKey] = useState(0);

  useEffect(() => {
    const syncScreen = () => setScreen(screenFromHash());
    window.addEventListener('hashchange', syncScreen);
    return () => window.removeEventListener('hashchange', syncScreen);
  }, []);

  const update = (field: FieldKey, value: string) => {
    setData(previous => ({
      ...previous,
      [field]: value,
      ...(field === 'educationLevel' ? { currentClass: '' } : {}),
    }));
    setErrors(previous => ({ ...previous, [field]: undefined, ...(field === 'educationLevel' ? { currentClass: undefined } : {}) }));
    setSubmissionError('');
  };

  const input = (key: FieldKey, placeholder: string, opts: { type?: string; inputMode?: 'text' | 'tel' | 'email'; autoComplete?: string } = {}) => (
    <TextInput id={key} value={data[key]} onChange={value => update(key, value)}
      placeholder={placeholder} hasError={Boolean(errors[key])} {...opts} />
  );
  const select = (key: FieldKey, placeholder: string, options: readonly string[], disabled = false) => (
    <SelectInput id={key} placeholder={placeholder} options={options} value={data[key]}
      onChange={value => update(key, value)} disabled={disabled} hasError={Boolean(errors[key])} />
  );
  const relevantErrors = (section: number): Errors => {
    const allErrors = validateRegistration(data);
    return Object.fromEntries(STEP_FIELDS[section].filter(key => allErrors[key]).map(key => [key, allErrors[key]]));
  };
  const moveTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const openRegistration = () => {
    window.location.hash = 'register';
    setScreen('registration');
    moveTop();
  };

  const openDashboard = () => {
    window.history.pushState(null, '', window.location.pathname + window.location.search);
    setScreen('dashboard');
    moveTop();
  };

  const handleReceipt = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!PAYMENT_RECEIPT_TYPES.includes(file.type as typeof PAYMENT_RECEIPT_TYPES[number])) {
      setErrors(previous => ({ ...previous, paymentReceiptData: 'Upload a JPG, PNG, WebP, or PDF receipt.' }));
      event.target.value = '';
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setErrors(previous => ({ ...previous, paymentReceiptData: 'The receipt must be 2 MB or smaller.' }));
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setData(previous => ({
        ...previous,
        paymentReceiptName: file.name,
        paymentReceiptType: file.type,
        paymentReceiptData: reader.result as string,
      }));
      setErrors(previous => ({
        ...previous,
        paymentReceiptName: undefined,
        paymentReceiptType: undefined,
        paymentReceiptData: undefined,
      }));
      setSubmissionError('');
    };
    reader.onerror = () => setErrors(previous => ({ ...previous, paymentReceiptData: 'The receipt could not be read. Please choose it again.' }));
    reader.readAsDataURL(file);
  };

  const nextStep = () => {
    const found = relevantErrors(step);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setErrors({});
    setStep(previous => Math.min(previous + 1, STEP_INFO.length - 1));
    moveTop();
  };

  const goBack = () => {
    setErrors({});
    setSubmissionError('');
    setStep(previous => Math.max(previous - 1, 0));
    moveTop();
  };

  const submit = async () => {
    const allErrors = validateRegistration(data);
    if (Object.keys(allErrors).length) {
      setErrors(allErrors);
      const firstInvalidStep = STEP_FIELDS.findIndex(keys => keys.some(key => Boolean(allErrors[key])));
      if (firstInvalidStep >= 0) setStep(firstInvalidStep);
      moveTop();
      return;
    }
    setSubmitting(true);
    setSubmissionError('');
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const responseText = await response.text();
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('This local preview shows the form only. Use Netlify Dev or the deployed Netlify site to submit registrations and store receipts.');
      }
      let result: { message?: string; registrationId?: string; errors?: Errors };
      try {
        result = JSON.parse(responseText) as typeof result;
      } catch {
        throw new Error('The registration server returned an unreadable response. Please try again.');
      }
      if (!response.ok) {
        if (result.errors) setErrors(result.errors);
        throw new Error(result.message || 'We could not submit your registration.');
      }
      if (!result.registrationId) throw new Error('No registration ID was returned. Please contact GIST.');
      setConfirmationId(result.registrationId);
      moveTop();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Network error. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (step !== STEP_INFO.length - 1) nextStep();
    else void submit();
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(confirmationId);
      setCopied(true);
    } catch { setCopied(false); }
  };

  const copyPaymentNumber = async () => {
    try {
      await navigator.clipboard.writeText(EASYPAISA_ACCOUNT_NUMBER);
      setPaymentCopied(true);
      window.setTimeout(() => setPaymentCopied(false), 1800);
    } catch {
      setPaymentCopied(false);
    }
  };

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="container header-inner">
          <button className="brand" type="button" onClick={openDashboard} aria-label="GIST home">
            <div className="brand-mark"><span>G</span><i /></div>
            <div className="brand-text"><strong>GIST</strong><small>GLAMOUR INSTITUTE OF SCIENCE & TECHNOLOGY</small></div>
          </button>
          <button className="header-action" type="button" onClick={screen === 'dashboard' ? openRegistration : openDashboard}>
            {screen === 'dashboard' ? 'Register now' : screen === 'admin' ? 'Public website' : 'Back to home'}
          </button>
        </div>
      </header>

      {screen === 'admin' ? (
        <AdminPortal onExit={openDashboard} />
      ) : screen === 'dashboard' ? (
        <main className="container dashboard">
          <ScholarshipBanner interactive onRegister={openRegistration} />
          <section className="dashboard-callout" aria-label="Scholarship registration">
            <div><span>Admissions open</span><h1>GIST Scholarship Program 2026</h1><p>Complete the short online form and upload your Easypaisa payment receipt to register for the scholarship test.</p></div>
            <button className="dashboard-cta" type="button" onClick={openRegistration}>Start registration</button>
          </section>
        </main>
      ) : (
      <main className="container main-layout">
        <aside className="registration-banner" aria-label="GIST Scholarship Program banner">
          <ScholarshipBanner />
          <div className="banner-support"><ShieldCheck size={18}/><span>Secure online registration with private receipt storage.</span></div>
        </aside>

        <section className="registration-panel" aria-label="Scholarship registration form">
          {!confirmationId ? (
            <>
              <div className="form-topline"><span className="panel-kicker">TEST REGISTRATION</span><span className="step-count">STEP {step + 1} OF {STEP_INFO.length}</span></div>
              <div className="progress-track" role="progressbar" aria-label="Registration progress" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEP_INFO.length}>
                {STEP_INFO.map((_, index) => <div className={`progress-segment ${index <= step ? 'progress-active' : ''}`} key={index} />)}
              </div>
              <div className="steps-bar">
                {STEP_INFO.map((item, index) => (
                  <div className={`step-tab ${index === step ? 'step-tab--current' : ''} ${index < step ? 'step-tab--done' : ''}`} key={item.short}>
                    <span className="step-circle">{index < step ? <Check size={14} strokeWidth={3} /> : index + 1}</span>
                    <span>{item.short}</span>
                  </div>
                ))}
              </div>
              <div className="form-heading"><span className="form-heading-icon">{step === 0 ? <UserRound size={19} /> : <GraduationCap size={19} />}</span>
                <h2>{STEP_INFO[step].title}</h2><p>{STEP_INFO[step].description}</p>
              </div>

              <form noValidate onSubmit={onSubmit}>
                {step === 0 && <div className="fields-grid">
                  <Field id="studentName" label="Student full name" required errors={errors}>{input('studentName', 'Enter your full name', { autoComplete: 'name' })}</Field>
                  <Field id="guardianName" label="Father / guardian name" errors={errors}>{input('guardianName', 'Optional')}</Field>
                  <Field id="studentMobile" label="Personal contact / WhatsApp number" required errors={errors}>{input('studentMobile', '03XX XXXXXXX', { type: 'tel', inputMode: 'tel', autoComplete: 'tel' })}</Field>
                  <Field id="guardianMobile" label="Father / guardian contact number" errors={errors}>{input('guardianMobile', 'Optional — 03XX XXXXXXX', { type: 'tel', inputMode: 'tel' })}</Field>
                  <Field id="gender" label="Gender" required errors={errors}>{select('gender', 'Select gender', GENDERS)}</Field>
                  <Field id="guardianOccupation" label="Father / guardian occupation" required errors={errors}>{input('guardianOccupation', 'Enter occupation')}</Field>
                  <div className="field-span-2"><Field id="city" label="City / district" required errors={errors}>{input('city', 'e.g. Sukkur', { autoComplete: 'address-level2' })}</Field></div>
                </div>}

                {step === 1 && <div className="fields-grid">
                  <div className="field-span-2 category-notice">
                    <div className="notice-icon"><ShieldCheck size={20}/></div>
                    <div><strong>No category selection needed</strong><p>GIST will place each student in the appropriate test category after reviewing their education details.</p>
                      <div className="category-pills">{TEST_CATEGORIES.map(category => <span key={category}>{category}</span>)}</div>
                    </div>
                  </div>
                  <Field id="educationLevel" label="Current education level" required errors={errors}>{select('educationLevel', 'Select your education level', EDUCATION_LEVELS)}</Field>
                  <Field id="currentClass" label="Current class / year / semester" required errors={errors}>
                    {data.educationLevel === 'Other'
                      ? input('currentClass', 'Enter your current class or year')
                      : select('currentClass', data.educationLevel ? 'Select class or semester' : 'First select education level', CLASSES_BY_LEVEL[data.educationLevel] ?? [], !data.educationLevel)}
                  </Field>
                  <div className="field-span-2"><Field id="institution" label="School / college / university name" required errors={errors}>{input('institution', 'Name of your current institute')}</Field></div>
                  <div className="field-span-2"><Field id="coursePreference" label="Preferred GIST course" required errors={errors} description="This is your current choice. You can change it later and select any other course offered by GIST.">{select('coursePreference', 'Select a course', GIST_COURSES)}</Field></div>
                  <div className="field-span-2"><Field id="referralSource" label="Where did you hear about this scholarship?" errors={errors} description="Optional — mention a referral, person, school, social media page, or other source.">{input('referralSource', 'Referral or source, if any')}</Field></div>
                  <div className="field-span-2 laptop-note"><Trophy size={20}/><span><strong>Laptop award:</strong> the top performer in each of the three test categories will receive a laptop.</span></div>
                  <div className="field-span-2 payment-card">
                    <div className="payment-card__heading"><div className="payment-icon"><span>EP</span></div><div><span>PAYMENT METHOD</span><h3>Easypaisa</h3></div></div>
                    <div className="payment-details">
                      <div><span>Account title</span><strong>{EASYPAISA_ACCOUNT_TITLE}</strong></div>
                      <div><span>Account number</span><div className="payment-number-row"><strong>{EASYPAISA_ACCOUNT_NUMBER}</strong><button type="button" onClick={() => void copyPaymentNumber()} aria-label="Copy Easypaisa account number" title="Copy account number">{paymentCopied ? <Check size={17} /> : <Copy size={17} />}</button><em aria-live="polite">{paymentCopied ? 'Copied' : ''}</em></div></div>
                    </div>
                    {!PAYMENT_DETAILS_READY && <p className="payment-setup-warning">The Easypaisa account number must be configured before this form is published.</p>}
                    <p className="payment-instruction"><strong>Test fee: PKR 500.</strong> Pay to the account above, then upload the receipt below.</p>
                    <Field id="paymentReceiptData" label="PKR 500 test fee receipt" required errors={errors} description="JPG, PNG, WebP, or PDF — maximum 2 MB.">
                      <label className={`receipt-upload ${data.paymentReceiptData ? 'receipt-upload--ready' : ''}`} htmlFor="paymentReceiptData">
                        <input key={receiptInputKey} id="paymentReceiptData" name="paymentReceiptData" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleReceipt} aria-invalid={Boolean(errors.paymentReceiptData)} aria-describedby={errors.paymentReceiptData ? 'paymentReceiptData-error' : undefined} />
                        <span className="receipt-upload__icon">{data.paymentReceiptData ? <CheckCircle2 size={23}/> : <ClipboardCheck size={23}/>}</span>
                        <span><strong>{data.paymentReceiptName || 'Choose payment receipt'}</strong><small>{data.paymentReceiptData ? 'Receipt ready to submit' : 'Tap to select a file from your device'}</small></span>
                      </label>
                    </Field>
                  </div>
                </div>}

                {submissionError && <div className="form-alert" role="alert"><CircleHelp size={17}/><span>{submissionError}</span></div>}

                <div className="form-actions">
                  {step > 0 ? <button type="button" className="back-button" onClick={goBack} disabled={submitting}>Back</button>
                    : <span className="form-required-note">Fields marked <b>*</b> are required</span>}
                  <button className="primary-button" type="submit" disabled={submitting}>
                    {submitting ? <><span className="spinner"/> Submitting...</> : step === STEP_INFO.length - 1 ? <>Submit registration <ClipboardCheck size={18}/></> : 'Continue'}
                  </button>
                </div>
                <div className="privacy-footer"><LockKeyhole size={14}/><span>Your information is used for GIST scholarship registration and related communication.</span></div>
              </form>
            </>
          ) : (
            <div className="success-content" role="status">
              <div className="success-ring"><CheckCircle2 size={48} strokeWidth={1.8}/></div>
              <span className="success-eyebrow">APPLICATION RECEIVED</span>
              <h2>You're all set!</h2>
              <p>Thank you, <strong>{data.studentName}</strong>. Your scholarship test registration was successfully recorded. GIST will assign your test category.</p>
              <div className="confirmation-box"><span>YOUR REGISTRATION ID</span><div><strong>{confirmationId}</strong><button className="copy-button" onClick={() => void copyId()} aria-label="Copy registration ID" type="button">{copied ? <Check size={18}/> : <Copy size={18}/>}</button></div></div>
              <p className="confirmation-hint">Save this ID for future reference. GIST can use your submitted contact details for program updates.</p>
              <button type="button" className="new-registration" onClick={() => {setData({...EMPTY_REGISTRATION});setErrors({});setConfirmationId('');setStep(0);setCopied(false);setReceiptInputKey(previous => previous + 1);moveTop();}}>Register another student</button>
            </div>
          )}
        </section>
      </main>
      )}
      <footer className="site-footer"><span>© 2026 Glamour Institute of Science & Technology</span><span>Built for student opportunities <span aria-hidden="true">✦</span></span></footer>
    </div>
  );
}

export default App;
