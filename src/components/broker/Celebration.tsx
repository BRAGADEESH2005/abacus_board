'use client';
import { useState } from 'react';
import { api } from '@/components/ui/api';

const LINES: Record<string, string> = {
  pro: 'Five complete listings with pins and floor plans. Abacus can pitch these with confidence.',
  partner: 'Abacus matched one of your properties to a brand. That is what the board is for.',
  elite: 'A deal closed through the board. Thank you for the partnership.',
};

/** Level up moment, shown once on the next login (Broker v2, 3b). */
export function Celebration({ level, name }: { level: string; name: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const close = () => {
    setOpen(false);
    api('/api/broker/level-seen', { method: 'POST' }).catch(() => null);
  };
  return (
    <div className="celebrate" role="status">
      <span className="medal" aria-hidden>
        🏅
      </span>
      <div className="grow">
        <b style={{ fontFamily: 'var(--display)', fontSize: 17 }}>You are now a {name} broker</b>
        <div className="small">{LINES[level] ?? 'You moved up a level.'}</div>
      </div>
      <button className="btn small" onClick={close}>
        Nice
      </button>
    </div>
  );
}
