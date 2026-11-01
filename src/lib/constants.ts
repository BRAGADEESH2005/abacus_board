// Shared constants used by both the client and the server.

export const SECTORS = [
  'Food & Beverage',
  'Apparel & Fashion',
  'Jewelry & Luxury',
  'Electronics',
  'Automobile',
  'Furniture',
  'Hypermarket',
  'Healthcare',
  'Sports',
] as const;
export type Sector = (typeof SECTORS)[number];

/** Formats: requirement multi select and property dropdown (A3). */
export const FORMATS = ['High street', 'Mall', 'Standalone building'] as const;
export type Format = (typeof FORMATS)[number];

/** Brand preferred floors (admin form field 10). */
export const PREFERRED_FLOORS = ['Ground', 'First', 'Second', 'Third and above', 'Any'] as const;
export type PreferredFloor = (typeof PREFERRED_FLOORS)[number];

/** Property number of floors (C3). */
export const FLOOR_COUNTS = ['Ground only', 'G+1', 'G+2', 'G+3', 'G+4 and above'] as const;
export type FloorCount = (typeof FLOOR_COUNTS)[number];

export const FLOOR_NAMES = ['Ground', 'First', 'Second', 'Third', 'Fourth'] as const;

export function floorsFor(count: FloorCount | '' | undefined | null): string[] {
  const n = count ? FLOOR_COUNTS.indexOf(count as FloorCount) + 1 : 0;
  return FLOOR_NAMES.slice(0, Math.max(0, n));
}

export const PARKING_TYPES = ['Open', 'Covered', 'Both'] as const;
export const TOILET_OPTIONS = ['Inside the premises', 'Common', 'None'] as const;

/** G1 property status. */
export const PROPERTY_CONDITIONS = [
  'Under construction',
  'Bare shell',
  'Warm shell',
  'Ready to move in',
  'Available on lease expiry',
] as const;
export const CONDITIONS_NEEDING_DATE = ['Under construction', 'Available on lease expiry'];

export const DEALT_WITH = ['Owner', 'Family member', 'Caretaker', 'Other consultant'] as const;

/** Requirement extra details kept from the Admin Input Skeleton. */
export const CONDITION_ACCEPTED = ['Bare shell', 'Warm shell', 'Either'] as const;
export const STORE_MODELS = ['COCO', 'FOCO'] as const;
export const FEE_OPTIONS = [
  { value: 15, label: '15 days rent' },
  { value: 30, label: '30 days rent' },
] as const;

/** Eight property stages (Admin Side Changes v2, section 6). */
export const PROPERTY_STAGES = [
  'Received',
  'Under review',
  'Shortlisted',
  'Pitched',
  'Site visit done',
  'Under negotiation',
  'Closed',
  'Not closed',
] as const;
export type PropertyStage = (typeof PROPERTY_STAGES)[number];

/** Stages a single pitch moves through. */
export const PITCH_STAGES = ['Pitched', 'Site visit done', 'Under negotiation', 'Closed', 'Not closed'] as const;
export type PitchStage = (typeof PITCH_STAGES)[number];

/** Stages an admin sets directly on the property (before any pitch, or Not closed). */
export const PROPERTY_LEVEL_STAGES = ['Received', 'Under review', 'Shortlisted', 'Not closed'] as const;

export const STAGE_RANK: Record<string, number> = {
  Received: 1,
  'Under review': 2,
  Shortlisted: 3,
  Pitched: 4,
  'Site visit done': 5,
  'Under negotiation': 6,
  Closed: 7,
  'Not closed': 0,
};

export const LISTING_STATUSES = ['available', 'needs_reconfirm', 'let_out', 'withdrawn'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export const LISTING_LABEL: Record<ListingStatus, string> = {
  available: 'Available',
  needs_reconfirm: 'Needs reconfirming',
  let_out: 'Let out',
  withdrawn: 'Withdrawn',
};

export const REQUIREMENT_STATUSES = ['open', 'on_hold', 'closed'] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];
export const REQUIREMENT_STATUS_LABEL: Record<RequirementStatus, string> = {
  open: 'Open',
  on_hold: 'On hold',
  closed: 'Closed',
};

export const RECONFIRM_DAYS = 30;
export const DUPLICATE_RADIUS_M = 30;
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes, in milliseconds (the v2 expiry bug fix)
export const OTP_RESEND_MS = 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SHORT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const USERNAME_CHANGE_DAYS = 30;
export const NOTES_MAX = 1000;

export const USERNAME_RE = /^[a-z0-9._]{4,20}$/;
export const DRIVE_FOLDER_PREFIX = 'https://drive.google.com/drive/folders/';
