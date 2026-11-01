// Zod schemas shared by client forms and API routes (server always re-validates).
import { z } from 'zod';
import {
  CONDITION_ACCEPTED,
  DEALT_WITH,
  DRIVE_FOLDER_PREFIX,
  FLOOR_COUNTS,
  FORMATS,
  NOTES_MAX,
  PARKING_TYPES,
  PREFERRED_FLOORS,
  PROPERTY_CONDITIONS,
  SECTORS,
  STORE_MODELS,
  TOILET_OPTIONS,
  USERNAME_RE,
} from './constants';
import { normalizePhone } from './format';

const str = (max = 200) => z.string().trim().max(max, `Keep this under ${max} characters`);
const optStr = (max = 200) => str(max).optional().default('');
const posNum = (label: string, max = 1e7) =>
  z.coerce.number({ invalid_type_error: `${label} must be a number` }).positive(`${label} must be more than 0`).max(max, `${label} looks too large`);
const optNum = (label: string, max = 1e7) =>
  z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), z.coerce.number({ invalid_type_error: `${label} must be a number` }).min(0, `${label} cannot be negative`).max(max, `${label} looks too large`).nullable());

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid 10 digit Indian mobile number' });
      return z.NEVER;
    }
    return n;
  });
export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(200);
export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Keep the password under 128 characters')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use letters and at least one number');
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_RE, '4 to 20 characters: lowercase letters, numbers, dot and underscore');

/* ───────────── Auth ───────────── */

