'use client';
import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const db = /database|MongoDB|ECONNREFUSED/i.test(error.message);
  return (
    <main className="page narrow">
      <div className="empty" style={{ marginTop: 60 }}>
        <b>{db ? 'The database is not reachable right now' : 'Something went wrong'}</b>
        {db ? 'Please try again in a minute.' : 'The page could not load. Try again, and tell Abacus if it keeps happening.'}
        <div style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={reset}>
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
