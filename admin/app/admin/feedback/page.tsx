"use client";
import { useEffect, useMemo, useState } from 'react';
import { apiFetchAuth, API_BASE } from '@/lib/api';

type F = { id: string; name?: string | null; email?: string | null; message: string; handled: boolean; created_at: string };

export default function FeedbackPage() {
  const [items, setItems] = useState<F[]>([]);
  const [query, setQuery] = useState('');
  const [handled, setHandled] = useState<'all' | 'true' | 'false'>('all');
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function load() {
    const p = new URLSearchParams(); if (handled !== 'all') p.set('handled', handled);
    const data = await apiFetchAuth<F[]>(`/api/feedback?${p.toString()}`);
    setItems((data||[]).map(r => ({ ...r, created_at: r.created_at || (r as any)['created_at'] })));
  }
  useEffect(() => { load(); }, [handled]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr'); if (!q) return items;
    return items.filter(i => (i.name||'').toLocaleLowerCase('tr').includes(q) || (i.email||'').toLocaleLowerCase('tr').includes(q));
  }, [items, query]);

  async function toggleHandled(id: string, next: boolean) {
    setBusy(b => ({ ...b, [id]: true }));
    try { await apiFetchAuth(`/api/feedback/${id}`, { method:'PUT', body: JSON.stringify({ handled: next }) }); await load(); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  }

  function exportCsv() { window.open(`${API_BASE}/api/feedback/export.csv?handled=${handled}&q=${encodeURIComponent(query)}`, '_blank'); }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">Geri Bildirim</h1>
        <button className="ml-auto px-3 py-1 border rounded" onClick={exportCsv}>CSV Dışa Aktar</button>
      </div>
      <div className="flex items-center gap-2">
        <input className="border p-1" placeholder="Ara (ad/e-posta)" value={query} onChange={(e)=>setQuery(e.target.value)} />
        <select className="border p-1" value={handled} onChange={(e)=>setHandled(e.target.value as any)}>
          <option value="all">Hepsi</option>
          <option value="false">Okunmamış</option>
          <option value="true">Okundu</option>
        </select>
      </div>
      <div className="rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 border">Ad</th>
              <th className="text-left px-3 py-2 border">E-posta</th>
              <th className="text-left px-3 py-2 border">Mesaj</th>
              <th className="text-left px-3 py-2 border">Tarih</th>
              <th className="text-left px-3 py-2 border">Durum</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="odd:bg-gray-50/30">
                <td className="px-3 py-2 border">{r.name || '—'}</td>
                <td className="px-3 py-2 border">{r.email || '—'}</td>
                <td className="px-3 py-2 border truncate max-w-[28rem]" title={r.message}>{r.message}</td>
                <td className="px-3 py-2 border">{new Date(r.created_at).toLocaleString('tr-TR')}</td>
                <td className="px-3 py-2 border">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!r.handled} onChange={(e)=>toggleHandled(r.id, e.target.checked)} disabled={!!busy[r.id]} /> Okundu
                  </label>
                </td>
              </tr>
            ))}
            {!filtered.length && (<tr><td className="text-center text-gray-500 py-6 border" colSpan={5}>Kayıt yok</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}