export const otpSendSchema = z.object({
  purpose: z.enum(['signup', 'change_email', 'change_phone']),
  channel: z.enum(['email', 'whatsapp']),
  target: z.string().trim().min(3).max(200),
});
export const otpVerifySchema = z.object({ otpId: z.string().min(10).max(40), code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6 digit code') });

export const signupSchema = z
  .object({
    fullName: str(80).min(2, 'Enter your full name'),
    username: usernameSchema,
    phone: phoneSchema,
    altPhone: z.string().trim().max(20).optional().default(''),
    email: emailSchema,
    city: str(60).min(1, 'Pick the city you are based in'),
    company: str(120).min(1, 'Enter your company name'),
    password: passwordSchema,
    confirmPassword: z.string(),
    emailTicket: z.string().min(10, 'Verify your email first'),
    phoneTicket: z.string().optional().default(''),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your username, phone or email').max(200),
  password: z.string().min(1, 'Enter your password').max(128),
  remember: z.boolean().optional().default(true),
});

export const adminLoginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password').max(128) });

export const forgotSchema = z.object({
  role: z.enum(['broker', 'admin']),
  identifier: z.string().trim().min(3).max(200),
  channel: z.enum(['email', 'whatsapp']).default('email'),
});
export const resetSchema = z
  .object({ otpId: z.string().min(10).max(40), code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6 digit code'), password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

/* ───────────── Profile ───────────── */

export const profileSchema = z.object({
  fullName: str(80).min(2, 'Enter your full name'),
  company: str(120).min(1, 'Enter your company name'),
  city: str(60).min(1),
  altPhone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .default('')
    .refine((v) => !v || normalizePhone(v), 'Enter a valid 10 digit number or leave it blank'),
  microMarkets: z.array(z.object({ city: str(60), name: str(80) })).max(60).default([]),
});

/* ───────────── Requirement (Admin v2, section 2) ───────────── */

const rangeOk = (d: { carpetMin: number; carpetMax: number; rentMin: number; rentMax: number }) => d.carpetMax >= d.carpetMin && d.rentMax >= d.rentMin;

export const brandInput = z.object({
  id: z.string().optional().default(''),
  name: str(120).min(1, 'Enter or pick the brand'),
  sector: z.enum(SECTORS, { errorMap: () => ({ message: 'Pick a sector' }) }),
  contactName: optStr(120),
  designation: optStr(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .default('')
    .refine((v) => !v || normalizePhone(v), 'Enter a valid phone number'),
  email: z.string().trim().toLowerCase().max(200).optional().default('').refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email'),
  storeModel: z.enum(['', ...STORE_MODELS]).optional().default(''),
  fee: z.coerce.number().refine((v) => v === 15 || v === 30, 'Pick our fee'),
  paysNothing: z.boolean().optional().default(false),
});

export const brandValues = z
  .object({
    formats: z.array(z.enum(FORMATS)).min(1, 'Tick at least one format'),
    carpetMin: posNum('Carpet area minimum'),
    carpetMax: posNum('Carpet area maximum'),
    rentMin: posNum('Rent minimum', 1e5),
    rentMax: posNum('Rent maximum', 1e5),
    minFrontage: optNum('Minimum frontage', 1000),
    floors: z.array(z.enum(PREFERRED_FLOORS)).min(1, 'Pick at least one floor'),
    minCeiling: optNum('Minimum ceiling height', 200),
    minPowerKva: optNum('Minimum power', 100000),
    conditionAccepted: z.enum(['', ...CONDITION_ACCEPTED]).optional().default(''),
    parkingCars: optNum('Car parking', 1000),
    parkingBikes: optNum('Two wheeler parking', 1000),
    signage: optStr(200),
    otherSpecs: optStr(600),
    maxDepositMonths: optNum('Maximum deposit', 60),
    leaseYears: optNum('Lease term', 99),
    lockInYears: optNum('Lock in', 99),
    priority: z.enum(['normal', 'high']).default('normal'),
    receivedOn: z.string().optional().default(''),
    internalNotes: optStr(2000),
  })
  .refine((d) => d.carpetMax >= d.carpetMin, { path: ['carpetMax'], message: 'Max must be at least min' })
  .refine((d) => d.rentMax >= d.rentMin, { path: ['rentMax'], message: 'Max must be at least min' });

export const stretchOverride = z
  .object({ stretch: str(80).min(1), carpetMin: posNum('Carpet min'), carpetMax: posNum('Carpet max'), rentMin: posNum('Rent min', 1e5), rentMax: posNum('Rent max', 1e5) })
  .refine(rangeOk, { message: 'Each max must be at least its min' });

export const locationRow = z
  .object({
    city: str(60).min(1),
    microMarket: str(80).min(1),
    stretches: z.array(str(80)).max(30).default([]),
    storesWanted: z.coerce.number().int().min(1, 'At least 1 store').max(500),
    carpetMin: posNum('Carpet min'),
    carpetMax: posNum('Carpet max'),
    rentMin: posNum('Rent min', 1e5),
    rentMax: posNum('Rent max', 1e5),
    overrides: z.array(stretchOverride).max(30).default([]),
  })
  .refine(rangeOk, { message: 'Each max must be at least its min' });

export const postRequirementSchema = z.object({
  brand: brandInput,
  values: brandValues,
  rows: z.array(locationRow).min(1, 'Pick at least one micro market'),
});

export const editRequirementSchema = z.object({
  values: brandValues,
  row: locationRow,
  status: z.enum(['open', 'on_hold', 'closed']),
});

/* ───────────── Property (Broker v2, section 4) ───────────── */

const yesNo = z.preprocess((v) => (v === '' || v === undefined ? null : v === 'yes' ? true : v === 'no' ? false : v), z.boolean().nullable());
const enumOrEmpty = <T extends readonly [string, ...string[]]>(vals: T) => z.union([z.enum(vals), z.literal('')]);

export const propertyDraftSchema = z
  .object({
    city: str(60),
    microMarket: optStr(80),
    stretch: optStr(80),
    format: enumOrEmpty(FORMATS),
    address: optStr(400),
    buildingName: optStr(120),
    mainRoad: optStr(120),
    lat: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.number().min(-90).max(90).nullable()),
    lng: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.number().min(-180).max(180).nullable()),
    pinLink: optStr(600),
    chargeableArea: optNum('Chargeable area'),
    carpetArea: optNum('Carpet area'),
    floorCount: enumOrEmpty(FLOOR_COUNTS),
    floorAreas: z.array(z.preprocess((v) => (v === '' || v === null ? 0 : v), z.coerce.number().min(0).max(1e7))).max(5).default([]),
    sameLayout: z.boolean().default(true),
    ceilingHeight: optNum('Ceiling height', 200),
    frontage: optNum('Frontage', 2000),
    floorPlan: z.any().optional().nullable(),
    rent: optNum('Quoted rent', 1e5),
    depositMonths: optNum('Security deposit', 120),
    maintenance: optNum('Maintenance'),
    escalation: optStr(120),
    landlordName: optStr(120),
    dealtWith: enumOrEmpty(DEALT_WITH),
    powerKva: optNum('Total power', 100000),
    powerBackup: yesNo,
    lift: yesNo,
    bikeSlots: optNum('Bike parking', 10000),
    bikeType: enumOrEmpty(PARKING_TYPES),
    carSlots: optNum('Car parking', 10000),
    carType: enumOrEmpty(PARKING_TYPES),
    toilets: enumOrEmpty(TOILET_OPTIONS),
    signageSpace: yesNo,
    septicBelow: yesNo,
    windows: yesNo,
    electricalBoards: yesNo,
    condition: enumOrEmpty(PROPERTY_CONDITIONS),
    availableDate: z.string().optional().default(''),
    driveLink: optStr(600),
    notes: optStr(NOTES_MAX),
  })
  .superRefine((d, ctx) => {
    if (d.carpetArea && d.chargeableArea && d.carpetArea > d.chargeableArea) {
      ctx.addIssue({ code: 'custom', path: ['carpetArea'], message: 'Carpet area cannot be more than chargeable area' });
    }
    if (d.driveLink && !d.driveLink.startsWith(DRIVE_FOLDER_PREFIX)) {
      ctx.addIssue({
        code: 'custom',
        path: ['driveLink'],
        message: d.driveLink.startsWith('https://drive.google.com/') ? 'Paste the folder link, not a file link' : `The link must start with ${DRIVE_FOLDER_PREFIX}`,
      });
    }
    if (d.availableDate && Number.isNaN(Date.parse(d.availableDate))) {
      ctx.addIssue({ code: 'custom', path: ['availableDate'], message: 'Enter a valid date' });
    }
  });
export type PropertyDraftInput = z.input<typeof propertyDraftSchema>;

/* ───────────── Settings ───────────── */

export const settingsTextSchema = z.object({
  weeklyTarget: z.coerce.number().int().min(1).max(100),
  sopLink: z.string().trim().max(600).refine((v) => !v || /^https:\/\//.test(v), 'Use an https link').default(''),
  sopIntro: str(1000).default(''),
  sopShots: str(4000).default(''),
  sopFolders: str(2000).default(''),
  sopShare: str(2000).default(''),
  notesHelp: str(3000).default(''),
  measureVideoUrl: z.string().trim().max(600).refine((v) => !v || /^https:\/\//.test(v), 'Use an https link').default(''),
  levels: z
    .array(z.object({ key: z.enum(['scout', 'pro', 'partner', 'elite']), name: str(30).min(1), threshold: z.coerce.number().int().min(0).max(1000) }))
    .length(4),
});
