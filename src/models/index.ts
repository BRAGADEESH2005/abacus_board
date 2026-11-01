import 'server-only';
import mongoose, { Schema, type Model, type SchemaOptions } from 'mongoose';
import type * as T from './types';
export type * from './types';

const { ObjectId } = Schema.Types;

// Schemas are left untyped on purpose (Mongoose type inference on schemas this size stalls the
// TypeScript compiler); the document shapes are declared explicitly in ./types.ts instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function S(def: Record<string, unknown>, opts?: SchemaOptions): Schema {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Schema(def as any, opts as any);
}

function model<D>(name: string, schema: Schema): Model<D> {
  // Note: mongoose.model<D>() with a generic D sends tsc into a near infinite instantiation; cast instead.
  return (mongoose.models[name] as Model<D>) ?? (mongoose.model(name, schema) as unknown as Model<D>);
}

/* ───────────── Accounts ───────────── */

const AdminSchema = S(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    envFingerprint: { type: String, default: '' },
    emailVerifiedAt: { type: Date, default: null },
    trustedDevices: [
      { hash: String, label: String, createdAt: { type: Date, default: Date.now }, lastSeenAt: Date, _id: false },
    ],
    failedLogins: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true },
);
export const Admin = model<T.AdminDoc>('Admin', AdminSchema);

