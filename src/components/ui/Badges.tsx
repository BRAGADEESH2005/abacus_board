import { stageClass } from '@/lib/domain';
import { LISTING_LABEL, type ListingStatus } from '@/lib/constants';

export function StageBadge({ stage }: { stage: string }) {
  return <span className={`pill ${stageClass(stage)}`}>{stage}</span>;
}

const LISTING_CLASS: Record<string, string> = { available: 'l-avail', needs_reconfirm: 'l-recon', let_out: 'l-let', withdrawn: 'l-wd' };
export function ListingBadge({ status, draft }: { status: string; draft?: boolean }) {
  if (draft) return <span className="pill l-draft">Draft</span>;
  return <span className={`pill ${LISTING_CLASS[status] ?? 'p-wait'}`}>{LISTING_LABEL[status as ListingStatus] ?? status}</span>;
}

export function LevelChip({ level, name }: { level: string; name: string }) {
  return <span className={`level ${level}`}>{name}</span>;
}

export function AdminOnly() {
  return <span className="tag admin">Admin only</span>;
}
export function RealtorsSee({ text = 'Realtors see' }: { text?: string }) {
  return <span className="tag realtor">{text}</span>;
}
