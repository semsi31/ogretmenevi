"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) throw new Error('Giriş başarısız');
      let data: any = null;
      try { data = await res.json(); } catch {}
      try {
        if (data?.user?.role) {
          document.cookie = `role=${encodeURIComponent(data.user.role)}; path=/; SameSite=Lax`;
        }
        if (data?.token) {
          localStorage.setItem('token', data.token);
        }
      } catch {}
      try { router.replace('/admin/home'); } catch {}
      setTimeout(() => { try { window.location.href = '/admin/home'; } catch {} }, 50);
    } catch (err:any) {
      setError('Giriş başarısız');
    }
  }

  return (
    <main className="max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Admin Giriş</h1>
      <form onSubmit={onSubmit} className="grid gap-2">
        <input className="border p-2" placeholder="E-posta" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="border p-2" placeholder="Şifre" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        <button className="bg-blue-600 text-white px-4 py-2" type="submit">Giriş</button>
        {error && <div className="text-red-600 text-sm">{error}</div>}
      </form>
    </main>
  );
}


