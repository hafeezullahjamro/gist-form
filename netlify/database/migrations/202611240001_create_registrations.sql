CREATE TABLE IF NOT EXISTS registrations (
  registration_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  student_name VARCHAR(180) NOT NULL,
  student_name_normalized VARCHAR(180) NOT NULL,
  student_mobile VARCHAR(32) NOT NULL,
  guardian_name VARCHAR(180) NOT NULL DEFAULT '',
  gender VARCHAR(40) NOT NULL,
  city VARCHAR(180) NOT NULL,
  education_level VARCHAR(180) NOT NULL,
  current_class VARCHAR(180) NOT NULL,
  institution VARCHAR(180) NOT NULL,
  test_category VARCHAR(180) NOT NULL DEFAULT 'Pending GIST assignment',
  course_preference VARCHAR(180) NOT NULL,
  receipt_key TEXT NOT NULL,
  CONSTRAINT registrations_student_phone_unique
    UNIQUE (student_name_normalized, student_mobile)
);

CREATE INDEX IF NOT EXISTS registrations_created_at_idx
  ON registrations (created_at DESC);

CREATE INDEX IF NOT EXISTS registrations_course_idx
  ON registrations (course_preference);
