'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavTabs({ items }: { items: { href: string; label: string; exact?: boolean }[] }) {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Sections">
      {items.map((i) => {
        const on = i.exact ? path === i.href : path === i.href || path.startsWith(i.href + '/');
        return (
          <Link key={i.href} href={i.href} aria-current={on ? 'page' : undefined}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
