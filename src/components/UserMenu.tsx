'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from './ui/api';

export function UserMenu({ trigger, links, loginPath }: { trigger: ReactNode; links: { href: string; label: string }[]; loginPath: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.assign(loginPath);
  };
  return (
    <div className="menu" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        {trigger}
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <div className="sep" />
          <button onClick={logout}>Log out</button>
        </div>
      )}
    </div>
  );
}
