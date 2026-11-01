import 'server-only';
import { Settings, type SettingsDoc } from '@/models';

/** Starting city list. Cities marked enabled are the broker sign up list from Broker Side Changes v2;
 *  the rest carry the city codes from the Broker Side Skeleton and can be switched on in Settings. */
export const DEFAULT_CITIES = [
  { name: 'Chennai', code: 'CHN', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, enabled: true, microMarkets: [
    { name: 'Anna Nagar', lat: 13.085, lng: 80.2101, stretches: ['2nd Avenue'] },
    { name: 'Porur', lat: 13.0382, lng: 80.1565, stretches: [] },
    { name: 'T Nagar', lat: 13.0418, lng: 80.2341, stretches: [] },
    { name: 'Velachery', lat: 12.9815, lng: 80.218, stretches: [] },
  ] },
  { name: 'Coimbatore', code: 'CBE', state: 'Tamil Nadu', lat: 11.0168, lng: 76.9558, enabled: true, microMarkets: [
    { name: 'RS Puram', lat: 11.008, lng: 76.9497, stretches: ['DB Road'] },
    { name: 'Gandhipuram', lat: 11.018, lng: 76.9675, stretches: [] },
  ] },
  { name: 'Erode', code: 'ERD', state: 'Tamil Nadu', lat: 11.341, lng: 77.7172, enabled: true, microMarkets: [
    { name: 'Perundurai Road', lat: 11.333, lng: 77.696, stretches: [] },
  ] },
  { name: 'Salem', code: 'SLM', state: 'Tamil Nadu', lat: 11.6643, lng: 78.146, enabled: true, microMarkets: [] },
  { name: 'Madurai', code: 'MDU', state: 'Tamil Nadu', lat: 9.9252, lng: 78.1198, enabled: true, microMarkets: [] },
  { name: 'Mysuru', code: 'MYS', state: 'Karnataka', lat: 12.2958, lng: 76.6394, enabled: true, microMarkets: [] },
  { name: 'Trivandrum', code: 'TRV', state: 'Kerala', lat: 8.5241, lng: 76.9366, enabled: true, microMarkets: [] },
  { name: 'Kochi', code: 'COK', state: 'Kerala', lat: 9.9312, lng: 76.2673, enabled: true, microMarkets: [
    { name: 'MG Road', lat: 9.97, lng: 76.285, stretches: [] },
    { name: 'Edappally', lat: 10.0261, lng: 76.3083, stretches: [] },
  ] },
  { name: 'Tiruchirappalli', code: 'TRY', state: 'Tamil Nadu', lat: 10.7905, lng: 78.7047, enabled: false, microMarkets: [] },
  { name: 'Tiruppur', code: 'TPR', state: 'Tamil Nadu', lat: 11.1085, lng: 77.3411, enabled: false, microMarkets: [] },
  { name: 'Bengaluru', code: 'BLR', state: 'Karnataka', lat: 12.9716, lng: 77.5946, enabled: false, microMarkets: [] },
  { name: 'Mangaluru', code: 'MLR', state: 'Karnataka', lat: 12.9141, lng: 74.856, enabled: false, microMarkets: [] },
  { name: 'Kozhikode', code: 'CCJ', state: 'Kerala', lat: 11.2588, lng: 75.7804, enabled: false, microMarkets: [] },
  { name: 'Thrissur', code: 'TCR', state: 'Kerala', lat: 10.5276, lng: 76.2144, enabled: false, microMarkets: [] },
];

export const DEFAULT_LEVELS = [
  { key: 'scout', name: 'Scout', threshold: 0 },
  { key: 'pro', name: 'Pro', threshold: 5 },
  { key: 'partner', name: 'Partner', threshold: 1 },
  { key: 'elite', name: 'Elite', threshold: 1 },
];

export const DEFAULT_TEXTS = {
  sopIntro:
    'Shoot in landscape, in daylight, with the shutter fully open and lights on. Upload original files, not WhatsApp forwarded ones.',
  sopShots: [
    'Front elevation, straight on from across the road, full building | Photo',
    'Storefront close up, straight and level, full shutter width, nobody blocking | Photo',
    'Storefront from left and right at 45° | Photo',
    'Interior from the entrance looking in, and from the back looking out | Photo',
    'Each interior corner | Photo',
    'Ceiling, flooring, staircase, toilet, electrical panel | Photo',
    'Signage area and parking | Photo',
    'Road in both directions from the entrance | Photo',
    'Walkthrough from entrance to back, slow, 30 to 60 seconds | Video',
    '360° turn at the entrance, 20 to 30 seconds | Video',
    'Approach along the road towards the store | Video',
    'Hand sketch of the floor plan with measurements, if you made one | Photo',
  ].join('\n'),
  sopFolders: [
    '01 Elevation',
    '02 Storefront',
    '03 Interior',
    '04 Services (ceiling, floor, staircase, toilet, panel)',
    '05 Signage and parking',
    '06 Road views',
    '07 Videos',
    '08 Floor plan sketch',
  ].join('\n'),
  sopShare: [
    'In Google Drive, right click the main folder and choose Share.',
    'Under General access, pick Anyone with the link, role Viewer.',
    'Click Copy link and paste it into the Google Drive folder link field.',
  ].join('\n'),
  notesHelp: [
    'Brands already nearby: fashion, jewellery, food, electronics, banks. Name them and how far (e.g. Tanishq next door, Zudio 100 m).',
    'What drives footfall: metro or bus stop, college, hospital, temple, mall, office park.',
    'Visibility: corner plot, set back from the road, trees or flyover blocking the front.',
    'Landlord points: flexible on rent, wants a long lease, open to fit out help, other tenants in the building.',
    'Your own view: which kind of brand this suits best, and why.',
    'Anything a photo cannot show: water logging in rain, parking rules, one way road.',
  ].join('\n'),
};

export async function ensureSettings(): Promise<void> {
  const exists = await Settings.findById('global').lean();
  if (exists) return;
  await Settings.create({
    _id: 'global',
    cities: DEFAULT_CITIES.map((c) => ({ ...c, microMarkets: c.microMarkets.map((m) => ({ radiusM: 1200, ...m })) })),
    weeklyTarget: 4,
    levels: DEFAULT_LEVELS,
    ...DEFAULT_TEXTS,
  });
}

export async function getSettings(): Promise<SettingsDoc> {
  let s = await Settings.findById('global').lean<SettingsDoc>();
  if (!s) {
    await ensureSettings();
    s = await Settings.findById('global').lean<SettingsDoc>();
  }
  return s!;
}

export function cityByName(s: SettingsDoc, name: string) {
  return s.cities.find((c) => c.name === name);
}

export function microMarketOf(s: SettingsDoc, city: string, mm: string) {
  return cityByName(s, city)?.microMarkets.find((m) => m.name === mm);
}

export function levelName(s: SettingsDoc, key: string): string {
  return s.levels.find((l) => l.key === key)?.name ?? key;
}

/** Location lists as plain JSON for client dropdowns. */
export function locationLists(s: SettingsDoc, includeDisabled = false) {
  return s.cities
    .filter((c) => includeDisabled || c.enabled)
    .map((c) => ({
      name: c.name,
      code: c.code,
      state: c.state,
      lat: c.lat ?? null,
      lng: c.lng ?? null,
      enabled: c.enabled,
      microMarkets: c.microMarkets.map((m) => ({ name: m.name, lat: m.lat, lng: m.lng, radiusM: m.radiusM, stretches: m.stretches ?? [] })),
    }));
}
export type LocationList = ReturnType<typeof locationLists>;
