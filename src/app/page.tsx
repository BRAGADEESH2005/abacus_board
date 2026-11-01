import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const s = await getSession().catch(() => null);
  if (s?.type === 'admin') redirect('/admin');
  if (s?.type === 'broker') redirect('/broker');
  return (
    <>
      <header className="appbar">
        <div className="hin">
          <span className="logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/abacus-logo.png" alt="Abacus Spaces" />
          </span>
          <span className="t">
            <b>Requirement Board</b>
            <span>Retail space, matched by Abacus</span>
          </span>
        </div>
      </header>
      <main className="page narrow">
        <section className="hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/abacus-logo.png" alt="" />
          <h1>Where Abacus needs retail space, right now</h1>
          <p className="lead" style={{ margin: '0 auto 22px' }}>
            Abacus Spaces posts live retail requirements across Tamil Nadu, Karnataka and Kerala. Partner brokers post the properties they hold, and Abacus matches them to brands.
          </p>
          <div className="row-flex" style={{ justifyContent: 'center' }}>
            <Link className="btn primary" href="/signup">
              Sign up as a broker
            </Link>
            <Link className="btn" href="/login">
              Broker login
            </Link>
          </div>
          <p className="muted" style={{ marginTop: 28 }}>
            Abacus team? <Link href="/admin/login">Admin login</Link>
          </p>
        </section>
        <div className="cards">
          <div className="card">
            <h3>1. See requirements</h3>
            <p className="muted" style={{ margin: 0 }}>Location, size, rent band and the specs a property must pass. Brand names stay with Abacus.</p>
          </div>
          <div className="card">
            <h3>2. Post your properties</h3>
            <p className="muted" style={{ margin: 0 }}>Each gets a code like PRP CHN 0042 the moment you start, with its map pin, floor plan and Drive photos.</p>
          </div>
          <div className="card">
            <h3>3. Abacus matches</h3>
            <p className="muted" style={{ margin: 0 }}>Suggest a property for a requirement, or let Abacus find it. Track each property&apos;s stage on the board.</p>
          </div>
        </div>
      </main>
    </>
  );
}
