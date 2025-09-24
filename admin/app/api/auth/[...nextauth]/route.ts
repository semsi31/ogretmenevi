import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const API_BASE = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' as const },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: credentials.email, password: credentials.password })
        });
        if (!res.ok) return null;
        const data = await res.json();
        return { id: data.user.id, email: data.user.email, role: data.user.role, apiToken: data.token } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = (user as any).role;
        token.apiToken = (user as any).apiToken;
      }
      return token;
    },
    async session({ session, token }: any) {
      (session as any).role = token.role;
      (session as any).apiToken = token.apiToken;
      return session;
    }
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };


