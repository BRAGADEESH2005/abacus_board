import { avatarColor, initials } from '@/lib/format';

export function Avatar({ name, fileId, size = 36, ring }: { name: string; fileId?: string | null; size?: number; ring?: number }) {
  const inner = fileId ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="avatar" src={`/api/files/${fileId}`} alt={name} width={size} height={size} style={{ width: size, height: size }} />
  ) : (
    <span className="avatar" style={{ width: size, height: size, background: avatarColor(name), fontSize: Math.max(11, size * 0.38) }} aria-label={name}>
      {initials(name)}
    </span>
  );
  if (ring === undefined) return inner;
  const r = size / 2 + 3;
  const c = 2 * Math.PI * r;
  const box = size + 10;
  return (
    <span className="ring" style={{ width: size, height: size }} title={`Profile ${Math.round(ring)}% complete`}>
      {inner}
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden>
        <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
        <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke={ring >= 100 ? 'var(--green)' : 'var(--maroon)'} strokeWidth="3" strokeDasharray={`${(c * ring) / 100} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${box / 2} ${box / 2})`} />
      </svg>
    </span>
  );
}
