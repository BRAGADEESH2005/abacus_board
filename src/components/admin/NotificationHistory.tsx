'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/components/ui/api';
import { fmtDateTime } from '@/lib/format';

type Item = { id: string; kind: string; title: string; body: string; link: string; createdAt: string; read: boolean; data: Record<string, unknown> };
const TABS = [
  { k: 'flags', label: 'Open red flags' },
  { k: 'summary', label: 'Daily summaries (history)' },
  { k: 'activity', label: 'Activity' },
];

export function NotificationHistory() {
  const [tab, setTab] = useState('flags');
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    setItems(null);
    api<{ items: Item[] }>(`/api/admin/notifications?tab=${tab}&limit=200`).then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [tab]);
  return (
    <>
      <div className="ptabs">
        {TABS.map((t) => (
          <button key={t.k} aria-pressed={tab === t.k} onClick={() => setTab(t.k)}>
            {t.label}
          </button>
        ))}
        <button className="right" style={{ marginLeft: 'auto' }} onClick={() => api('/api/admin/notifications/read', { body: { all: true } }).then(() => setItems((x) => x?.map((i) => ({ ...i, read: true })) ?? null))}>
          Mark all read
        </button>
      </div>
      {items === null ? (
        <div className="muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty">
          <b>{tab === 'flags' ? 'No open red flags' : 'Nothing yet'}</b>
          {tab === 'summary' ? 'The first card appears after 9 am India time.' : ''}
        </div>
      ) : tab === 'summary' ? (
        <div className="list">
          {items.map((n) => {
            const d = n.data as Record<string, number>;
            return (
              <div key={n.id} className="panel">
                <div className="ph">
                  <h3>{n.title}</h3>
                </div>
                <div className="pb tiles" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
                  {[
                    ['added', 'Properties added'],
                    ['shortlisted', 'Shortlisted'],
                    ['pitches', 'Pitches made'],
                    ['siteVisits', 'Site visits'],
                    ['closings', 'Closings'],
                    ['newBrands', 'New brands'],
                    ['openFlags', 'Open red flags'],
                  ].map(([k, l]) => (
                    <div key={k} className={`tile ${k === 'openFlags' && d[k!] ? 'alert' : ''}`}>
                      <span className="v">{d[k!] ?? 0}</span>
                      <span className="k">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel">
          {items.map((n) => (
            <Link key={n.id} href={n.link || '#'} className={`nitem ${n.read ? '' : 'unread'} ${n.kind === 'flag' ? 'flag' : ''}`}>
              <span className="ic" />
              <span className="grow">
                <b>{n.title}</b>
                {n.body && <pre>{n.body}</pre>}
                <span className="muted">{fmtDateTime(n.createdAt)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
