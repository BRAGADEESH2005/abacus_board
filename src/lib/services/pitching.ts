import 'server-only';
import type { AdminSession } from '@/lib/auth';
import { ApiError } from '@/lib/http';
import { PITCH_STAGES, PROPERTY_LEVEL_STAGES, STAGE_RANK } from '@/lib/constants';
import { Brand, DismissedMatch, Pitch, Property, Requirement, RequirementPrivate, Suggestion } from '@/models';
import { activity } from './notify';

async function brandNameFor(reqId: unknown) {
  const priv = await RequirementPrivate.findOne({ requirement: reqId }).select('brand').lean();
  if (!priv) return '';
  return (await Brand.findById(priv.brand).select('name').lean())?.name ?? '';
}

/** Pitch = sending a property to a brand. Records date, admin and note; first pitch sets Pitched. */
export async function createPitches(pairs: { propertyId: string; requirementId: string }[], note: string, s: AdminSession) {
  const created: string[] = [];
  const skipped: string[] = [];
  for (const pair of pairs) {
    const [p, r] = await Promise.all([Property.findById(pair.propertyId), Requirement.findById(pair.requirementId)]);
    if (!p || p.state !== 'submitted') throw new ApiError(404, 'Property not found or not posted yet.');
    if (!r) throw new ApiError(404, 'Requirement not found.');
    if (r.status !== 'open') throw new ApiError(409, `${r.code} is not open.`);
    if (p.listingStatus !== 'available') {
      throw new ApiError(409, p.listingStatus === 'needs_reconfirm' ? `${p.code} needs reconfirming by the broker before it can be pitched.` : `${p.code} is no longer available.`);
    }
    const exists = await Pitch.findOne({ property: p._id, requirement: r._id }).select('_id').lean();
    if (exists) {
      skipped.push(`${p.code} → ${r.code}`);
      continue;
    }
    const now = new Date();
    await Pitch.create({
      property: p._id,
      requirement: r._id,
      broker: p.broker,
      stage: 'Pitched',
      note,
      by: s.admin._id,
      byName: s.admin.name,
      createdAt: now,
      stageChangedAt: now,
      history: [{ stage: 'Pitched', note, by: s.admin._id, byName: s.admin.name, at: now }],
    });
    await Suggestion.updateOne({ property: p._id, requirement: r._id }, { $set: { status: 'pitched', reviewedAt: now } });
    await DismissedMatch.deleteOne({ property: p._id, requirement: r._id });
    if ((STAGE_RANK[p.adminStage] ?? 0) < STAGE_RANK.Pitched! && p.adminStage !== 'Not closed') {
      p.adminStage = 'Pitched';
      p.stageHistory.push({ stage: 'Pitched', note: 'Automatic on the first pitch', by: s.admin._id, byName: s.admin.name, at: now });
      await p.save();
    }
    const brand = await brandNameFor(r._id);
    await activity(`Pitched ${p.code} to ${brand} (${r.code})`, `${r.microMarket}, ${r.city} · by ${s.admin.name}${note ? ` · ${note}` : ''}`, `/admin/requirements/${r._id}`);
    created.push(`${p.code} → ${r.code}`);
  }
  return { created, skipped };
}

export async function setPitchStage(pitchId: string, stage: string, note: string, s: AdminSession) {
  if (!(PITCH_STAGES as readonly string[]).includes(stage)) throw new ApiError(422, 'Pick a valid stage.');
  if (stage === 'Not closed' && !note.trim()) throw new ApiError(422, 'Add a short note for Not closed (e.g. Rent too high).', { note: 'Required' });
  const pitch = await Pitch.findById(pitchId);
  if (!pitch) throw new ApiError(404, 'Pitch not found.');
  if (pitch.stage === stage && (pitch.stageNote ?? '') === note) return pitch;
  const now = new Date();
  pitch.stage = stage;
  pitch.stageNote = stage === 'Not closed' ? note.trim() : note.trim();
  pitch.stageChangedAt = now;
  pitch.history.push({ stage, note: note.trim(), by: s.admin._id, byName: s.admin.name, at: now });
  await pitch.save();
  const [p, r] = await Promise.all([Property.findById(pitch.property).select('code').lean(), Requirement.findById(pitch.requirement).select('code microMarket city').lean()]);
  const brand = await brandNameFor(pitch.requirement);
  await activity(`${p?.code}: ${stage} with ${brand} (${r?.code})`, `${r?.microMarket}, ${r?.city} · by ${s.admin.name}${note ? ` · ${note}` : ''}`, `/admin/properties/${pitch.property}`);
  return pitch;
}

/** One click stage from the property card, map card or pending list. */
export async function setPropertyStage(propertyId: string, stage: string, note: string, pitchId: string | undefined, s: AdminSession) {
  const p = await Property.findById(propertyId);
  if (!p || p.state === 'draft') throw new ApiError(404, 'Property not found.');
  if (stage === 'Pitched') throw new ApiError(422, 'Pitched is set automatically when you pitch the property to a requirement.');
  if ((PROPERTY_LEVEL_STAGES as readonly string[]).includes(stage)) {
    if (stage === 'Not closed' && !note.trim()) throw new ApiError(422, 'Add a short note for Not closed (e.g. Property shortage).', { note: 'Required' });
    const now = new Date();
    p.adminStage = stage;
    p.adminStageNote = stage === 'Not closed' ? note.trim() : '';
    p.stageHistory.push({ stage, note: note.trim(), by: s.admin._id, byName: s.admin.name, at: now });
    await p.save();
    if (['Shortlisted', 'Not closed'].includes(stage)) {
      await activity(`${p.code}: ${stage}`, `${p.microMarket}, ${p.city} · by ${s.admin.name}${note ? ` · ${note}` : ''}`, `/admin/properties/${p._id}`);
    }
    return { property: p };
  }
  // Site visit done, Under negotiation, Closed belong to a pitch.
  const pitches = await Pitch.find({ property: p._id });
  if (!pitches.length) throw new ApiError(409, 'Pitch this property to a requirement first.');
  let target = pitchId ? pitches.find((x) => x._id.toString() === pitchId) : undefined;
  if (!target && pitches.length === 1) target = pitches[0];
  if (!target) throw new ApiError(409, 'This property is pitched to more than one brand. Pick which pitch.', undefined, { needPitch: true });
  await setPitchStage(target._id.toString(), stage, note, s);
  return { property: p };
}

export async function dismissMatch(propertyId: string, requirementId: string, s: AdminSession) {
  await DismissedMatch.updateOne({ property: propertyId, requirement: requirementId }, { $setOnInsert: { by: s.admin._id, at: new Date() } }, { upsert: true });
  await Suggestion.updateOne({ property: propertyId, requirement: requirementId, status: 'pending' }, { $set: { status: 'dismissed', reviewedAt: new Date() } });
}