const BrokerSchema = S(
  {
    fullName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    usernameChangedAt: { type: Date, default: null },
    phone: { type: String, required: true, unique: true },
    phoneVerified: { type: Boolean, default: false },
    altPhone: { type: String, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerified: { type: Boolean, default: false },
    city: { type: String, required: true },
    company: { type: String, required: true, trim: true },
    microMarkets: [{ city: String, name: String, _id: false }],
    passwordHash: { type: String, required: true },
    avatarFileId: { type: ObjectId, default: null },
    level: { type: String, default: 'scout' },
    levelSeen: { type: String, default: 'scout' },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    failedLogins: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true },
);
export const Broker = model<T.BrokerDoc>('Broker', BrokerSchema);

const OtpSchema = S(
  {
    purpose: { type: String, required: true }, // signup | reset | admin_device | change_email | change_phone
    channel: { type: String, enum: ['email', 'whatsapp'], required: true },
    target: { type: String, required: true },
    userType: { type: String, enum: ['admin', 'broker', 'none'], default: 'none' },
    userId: { type: ObjectId, default: null },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
    sendCount: { type: Number, default: 1 },
    verifiedAt: { type: Date, default: null },
    ticketHash: { type: String, default: null },
    ticketExpiresAt: { type: Date, default: null },
    consumedAt: { type: Date, default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);
OtpSchema.index({ target: 1, purpose: 1, createdAt: -1 });
export const Otp = model<T.OtpDoc>('Otp', OtpSchema);

const SessionSchema = S({
  tokenHash: { type: String, required: true, unique: true },
  userType: { type: String, enum: ['admin', 'broker'], required: true },
  userId: { type: ObjectId, required: true },
  expiresAt: { type: Date, required: true },
  persistent: { type: Boolean, default: true },
  userAgent: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
});
SessionSchema.index({ userId: 1 });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Session = model<T.SessionDoc>('Session', SessionSchema);

/* ───────────── Settings ───────────── */

const MicroMarketSchema = S({
  name: { type: String, required: true },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  radiusM: { type: Number, default: 1200 },
  stretches: [String],
});
const CitySchema = S({
  name: { type: String, required: true },
  code: { type: String, required: true },
  state: { type: String, required: true },
  lat: Number,
  lng: Number,
  enabled: { type: Boolean, default: true },
  microMarkets: [MicroMarketSchema],
});
const SettingsSchema = S(
  {
    _id: { type: String, default: 'global' },
    cities: [CitySchema],
    weeklyTarget: { type: Number, default: 4 },
    sopLink: { type: String, default: '' },
    sopIntro: { type: String, default: '' },
    sopShots: { type: String, default: '' },
    sopFolders: { type: String, default: '' },
    sopShare: { type: String, default: '' },
    notesHelp: { type: String, default: '' },
    measureVideoUrl: { type: String, default: '' },
    levels: [{ key: String, name: String, threshold: Number, _id: false }],
  },
  { timestamps: true },
);
export const Settings = model<T.SettingsDoc>('Settings', SettingsSchema);

/* ───────────── Brands and requirements ───────────── */

const BrandSchema = S(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, unique: true },
    sector: { type: String, required: true },
    contactName: { type: String, default: '' },
    designation: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    storeModel: { type: String, default: '' },
    fee: { type: Number, enum: [15, 30], default: 30 },
    paysNothing: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    createdBy: { type: ObjectId, ref: 'Admin' },
    createdByName: String,
  },
  { timestamps: true },
);
export const Brand = model<T.BrandDoc>('Brand', BrandSchema);

const BrandAskSchema = S(
  {
    code: { type: String, required: true, unique: true },
    brand: { type: ObjectId, ref: 'Brand', required: true },
    createdBy: { type: ObjectId, ref: 'Admin' },
    createdByName: String,
    values: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);
export const BrandAsk = model<T.BrandAskDoc>('BrandAsk', BrandAskSchema);

/** Realtor visible requirement record. Never holds brand identity or exact rent. */
const RequirementSchema = S(
  {
    code: { type: String, required: true, unique: true },
    sector: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    microMarket: { type: String, required: true },
    stretches: [String],
    stretchCarpet: [{ stretch: String, carpetMin: Number, carpetMax: Number, _id: false }],
    formats: [String],
    carpetMin: { type: Number, required: true },
    carpetMax: { type: Number, required: true },
    rentBandMin: { type: Number, required: true },
    rentBandMax: { type: Number, required: true },
    minFrontage: { type: Number, default: null },
    floors: [String],
    minCeiling: { type: Number, default: null },
    minPowerKva: { type: Number, default: null },
    conditionAccepted: { type: String, default: '' },
    parkingCars: { type: Number, default: null },
    parkingBikes: { type: Number, default: null },
    signage: { type: String, default: '' },
    otherSpecs: { type: String, default: '' },
    maxDepositMonths: { type: Number, default: null },
    leaseYears: { type: Number, default: null },
    lockInYears: { type: Number, default: null },
    paysNothingNotice: { type: Boolean, default: false },
    priority: { type: String, enum: ['normal', 'high'], default: 'normal' },
    status: { type: String, enum: ['open', 'on_hold', 'closed'], default: 'open' },
    postedAt: { type: Date, default: Date.now },
    stillActiveAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
RequirementSchema.index({ status: 1, city: 1, microMarket: 1 });
export const Requirement = model<T.RequirementDoc>('Requirement', RequirementSchema);

/** Admin only companion record: brand, exact rent, stores, fee, notes. */
const RequirementPrivateSchema = S(
  {
    requirement: { type: ObjectId, ref: 'Requirement', required: true, unique: true },
    brand: { type: ObjectId, ref: 'Brand', required: true },
    brandAsk: { type: ObjectId, ref: 'BrandAsk', required: true },
    rentMin: { type: Number, required: true },
    rentMax: { type: Number, required: true },
    stretchRent: [{ stretch: String, rentMin: Number, rentMax: Number, _id: false }],
    storesWanted: { type: Number, default: 1 },
    fee: { type: Number, default: 30 },
    paysNothing: { type: Boolean, default: false },
    internalNotes: { type: String, default: '' },
    receivedOn: { type: Date, default: null },
    createdBy: { type: ObjectId, ref: 'Admin' },
    createdByName: String,
  },
  { timestamps: true },
);
RequirementPrivateSchema.index({ brand: 1 });
export const RequirementPrivate = model<T.RequirementPrivateDoc>('RequirementPrivate', RequirementPrivateSchema);

const SavedSchema = S({
  broker: { type: ObjectId, ref: 'Broker', required: true },
  requirement: { type: ObjectId, ref: 'Requirement', required: true },
  createdAt: { type: Date, default: Date.now },
});
SavedSchema.index({ broker: 1, requirement: 1 }, { unique: true });
export const SavedRequirement = model<T.SavedDoc>('SavedRequirement', SavedSchema);

/* ───────────── Properties, suggestions, pitches ───────────── */

const HistorySchema = S(
  { stage: String, note: String, by: ObjectId, byName: String, at: { type: Date, default: Date.now } },
  { _id: false },
);

const PropertySchema = S(
  {
    code: { type: String, required: true, unique: true },
    broker: { type: ObjectId, ref: 'Broker', required: true },
    state: { type: String, enum: ['draft', 'submitted', 'merged'], default: 'draft' },
    mergedInto: { type: ObjectId, ref: 'Property', default: null },
    submittedAt: { type: Date, default: null, immutable: (doc: { submittedAt?: Date | null }) => Boolean(doc.submittedAt) },
    // A Basics
    city: { type: String, required: true },
    microMarket: { type: String, default: '' },
    stretch: { type: String, default: '' },
    format: { type: String, default: '' },
    address: { type: String, default: '' },
    buildingName: { type: String, default: '' },
    mainRoad: { type: String, default: '' },
    // B Location
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    pinLink: { type: String, default: '' },
    // C Area and floors
    chargeableArea: { type: Number, default: null },
    carpetArea: { type: Number, default: null },
    floorCount: { type: String, default: '' },
    floorAreas: [Number],
    sameLayout: { type: Boolean, default: true },
    ceilingHeight: { type: Number, default: null },
    frontage: { type: Number, default: null },
    floorPlan: { type: Schema.Types.Mixed, default: null },
    // D Commercials and landlord
    rent: { type: Number, default: null },
    depositMonths: { type: Number, default: null },
    maintenance: { type: Number, default: null },
    escalation: { type: String, default: '' },
    landlordName: { type: String, default: '' },
    dealtWith: { type: String, default: '' },
    goAheadFileId: { type: ObjectId, default: null },
    goAheadFileName: { type: String, default: '' },
    // E Building and services
    powerKva: { type: Number, default: null },
    powerBackup: { type: Boolean, default: null },
    lift: { type: Boolean, default: null },
    bikeSlots: { type: Number, default: null },
    bikeType: { type: String, default: '' },
    carSlots: { type: Number, default: null },
    carType: { type: String, default: '' },
    toilets: { type: String, default: '' },
    signageSpace: { type: Boolean, default: null },
    // F Inside the premises
    septicBelow: { type: Boolean, default: null },
    windows: { type: Boolean, default: null },
    electricalBoards: { type: Boolean, default: null },
    // G Status
    condition: { type: String, default: '' },
    availableDate: { type: Date, default: null },
    // H Photos and notes
    driveLink: { type: String, default: '' },
    notes: { type: String, default: '' },
    // Listing and review
    listingStatus: { type: String, enum: ['available', 'needs_reconfirm', 'let_out', 'withdrawn'], default: 'available' },
    lastConfirmedAt: { type: Date, default: null },
    staleCount: { type: Number, default: 0 },
    adminStage: { type: String, default: 'Received' },
    adminStageNote: { type: String, default: '' },
    stageHistory: [HistorySchema],
  },
  { timestamps: true },
);
PropertySchema.index({ broker: 1, state: 1 });
PropertySchema.index({ city: 1, microMarket: 1, state: 1 });
export const Property = model<T.PropertyDoc>('Property', PropertySchema);

const SuggestionSchema = S({
  property: { type: ObjectId, ref: 'Property', required: true },
  requirement: { type: ObjectId, ref: 'Requirement', required: true },
  broker: { type: ObjectId, ref: 'Broker', required: true },
  note: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'pitched', 'dismissed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date, default: null },
});
SuggestionSchema.index({ property: 1, requirement: 1 }, { unique: true });
SuggestionSchema.index({ broker: 1, createdAt: -1 });
export const Suggestion = model<T.SuggestionDoc>('Suggestion', SuggestionSchema);

const PitchSchema = S({
  property: { type: ObjectId, ref: 'Property', required: true },
  requirement: { type: ObjectId, ref: 'Requirement', required: true },
  broker: { type: ObjectId, ref: 'Broker', required: true },
  stage: { type: String, default: 'Pitched' },
  stageNote: { type: String, default: '' },
  note: { type: String, default: '' },
  by: { type: ObjectId, ref: 'Admin' },
  byName: String,
  createdAt: { type: Date, default: Date.now },
  stageChangedAt: { type: Date, default: Date.now },
  history: [HistorySchema],
});
PitchSchema.index({ property: 1, requirement: 1 }, { unique: true });
PitchSchema.index({ requirement: 1 });
export const Pitch = model<T.PitchDoc>('Pitch', PitchSchema);

const DismissedSchema = S({
  property: { type: ObjectId, required: true },
  requirement: { type: ObjectId, required: true },
  by: ObjectId,
  at: { type: Date, default: Date.now },
});
DismissedSchema.index({ property: 1, requirement: 1 }, { unique: true });
export const DismissedMatch = model<T.DismissedDoc>('DismissedMatch', DismissedSchema);

const DuplicateSchema = S({
  a: { type: ObjectId, ref: 'Property', required: true }, // earlier upload
  b: { type: ObjectId, ref: 'Property', required: true }, // later upload
  distanceM: Number,
  status: { type: String, enum: ['pending', 'merged', 'kept_both'], default: 'pending' },
  resolvedBy: ObjectId,
  resolvedByName: String,
  resolvedAt: Date,
  createdAt: { type: Date, default: Date.now },
});
DuplicateSchema.index({ a: 1, b: 1 }, { unique: true });
export const DuplicatePair = model<T.DuplicateDoc>('DuplicatePair', DuplicateSchema);

/* ───────────── Notifications and jobs ───────────── */

const NotificationSchema = S({
  kind: { type: String, enum: ['activity', 'flag', 'summary'], required: true },
  key: { type: String, default: undefined },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  link: { type: String, default: '' },
  data: { type: Schema.Types.Mixed, default: {} },
  readBy: [ObjectId],
  resolvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});
NotificationSchema.index({ key: 1 }, { unique: true, sparse: true });
NotificationSchema.index({ createdAt: -1 });
export const Notification = model<T.NotificationDoc>('Notification', NotificationSchema);

const CounterSchema = S({ _id: String, seq: { type: Number, default: 0 } });
export const Counter = model<{ _id: string; seq: number }>('Counter', CounterSchema);

const JobRunSchema = S({ _id: String, ranAt: { type: Date, default: Date.now } });
export const JobRun = model<{ _id: string; ranAt: Date }>('JobRun', JobRunSchema);
