import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'abd_session';
const PUBLIC_ADMIN = ['/admin/login', '/admin/forgot-password'];

/**
 * Edge gate. It only checks that a session cookie exists so signed out visitors are sent
 * to the right login page; every page and API route re-verifies the session and role
 * against the database on the server.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CSRF defence in depth: state changing API calls must come from this site.
  if (pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !pathname.startsWith('/api/cron/')) {
    const origin = req.headers.get('origin');
    if (origin) {
      const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
      try {
        if (new URL(origin).host !== host) return NextResponse.json({ error: 'Cross site request blocked.' }, { status: 403 });
      } catch {
        return NextResponse.json({ error: 'Cross site request blocked.' }, { status: 403 });
      }
    }
  }

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (pathname.startsWith('/admin') && !PUBLIC_ADMIN.some((p) => pathname.startsWith(p)) && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith('/broker') && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/broker/:path*', '/api/:path*'],
};
