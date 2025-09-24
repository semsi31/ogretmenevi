"use client";
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/Button';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/lib/toast';
import Uploader from '@/components/Uploader';
import { useRole, canEdit, canDelete } from '@/lib/auth';
import { apiFetch, apiFetchAuth } from '@/lib/api';
import DataTable from '@/components/DataTable';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

type Route = {
  id: string; code: string; title?: string; description?: string; pdf_url?: string; image_url?: string; series?: string; is_published: boolean; created_at?: string;
};

const seriesOptionsDefault: string[] = [];

export default function UlasimPage() {
  const role = useRole();
  const [items, setItems] = useState<Route[]>([]);
  const [series, setSeries] = useState<string>('');
  const [published, setPublished] = useState<boolean>(true);
  const [seriesOptions, setSeriesOptions] = useState<string[]>(seriesOptionsDefault);
  const [newSeries, setNewSeries] = useState<string>('');
  const [editing, setEditing] = useState<Route | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState<string>('');

  async function load() {
    const params = new URLSearchParams();
    if (series) params.set('series', series);
    // published değeri her zaman gönderilir: true/false
    params.set('published', published ? 'true' : 'false');
    if (search.trim()) params.set('query', search.trim());
    params.set('t', String(Date.now()));
    try {
      const data = await apiFetch<Route[]>(`/api/routes?${params.toString()}`);
      setItems(data || []);
    } catch (e: any) {
      console.error('Ulasim load error:', e);
      setItems([]);
      try { toast(e?.message || 'Veri alınamadı', 'error'); } catch {}
    }
  }

  async function loadSeriesOptions() {
    try {
      const data = await apiFetch<string[]>(`/api/routes/series/list?t=${Date.now()}` as any);
      if (Array.isArray(data) && data.length) setSeriesOptions(data);
    } catch (e) { console.warn('series list load failed', e); }
  }
  useEffect(()=>{ loadSeriesOptions(); },[]);
  // Otomatik filtreleme (Uygula butonu olmadan) – küçük bir debounce ile
  useEffect(()=>{
    const t = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(t);
  }, [series, published, search]);

  // Modal açıkken body scroll kilidi
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (showForm) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [showForm]);

  const filtered = useMemo(() => items, [items]);

  const columns = useMemo(() => [
    { header: 'Otobüs No', accessorKey: 'code' },
    { header: 'Güzergah', accessorKey: 'title' },
    { header: 'Seri No', accessorKey: 'series' },
    { id: 'published', header: 'Yayında', cell: ({ row }: any) => (row.original.is_published ? '✓' : '—') },
    { id: 'created', header: 'Oluşturulma Tarihi', cell: ({ row }: any) => (row.original.created_at ? new Date(row.original.created_at).toLocaleString() : '—') },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => (
        <div className="flex gap-2 justify-end">
          {canEdit(role) && (
            <Button variant="secondary" onClick={()=>{ setEditing(row.original); setShowForm(true); }}>Düzenle</Button>
          )}
          {canDelete(role) && (
            <Button variant="destructive" onClick={()=>onDelete(row.original.id)}>Sil</Button>
          )}
        </div>
      )
    }
  ], [role]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Ulaşım</h1>
      <div className="flex gap-2 items-center flex-wrap">
        <select className="border p-1" value={series} onChange={(e)=>setSeries(e.target.value)}>
          <option value="">Seri (hepsi)</option>
          {seriesOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={published} onChange={(e)=>setPublished(e.target.checked)} /> Yayında</label>
        <input className="border p-1" placeholder="Ara" value={search} onChange={(e)=>setSearch(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); load(); } }} />
        <div className="ml-auto flex items-center gap-2">
          <input className="border p-1 w-28" placeholder="Yeni seri" value={newSeries} onChange={(e)=>setNewSeries(e.target.value)} />
          <button className="px-3 py-1 border rounded-md shadow-sm hover:shadow-md transition" onClick={async()=>{
            const s = newSeries.trim();
            if(!s) return;
            if ((seriesOptions||[]).includes(s)) { toast('Bu seri zaten mevcut', 'error'); return; }
            // Iyimser güncelleme
            setSeriesOptions(prev => Array.from(new Set([...(prev||[]), s])));
            try {
              await apiFetchAuth(`/api/routes/series`, { method: 'POST', body: JSON.stringify({ name: s }) });
              toast('Seri eklendi', 'success');
            } catch (e:any) {
              toast(e?.message || 'Seri eklenemedi', 'error');
            }
            setNewSeries('');
            await loadSeriesOptions();
            await load();
          }}>Ekle</button>
          {series && <button className="px-3 py-1 border text-red-600 rounded-md shadow-sm hover:shadow-md transition" onClick={async()=>{
            if(!confirm(`'${series}' serisini kaldırırsanız, bu seri içerisindeki tüm veriler silinecektir. Devam etmek istiyor musunuz?`)) return;
            const removed = series;
            // Iyimser güncelleme
            setSeriesOptions(prev => (prev||[]).filter(v => v !== removed));
            await apiFetchAuth(`/api/routes/series/${encodeURIComponent(removed)}`, { method: 'DELETE' });
            setSeries('');
            await loadSeriesOptions();
            await load();
          }}>Seçili Seriyi Kaldır</button>}
        </div>
        {canEdit(role) && <button className="bg-blue-600 text-white px-3 py-1 ml-auto rounded-md shadow-sm hover:shadow-md hover:bg-blue-700 transition" onClick={()=>{ setEditing(null); setShowForm(true); }}>Yeni</button>}
      </div>

      <DataTable columns={columns as any} data={filtered} showGlobalFilter={false} />

      {showForm && (typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-[1000]">
          <div className="z-[1001] w-full max-w-2xl">
            <RouteForm seriesOptions={seriesOptions} initial={editing || undefined} onClose={() => { setShowForm(false); load(); }} />
          </div>
        </div>, document.body) : null)}
    </div>
  );

  async function onDelete(id: string) {
    if (!confirm('Silinsin mi?')) return;
    try {
      await apiFetchAuth(`/api/routes/${id}`, { method: 'DELETE' });
      await load();
      toast('Silindi', 'success');
    } catch (e: any) {
      toast(e?.message || 'Silinemedi', 'error');
    }
  }
}

function authHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

const schema = z.object({
  code: z.string().min(1, 'Otobüs no zorunludur'),
  title: z.string().min(1, 'Güzergah zorunludur'),
  description: z.string().optional(),
  series: z.string().min(1, 'Seri no zorunludur'),
  is_published: z.boolean().default(true),
  pdf_url: z.string().url('Geçersiz URL').optional().or(z.literal('')),
  image_url: z.string().url('Geçersiz URL').optional().or(z.literal(''))
});

type FormData = z.infer<typeof schema>;

function RouteForm({ initial, onClose, seriesOptions }: { initial?: Route; onClose: () => void; seriesOptions: string[] }) {
  const isEdit = !!initial;
  const [pdfUrl, setPdfUrl] = useState(initial?.pdf_url || '');
  const [imageUrl, setImageUrl] = useState(initial?.image_url || '');
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: initial?.code || '',
      title: initial?.title || '',
      description: initial?.description || '',
      series: initial?.series || '',
      is_published: initial?.is_published ?? true,
      pdf_url: initial?.pdf_url || '',
      image_url: initial?.image_url || ''
    }
  });

  async function onSubmit(values: FormData) {
    const path = isEdit ? `/api/routes/${initial!.id}` : `/api/routes`;
    const method = isEdit ? 'PUT' : 'POST';
    try {
      await apiFetchAuth(path, { method, body: JSON.stringify(values) });
      toast('Kaydedildi', 'success');
      onClose();
    } catch (e: any) {
      const msg = String(e?.message || 'Kaydedilemedi');
      if (msg.includes('UQ_routes_code') || /unique|duplicate/i.test(msg)) {
        toast('Aynı otobüs no ile başka bir kayıt mevcut.', 'error');
      } else {
        toast(msg, 'error');
      }
    }
  }

  return (
    <div className="bg-white p-4 rounded w-full max-w-2xl space-y-3">
      <h2 className="text-lg font-semibold">{isEdit ? 'Düzenle' : 'Yeni'} Route</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-2" noValidate>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <input className="border p-2 w-full" placeholder="Otobüs No" {...register('code', { required: true })} />
            {errors.code && <div className="text-xs text-red-600">{errors.code.message}</div>}
          </div>
          <div>
            <input className="border p-2 w-full" placeholder="Güzergah" {...register('title', { required: true })} />
            {errors.title && <div className="text-xs text-red-600">{errors.title.message}</div>}
          </div>
        </div>
        <textarea className="border p-2" placeholder="Açıklama" {...register('description')} />
        <div className="grid grid-cols-2 gap-2">
          <select className="border p-2" {...register('series', { required: true })}>
            <option value="">Seri seçin</option>
            {seriesOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {errors.series && <div className="text-xs text-red-600">{errors.series.message}</div>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('is_published')} /> Yayında</label>
        </div>
        <div className="grid gap-2">
          <Uploader folder="transport" accept="application/pdf" maxSizeMB={10} label="PDF" value={pdfUrl} onChange={(u)=>{ setPdfUrl(u); setValue('pdf_url', u); }} />
          {pdfUrl && (
            <div className="flex justify-end">
              <button type="button" className="px-2 py-1 border text-red-600" onClick={async ()=>{
                if (!confirm('PDF kalıcı olarak silinsin mi?')) return;
                try {
                  await apiFetchAuth('/api/routes/delete-blob', { method: 'POST', body: JSON.stringify({ url: pdfUrl }) });
                  toast('PDF silindi', 'success');
                } catch (e: any) {
                  toast(e?.message || 'PDF silinemedi', 'error');
                }
                setPdfUrl(''); setValue('pdf_url', '');
              }}>PDF’yi Sil</button>
            </div>
          )}
          <Uploader folder="transport" accept="image/*" maxSizeMB={5} label="Görsel" value={imageUrl} onChange={(u)=>{ setImageUrl(u); setValue('image_url', u); }} />
          {imageUrl && (
            <div className="flex justify-end">
              <button type="button" className="px-2 py-1 border text-red-600" onClick={async ()=>{
                if (!confirm('Görsel kalıcı olarak silinsin mi?')) return;
                try {
                  await apiFetchAuth('/api/routes/delete-blob', { method: 'POST', body: JSON.stringify({ url: imageUrl }) });
                  toast('Görsel silindi', 'success');
                } catch (e: any) {
                  toast(e?.message || 'Görsel silinemedi', 'error');
                }
                setImageUrl(''); setValue('image_url', '');
              }}>Görseli Sil</button>
            </div>
          )}
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="px-3 py-1 border rounded-md shadow-sm hover:shadow-md transition" onClick={onClose}>İptal</button>
          <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded-md shadow-sm hover:shadow-md hover:bg-blue-700 transition">Kaydet</button>
        </div>
      </form>
      <div className="grid grid-cols-2 gap-2">
        {pdfUrl && (
          <iframe src={pdfUrl} className="w-full h-64 border" />
        )}
        {imageUrl && (
          <img src={imageUrl} className="w-full h-64 object-cover border" />
        )}
      </div>
    </div>
  );
}


