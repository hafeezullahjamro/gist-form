export const TEST_CATEGORIES = [
  'Elementary',
  'Secondary & Higher Secondary',
  'Undergraduate',
] as const;

export const GENDERS = ['Male', 'Female'] as const;

export const EDUCATION_LEVELS = [
  'Middle School',
  'Secondary School',
  'Intermediate',
  'Undergraduate',
  'Other',
] as const;

export const CLASSES_BY_LEVEL: Record<string, string[]> = {
  'Middle School': ['Class 6', 'Class 7', 'Class 8'],
  'Secondary School': ['Class 9', 'Class 10'],
  Intermediate: ['Class 11', 'Class 12'],
  Undergraduate: Array.from({ length: 8 }, (_, i) => `Semester ${i + 1}`),
};

export const GIST_COURSES = [
  'DIT – Diploma in Information Technology',
  'CIT – Certificate in Information Technology',
  'Agentic AI + AI Automation',
  'Cyber Security',
  'Ethical Hacking',
  'Python | Web Development',
  'Web Development',
  'App Development',
  'Zero Code Development',
  'Digital Marketing',
  'E-Commerce',
  'Freelancing',
  'Robotics',
  'English Language',
  'Other / Not Sure Yet',
] as const;

