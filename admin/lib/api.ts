// lib/api.ts
// Normalize API base to avoid values like ":4000" causing browser to request ":4000/..."
const RAW_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').trim();
function normalizeApiBase(v: string): string {
  let base = v;
  if (!base) base = 'http://localhost:4000';
  // ":4000" => "http://localhost:4000"
  if (/^:\d+$/.test(base)) base = `http://localhost${base}`;
  // "4000" => "http://localhost:4000"
  if (/^\d+$/.test(base)) base = `http://localhost:${base}`;
  // "localhost:4000" => add protocol
  if (!/^https?:\/\//i.test(base)) base = `http://${base.replace(/^\/+/, '')}`;
  return base.replace(/\/+$/, '');
}
export const API_BASE = normalizeApiBase(RAW_BASE);
if (typeof window !== 'undefined') {
  // Early log to help diagnose wrong env causing :4000/... urls
  try { console.debug('[API_BASE]', API_BASE); } catch {}
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
	const method = ((init.method || 'GET') as string).toUpperCase();
	const hasBody = !!(init as any).body;
	const baseHeaders: Record<string, string> = { ...(init.headers as any) };
	if (method !== 'GET' || hasBody) baseHeaders['Content-Type'] = baseHeaders['Content-Type'] || 'application/json';
	const res = await fetch(`${API_BASE}${path}`, {
		mode: 'cors',
		cache: 'no-store' as any,
		credentials: 'include',
		...init,
		headers: baseHeaders
	});
	if (!res.ok) {
		let msg = `HTTP ${res.status}`;
		try { const j = await res.json(); msg = j?.message || msg; } catch {}
		throw new Error(msg);
	}
	try { return (await res.json()) as T; } catch { return undefined as unknown as T; }
}

export async function apiFetchAuth<T = any>(path: string, init: RequestInit = {}): Promise<T> {
	let token = typeof window === 'undefined' ? undefined : localStorage.getItem('token');
	if (!token && typeof window !== 'undefined') {
		try {
			const sess = await fetch('/api/auth/session', { cache: 'no-store' }).then(r => r.ok ? r.json() : null);
			token = (sess as any)?.apiToken || (sess as any)?.user?.apiToken;
		} catch {}
	}
	const method = ((init.method || 'GET') as string).toUpperCase();
	const hasBody = !!(init as any).body;
	const headers: Record<string, string> = { ...(init.headers as any) };
	if (method !== 'GET' || hasBody) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
	if (token) headers.Authorization = `Bearer ${token}`;
	const res = await fetch(`${API_BASE}${path}`, { mode: 'cors', cache: 'no-store' as any, credentials: 'include', ...init, headers });
	if (!res.ok) {
		let msg = `HTTP ${res.status}`;
		try { const j = await res.json(); msg = j?.message || msg; } catch {}
		throw new Error(msg);
	}
	try { return (await res.json()) as T; } catch { return undefined as unknown as T; }
}

// Server-side variant (reads token cookie)
export async function apiFetchServer<T = any>(path: string, init: RequestInit = {}): Promise<T> {
	const { cookies } = await import('next/headers');
	const token = cookies().get('token')?.value;
	const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as any) };
	if (token) headers.Authorization = `Bearer ${token}`;
	const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
	if (!res.ok) {
		let msg = `HTTP ${res.status}`;
		try { const j = await res.json(); msg = j?.message || msg; } catch {}
		throw new Error(msg);
	}
	try { return (await res.json()) as T; } catch { return undefined as unknown as T; }
}
