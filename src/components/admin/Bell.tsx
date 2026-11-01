'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/components/ui/api';
import { ago } from '@/lib/format';

type Item = { id: string; kind: 'activity' | 'flag' | 'summary'; title: string; body: string; link: string; createdAt: string; read: boolean };
const TABS = [
  { key: 'all', label: 'All' },
  { key: 'flags', label: 'Red flags' },
  { key: 'activity', label: 'Activity' },
  { key: 'summary', label: 'Daily summary' },
] as const;

/** Bell with red flags, live activity and the 9 am daily summary. Each admin reads separately. */
export function Bell() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('all');
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async (t = tab) => {
    setLoading(true);
    try {
      const r = await api<{ unread: number; items: Item[] }>(`/api/admin/notifications?tab=${t}&limit=40`);
      setItems(r.items);
      setUnread(r.unread);
    } catch {
      /* keep last state */
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    load('all');
    const t = setInterval(() => load(), 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const markRead = async (ids?: string[]) => {
    await api('/api/admin/notifications/read', { body: ids ? { ids } : { all: true } }).catch(() => null);
    setItems((xs) => xs.map((x) => (!ids || ids.includes(x.id) ? { ...x, read: true } : x)));
    setUnread((u) => (ids ? Math.max(0, u - ids.filter((id) => items.find((i) => i.id === id && !i.read)).length) : 0));
  };

  return (
    <div className="menu" ref={ref}>
      <button
        className="bell"
        aria-label={`Notifications, ${unread} unread`}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load(tab);
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="bellpop" role="dialog" aria-label="Notifications">
          <div className="ptabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                aria-pressed={tab === t.key}
                onClick={() => {
                  setTab(t.key);
                  load(t.key);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="spread" style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)' }}>
            <span className="muted">{loading ? 'Loading…' : `${unread} unread`}</span>
            <span className="row-flex">
              <button className="linkbtn small" onClick={() => markRead()}>
                Mark all read
              </button>
              <Link className="small" href="/admin/notifications" onClick={() => setOpen(false)}>
                History
              </Link>
            </span>
          </div>
          {items.length === 0 && !loading && <div className="muted" style={{ padding: 20, textAlign: 'center' }}>Nothing here yet.</div>}
          {items.map((n) => (
            <Link
              key={n.id}
              href={n.link || '/admin/notifications'}
              className={`nitem ${n.read ? '' : 'unread'} ${n.kind === 'flag' ? 'flag' : ''}`}
              onClick={() => {
                if (!n.read) markRead([n.id]);
                setOpen(false);
              }}
            >
              <span className="ic" />
              <span className="grow">
                <b>{n.title}</b>
                {n.body && <pre>{n.body}</pre>}
                <span className="muted">
                  {n.kind === 'flag' ? 'Red flag · ' : n.kind === 'summary' ? 'Daily summary · ' : ''}
                  {ago(n.createdAt)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
