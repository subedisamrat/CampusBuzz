import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // Check if token is expired
  if (token && token.exp) {
    const isExpired = Date.now() >= (token.exp as number) * 1000;
    if (isExpired) {
      const loginUrl = new URL('/auth/login', req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  const isAdminRoute = pathname.startsWith('/admin') && pathname !== '/admin/login';
  const isAuthRoute = pathname === '/auth/login' || pathname === '/auth/signup';
  const isAdminLoginRoute = pathname === '/admin/login';
  const isRootRoute = pathname === '/';

  // Protect admin routes (but NOT /admin/login)
  if (isAdminRoute) {
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
    if (token.role === 'student') {
      return NextResponse.redirect(new URL('/events', req.url));
    }
  }

  // Redirect admins away from student-only pages (not event view — admins can preview events)
  // Admins have no business on /my-events, /my-payments, /payment/*
  const isStudentOnlyRoute =
    pathname.startsWith('/my-events') ||
    pathname.startsWith('/my-payments') ||
    pathname.startsWith('/payment/');

  if (isStudentOnlyRoute && token?.role === 'admin') {
    return NextResponse.redirect(new URL('/admin/dashboard', req.url));
  }

  // Redirect admin from shared event links to the admin event view
  // e.g. /events/abc123 → /admin/events/abc123/view
  const eventDetailMatch = pathname.match(/^\/events\/([a-f0-9]{24})$/i);
  if (eventDetailMatch && token?.role === 'admin') {
    return NextResponse.redirect(
      new URL(`/admin/events/${eventDetailMatch[1]}/view`, req.url)
    );
  }

  // Redirect already-authenticated students away from student auth pages
  // Admins visiting /auth/login are handled by the page itself (signs them out)
  if (isAuthRoute && token) {
    if (token.role === 'student') {
      return NextResponse.redirect(new URL('/events', req.url));
    }
    // Admin on /auth/login — let the page handle it (will sign them out)
  }

  // Redirect already-authenticated admins away from admin login
  if (isAdminLoginRoute && token?.role === 'admin') {
    return NextResponse.redirect(new URL('/admin/dashboard', req.url));
  }

  // Redirect logged-in students away from landing page to /events
  if (isRootRoute && token?.role === 'student') {
    return NextResponse.redirect(new URL('/events', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/|api/auth/|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js|woff2?|ttf|eot)).*)',
  ],
};
