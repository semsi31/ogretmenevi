"use client";
import { useEffect, useMemo, useState } from 'react';
import Uploader from '@/components/Uploader';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRole, canEdit, canDelete } from '@/lib/auth';
import { toast } from '@/lib/toast';
import DataTable from '@/components/DataTable';
import { apiFetch, apiFetchAuth } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

type Slider = { id: string; title?: string; image_url: string; position: number; is_published: boolean; };

export default function SliderPage() {
  const role = useRole();
  const [items, setItems] = useState<Slider[]>([]);
  const [editing, setEditing] = useState<Slider | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [published, setPublished] = useState<'all' | 'true' | 'false'>('all');
  const [query, setQuery] = useState('');
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<Record<string, string | undefined>>({});
  let reorderTimer: any;

  async function load() {
    const params = new URLSearchParams();
    params.set('published', published);
    try {
      const data = await apiFetch<Slider[]>(`/api/sliders?${params.toString()}`);
      // Ensure 1..N visualization regardless of server values
      const normalized = (data || []).slice().sort((a,b)=> (a.position||0)-(b.position||0)).map((s, i) => ({ ...s, position: i+1 }));
      setItems(normalized);
    } catch (e:any) { toast(e?.message || 'Liste alınamadı','error'); }
  }
  useEffect(() => { load(); }, [published]);

  function reorderLocal(arr: Slider[]) {
    const next = arr.slice().map((s, i) => ({ ...s, position: i+1 }));
    setItems(next);
  }

  function queueReorderSend(arr: Slider[]) {
    if (reorderTimer) clearTimeout(reorderTimer);
    const ids = arr.map(s => s.id);
    reorderTimer = setTimeout(async () => {
      try {
        await apiFetchAuth(`/api/sliders/reorder`, { method: 'PUT', body: JSON.stringify({ ids }) });
        // Always refresh to keep UI in sync with server order
        await load();
      } catch (e:any) {
        const msg = String(e?.message || 'Teknik bir sorun oluştu');
        toast(/^HTTP 400/.test(msg) ? 'Sıralama doğrulama hatası' : 'Teknik sorun', 'error');
        await load();
      }
    }, 250);
  }

  async function moveById(id: string, dir: -1 | 1) {
    // Work on the visible (filtered) list to find the neighbor
    const idx = filtered.findIndex(it => it.id === id);
    const ni = idx + dir; if (idx < 0 || ni < 0 || ni >= filtered.length) return;
    const current = filtered[idx];
    const target = filtered[ni];
    // Disable only affected rows to avoid flicker
    setRowBusy(prev => ({ ...prev, [current.id]: true, [target.id]: true }));
    try {
      await apiFetchAuth(`/api/sliders/${current.id}/update-position`, { method: 'PUT', body: JSON.stringify({ position: target.position }) });
      // Update local items order by swapping those two ids in the full list
      const a = items.findIndex(x => x.id === current.id);
      const b = items.findIndex(x => x.id === target.id);
      if (a !== -1 && b !== -1) {
        const copy = [...items];
        [copy[a], copy[b]] = [copy[b], copy[a]];
        reorderLocal(copy);
      }
      await load();
    } catch (e:any) {
      toast('Sıralama kaydedilemedi','error');
      await load();
    } finally {
      setRowBusy(prev => ({ ...prev, [current.id]: false, [target.id]: false }));
    }
  }

  async function remove(id: string) {
    if (!confirm('Silinsin mi?')) return;
    setRowBusy(prev => ({ ...prev, [id]: true }));
    setRowError(prev => ({ ...prev, [id]: undefined }));
    try {
      await apiFetchAuth(`/api/sliders/${id}`, { method:'DELETE' });
      await load();
    } catch (e:any) {
      const msg = String(e?.message || 'Silinemedi');
      setRowError(prev => ({ ...prev, [id]: msg }));
      toast(msg, 'error');
    } finally {
      setRowBusy(prev => ({ ...prev, [id]: false }));
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return items;
    return items.filter(i =>
      (i.title || '').toLocaleLowerCase('tr').includes(q) ||
      String(i.position).includes(q)
    );
  }, [items, query]);

  const columns = useMemo(() => [
    { header: 'Görsel', id: 'image', cell: ({ row }: any) => {
      const s = row.original as Slider;
      return s.image_url ? <img src={s.image_url} className="h-10 w-16 object-cover rounded border" /> : null;
    } },
    { header: 'Sıra', accessorKey: 'position', cell: ({ row }: any) => <span style={{ width: 40, display: 'inline-block', textAlign: 'center' }}>{row.original.position}</span> },
    { id: 'published', header: 'Yayında', cell: ({ row }: any) => {
      const s = row.original as Slider;
      const busy = !!rowBusy[s.id];
      return (
        <button
          className={`px-2 py-0.5 border rounded text-sm ${s.is_published ? 'bg-green-50 border-green-500 text-green-700' : 'bg-gray-50 border-gray-300 text-gray-700'}`}
          onClick={async ()=>{
            if (!canEdit(role) || busy) return;
            setRowBusy(prev => ({ ...prev, [s.id]: true }));
            try {
              const next = !s.is_published;
              await apiFetchAuth(`/api/sliders/${s.id}/publish`, { method:'PUT', body: JSON.stringify({ is_published: next }) });
              // If current filter excludes or includes, re-fetch; else update inline
              const willRemain = (published === 'all') || (published === 'true' && next) || (published === 'false' && !next);
              if (willRemain) {
                setItems(prev => prev.map(it => it.id === s.id ? { ...it, is_published: next } : it));
              } else {
                await load();
              }
            } catch (e:any) {
              toast('Kaydedilemedi','error');
            } finally {
              setRowBusy(prev => ({ ...prev, [s.id]: false }));
            }
          }}
          disabled={busy}
        >{s.is_published ? '✓' : '—'}</button>
      );
    } },
    { id: 'actions', header: 'İşlemler', cell: ({ row }: any) => {
      const s = row.original as Slider;
      const idx = filtered.findIndex(it => it.id === s.id);
      const busy = !!rowBusy[s.id];
      return (
        <div className="flex gap-2 justify-end">
          {canEdit(role) && <button className="px-2 py-1 border" onClick={async()=>{
            if (busy || idx === 0) return;
            setRowBusy(prev => ({ ...prev, [s.id]: true }));
            try { await apiFetchAuth(`/api/sliders/${s.id}/move`, { method:'PATCH', body: JSON.stringify({ direction: 'up' }) }); await load(); } catch { toast('Sıralama kaydedilemedi','error'); await load(); }
            finally { setRowBusy(prev => ({ ...prev, [s.id]: false })); }
          }} disabled={busy || idx === 0}>↑</button>}
          {canEdit(role) && <button className="px-2 py-1 border" onClick={async()=>{
            if (busy || idx === (filtered.length - 1)) return;
            setRowBusy(prev => ({ ...prev, [s.id]: true }));
            try { await apiFetchAuth(`/api/sliders/${s.id}/move`, { method:'PATCH', body: JSON.stringify({ direction: 'down' }) }); await load(); } catch { toast('Sıralama kaydedilemedi','error'); await load(); }
            finally { setRowBusy(prev => ({ ...prev, [s.id]: false })); }
          }} disabled={busy || idx === (filtered.length - 1)}>↓</button>}
          {canEdit(role) && <button className="px-2 py-1 border" onClick={()=>{ setEditing(s); setShowForm(true); }} disabled={busy}>Düzenle</button>}
          {canDelete(role) && <button className="px-2 py-1 border" onClick={()=>remove(s.id)} disabled={busy}>Sil</button>}
        </div>
      );
    } }
  ], [role, filtered, rowBusy]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Sliders</h1>
      <div className="flex gap-2 items-center">
        <input className="border p-1" placeholder="Ara" value={query} onChange={(e)=>setQuery(e.target.value)} />
        <select className="border p-1" value={published} onChange={(e)=>setPublished(e.target.value as any)}>
          <option value="all">Yayın (hepsi)</option>
          <option value="true">Yayında</option>
          <option value="false">Yayında değil</option>
        </select>
        {canEdit(role) && <button className="bg-blue-600 text-white px-3 py-1 ml-auto" onClick={()=>{ setEditing(null); setShowForm(true); }} disabled={Object.values(rowBusy).some(Boolean)}>Yeni</button>}
      </div>

      <DataTable columns={columns as any} data={filtered} globalFilterPlaceholder="Ara" showGlobalFilter={false} />

      {showForm && (
        <SliderForm initial={editing || undefined} onClose={()=>{ setShowForm(false); load(); }} />
      )}
    </div>
  );
}

// auth headers apiFetchAuth ile yönetilir

const schema = z.object({
  image_url: z.string().url('Geçersiz URL').min(1,'Zorunlu'),
  position: z.number().int().min(0).default(0),
  is_published: z.boolean().default(true)
});
type FormData = z.infer<typeof schema>;

function SliderForm({ initial, onClose }: { initial?: Slider; onClose: () => void }) {
  const isEdit = !!initial;
  const [imageUrl, setImageUrl] = useState(initial?.image_url || '');
  const { register, handleSubmit, formState:{ errors }, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      image_url: initial?.image_url || '',
      position: initial?.position ?? 0,
      is_published: initial?.is_published ?? true
    }
  });

  async function onSubmit(values: FormData) {
    const path = isEdit ? `/api/sliders/${initial!.id}` : `/api/sliders`;
    const method = isEdit ? 'PUT' : 'POST';
    try {
      await apiFetchAuth(path, { method, body: JSON.stringify(values) });
      toast('Kaydedildi','success');
      onClose();
    } catch (e:any) { toast(e?.message || 'Kaydedilemedi','error'); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-[1000]">
      <div className="bg-white p-4 rounded w-full max-w-2xl space-y-3 z-[1001]">
        <h2 className="text-lg font-semibold">{isEdit ? 'Düzenle' : 'Yeni'} Slider</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-2">
          <Uploader folder="home" accept="image/*" maxSizeMB={5} label="Görsel" value={imageUrl} onChange={(u)=>{ setImageUrl(u); setValue('image_url', u); }} />
          {errors.image_url && <div className="text-xs text-red-600">{errors.image_url.message}</div>}
          <div className="grid grid-cols-2 gap-2">
            <input className="border p-2" type="number" placeholder="Position" {...register('position', { valueAsNumber: true })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('is_published')} /> Yayında</label>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" className="px-3 py-1 border" onClick={onClose}>İptal</button>
            <button type="submit" className="px-3 py-1 bg-blue-600 text-white">Kaydet</button>
          </div>
        </form>
      </div>
    </div>
  );
}


