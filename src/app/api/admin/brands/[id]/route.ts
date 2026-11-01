import { connectDB } from '@/lib/db';
import { apiAdmin } from '@/lib/auth';
import { ApiError, handler, ok, parseBody, requireId } from '@/lib/http';
import { brandInput } from '@/lib/validation';
import { Brand, Requirement, RequirementPrivate } from '@/models';
import { z } from 'zod';

export const PATCH = handler(async (req, ctx) => {
  await connectDB();
  await apiAdmin();
  const id = requireId((await ctx.params).id, 'brand');
  const d = await parseBody(req, brandInput.extend({ notes: z.string().trim().max(2000).optional().default('') }));
  const brand = await Brand.findById(id);
  if (!brand) throw new ApiError(404, 'Brand not found.');
  const nameLower = d.name.trim().toLowerCase();
  if (nameLower !== brand.nameLower && (await Brand.findOne({ nameLower }).select('_id').lean())) throw new ApiError(409, 'Another brand already has that name.');
  const sectorChanged = brand.sector !== d.sector;
  brand.set({ name: d.name.trim(), nameLower, sector: d.sector, contactName: d.contactName, designation: d.designation, phone: d.phone, email: d.email, storeModel: d.storeModel, fee: d.fee, paysNothing: d.paysNothing, notes: d.notes });
  await brand.save();
  // Keep the per requirement copies in step.
  const reqIds = (await RequirementPrivate.find({ brand: brand._id }).select('requirement').lean()).map((p) => p.requirement);
  await RequirementPrivate.updateMany({ brand: brand._id }, { $set: { fee: d.fee, paysNothing: d.paysNothing } });
  await Requirement.updateMany({ _id: { $in: reqIds } }, { $set: { paysNothingNotice: d.paysNothing, ...(sectorChanged ? { sector: d.sector } : {}) } });
  return ok({ ok: true });
});
