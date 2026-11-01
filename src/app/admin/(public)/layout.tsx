import Link from 'next/link';

export default function AdminPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="appbar">
        <div className="hin">
          <Link className="logo" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/abacus-logo.png" alt="Abacus Spaces" />
          </Link>
          <span className="t">
            <b>Requirement Board</b>
            <span>Admin</span>
          </span>
        </div>
      </header>
      {children}
    </>
  );
}
