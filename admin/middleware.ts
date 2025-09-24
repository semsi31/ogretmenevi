import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/admin')) {
    // 1) Hızlı geçiş: role çerezi (client login akışında yazılıyor)
    const roleCookie = req.cookies.get('role')?.value;
    if (roleCookie === 'admin' || roleCookie === 'editor') {
      return NextResponse.next();
    }
    // 2) NextAuth JWT ile doğrula (Credentials provider senaryosu)
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const role = (token as any)?.role as string | undefined;
    if (!role || (role !== 'admin' && role !== 'editor')) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};


