// Profile completeness for the ring around the broker photo (Broker v2, section 3b).

export type ProfileLike = {
  avatarFileId?: string | null;
  username?: string;
  fullName?: string;
  company?: string;
  city?: string;
  microMarkets?: { city: string; name: string }[];
  phoneVerified?: boolean;
  emailVerified?: boolean;
  altPhone?: string;
};

export function profileCompleteness(p: ProfileLike, whatsapp: boolean) {
  const items: { ok: boolean; nudge: string }[] = [
    { ok: Boolean(p.fullName), nudge: 'Add your full name' },
    { ok: Boolean(p.username), nudge: 'Pick a username' },
    { ok: Boolean(p.company), nudge: 'Add your company name' },
    { ok: Boolean(p.city), nudge: 'Pick the city you are based in' },
    { ok: Boolean(p.emailVerified), nudge: 'Verify your email' },
    ...(whatsapp ? [{ ok: Boolean(p.phoneVerified), nudge: 'Verify your WhatsApp number' }] : []),
    { ok: Boolean(p.avatarFileId), nudge: 'Add a profile photo so Abacus recognises your listings' },
    { ok: (p.microMarkets?.length ?? 0) > 0, nudge: 'Tell Abacus which micro markets you cover' },
    { ok: Boolean(p.altPhone), nudge: 'Add an alternate phone number' },
  ];
  const done = items.filter((i) => i.ok).length;
  return { pct: Math.round((done / items.length) * 100), next: items.find((i) => !i.ok)?.nudge ?? null };
}
