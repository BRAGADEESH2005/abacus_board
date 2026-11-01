import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page narrow">
      <div className="empty" style={{ marginTop: 60 }}>
        <b>Page not found</b>
        That link does not lead anywhere on the board.
        <div style={{ marginTop: 14 }}>
          <Link className="btn" href="/">
            Go to the board
          </Link>
        </div>
      </div>
    </main>
  );
}
