'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type F = { name: string; value: string; options: [string, string][]; label?: string };

/** URL driven filters: each change updates the query string so lists can be linked and shared. */
export function ListFilters({ fields, search, numbers }: { fields: F[]; search?: { name: string; value: string; placeholder: string }; numbers?: { name: string; value: string; placeholder: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState(search?.value ?? '');
  const setParam = (name: string, value: string) => {
    const u = new URL(window.location.href);
    if (value) u.searchParams.set(name, value);
    else u.searchParams.delete(name);
    router.push(u.pathname + u.search);
  };
  useEffect(() => {
    if (!search) return;
    if (q === search.value) return;
    const t = setTimeout(() => setParam(search.name, q), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  return (
    <>
      {fields.map((f) => (
        <select key={f.name} className="input" style={{ width: 'auto' }} value={f.value} onChange={(e) => setParam(f.name, e.target.value)} aria-label={f.label ?? f.name}>
          {f.options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      ))}
      {numbers?.map((n) => (
        <input key={n.name} className="input" style={{ width: 130 }} type="number" min={0} placeholder={n.placeholder} defaultValue={n.value} onBlur={(e) => e.target.value !== n.value && setParam(n.name, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setParam(n.name, (e.target as HTMLInputElement).value)} aria-label={n.placeholder} />
      ))}
      {search && <input className="input" style={{ width: 220 }} type="search" placeholder={search.placeholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label={search.placeholder} />}
    </>
  );
}
