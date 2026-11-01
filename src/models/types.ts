// Explicit document shapes for every collection. Keep in step with the schemas in ./index.ts.
import type { Types } from 'mongoose';

type Id = Types.ObjectId;

export interface HistoryEntry {
  stage: string;
  note?: string | null;
  by?: Id | null;
  byName?: string | null;
  at: Date;
}

export interface AdminDoc {
  _id: Id;
  name: string;
  email: string;
  passwordHash: string;
  envFingerprint: string;
  emailVerifiedAt: Date | null;
  trustedDevices: { hash: string; label?: string; createdAt: Date; lastSeenAt?: Date }[];
  failedLogins: number;
  lockUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrokerDoc {
  _id: Id;
  fullName: string;
  username: string;
  usernameChangedAt: Date | null;
  phone: string;
  phoneVerified: boolean;
  altPhone: string;
  email: string;
  emailVerified: boolean;
  city: string;
  company: string;
  microMarkets: { city: string; name: string }[];
  passwordHash: string;
  avatarFileId: Id | null;
  level: string;
  levelSeen: string;
  status: 'active' | 'disabled';
  failedLogins: number;
  lockUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OtpDoc {
  _id: Id;
  purpose: string;
  channel: 'email' | 'whatsapp';
  target: string;
  userType: 'admin' | 'broker' | 'none';
  userId: Id | null;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  lastSentAt: Date;
  sendCount: number;
  verifiedAt: Date | null;
  ticketHash: string | null;
  ticketExpiresAt: Date | null;
  consumedAt: Date | null;
  meta: Record<string, unknown>;
  createdAt: Date;
}

export interface SessionDoc {
  _id: Id;
  tokenHash: string;
  userType: 'admin' | 'broker';
  userId: Id;
  expiresAt: Date;
  persistent: boolean;
  userAgent: string;
  createdAt: Date;
  lastSeenAt: Date;
}

export interface MicroMarketDoc {
  _id: Id;
  name: string;
  lat: number | null;
  lng: number | null;
  radiusM: number;
  stretches: string[];
}

export interface CityDoc {
  _id: Id;
  name: string;
  code: string;
  state: string;
  lat?: number;
  lng?: number;
  enabled: boolean;
  microMarkets: MicroMarketDoc[];
}

export interface SettingsDoc {
  _id: string;
  cities: CityDoc[];
  weeklyTarget: number;
  sopLink: string;
  sopIntro: string;
  sopShots: string;
  sopFolders: string;
  sopShare: string;
  notesHelp: string;
  measureVideoUrl: string;
  levels: { key: string; name: string; threshold: number }[];
}

export interface BrandDoc {
  _id: Id;
  name: string;
  nameLower: string;
  sector: string;
  contactName: string;
  designation: string;
  phone: string;
  email: string;
  storeModel: string;
  fee: number;
  paysNothing: boolean;
  notes: string;
  createdBy?: Id;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandAskDoc {
  _id: Id;
  code: string;
  brand: Id;
  createdBy?: Id;
  createdByName?: string;
  values: Record<string, unknown>;
  createdAt: Date;
}

export interface RequirementDoc {
  _id: Id;
  code: string;
  sector: string;
  city: string;
  state: string;
  microMarket: string;
  stretches: string[];
  stretchCarpet: { stretch: string; carpetMin: number; carpetMax: number }[];
  formats: string[];
  carpetMin: number;
  carpetMax: number;
  rentBandMin: number;
  rentBandMax: number;
  minFrontage: number | null;
  floors: string[];
  minCeiling: number | null;
  minPowerKva: number | null;
  conditionAccepted: string;
  parkingCars: number | null;
  parkingBikes: number | null;
  signage: string;
  otherSpecs: string;
  maxDepositMonths: number | null;
  leaseYears: number | null;
  lockInYears: number | null;
  paysNothingNotice: boolean;
  priority: 'normal' | 'high';
  status: 'open' | 'on_hold' | 'closed';
  postedAt: Date;
  stillActiveAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequirementPrivateDoc {
  _id: Id;
  requirement: Id;
  brand: Id;
  brandAsk: Id;
  rentMin: number;
  rentMax: number;
  stretchRent: { stretch: string; rentMin: number; rentMax: number }[];
  storesWanted: number;
  fee: number;
  paysNothing: boolean;
  internalNotes: string;
  receivedOn: Date | null;
  createdBy?: Id;
  createdByName?: string;
}

export interface SavedDoc {
  _id: Id;
  broker: Id;
  requirement: Id;
  createdAt: Date;
}

export interface PropertyDoc {
  _id: Id;
  code: string;
  broker: Id;
  state: 'draft' | 'submitted' | 'merged';
  mergedInto: Id | null;
  submittedAt: Date | null;
  city: string;
  microMarket: string;
  stretch: string;
  format: string;
  address: string;
  buildingName: string;
  mainRoad: string;
  lat: number | null;
  lng: number | null;
  pinLink: string;
  chargeableArea: number | null;
  carpetArea: number | null;
  floorCount: string;
  floorAreas: number[];
  sameLayout: boolean;
  ceilingHeight: number | null;
  frontage: number | null;
  floorPlan: unknown;
  rent: number | null;
  depositMonths: number | null;
  maintenance: number | null;
  escalation: string;
  landlordName: string;
  dealtWith: string;
  goAheadFileId: Id | null;
  goAheadFileName: string;
  powerKva: number | null;
  powerBackup: boolean | null;
  lift: boolean | null;
  bikeSlots: number | null;
  bikeType: string;
  carSlots: number | null;
  carType: string;
  toilets: string;
  signageSpace: boolean | null;
  septicBelow: boolean | null;
  windows: boolean | null;
  electricalBoards: boolean | null;
  condition: string;
  availableDate: Date | null;
  driveLink: string;
  notes: string;
  listingStatus: 'available' | 'needs_reconfirm' | 'let_out' | 'withdrawn';
  lastConfirmedAt: Date | null;
  staleCount: number;
  adminStage: string;
  adminStageNote: string;
  stageHistory: HistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SuggestionDoc {
  _id: Id;
  property: Id;
  requirement: Id;
  broker: Id;
  note: string;
  status: 'pending' | 'pitched' | 'dismissed';
  createdAt: Date;
  reviewedAt: Date | null;
}

export interface PitchDoc {
  _id: Id;
  property: Id;
  requirement: Id;
  broker: Id;
  stage: string;
  stageNote: string;
  note: string;
  by?: Id;
  byName?: string;
  createdAt: Date;
  stageChangedAt: Date;
  history: HistoryEntry[];
}

export interface DismissedDoc {
  _id: Id;
  property: Id;
  requirement: Id;
  by?: Id;
  at: Date;
}

export interface DuplicateDoc {
  _id: Id;
  a: Id;
  b: Id;
  distanceM: number;
  status: 'pending' | 'merged' | 'kept_both';
  resolvedBy?: Id;
  resolvedByName?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface NotificationDoc {
  _id: Id;
  kind: 'activity' | 'flag' | 'summary';
  key?: string;
  title: string;
  body: string;
  link: string;
  data: Record<string, unknown>;
  readBy: Id[];
  resolvedAt: Date | null;
  createdAt: Date;
}
