"use client";
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, LinkButton } from '@/components/Button';
import GalleryModal from '@/components/GalleryModal';
import { useRouter, useSearchParams } from 'next/navigation';
import KesfetFiltreler from '@/components/kesfet/KesfetFiltreler';
import Uploader from '@/components/Uploader';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRole, canEdit, canDelete } from '@/lib/auth';
import { apiFetch, apiFetchAuth } from '@/lib/api';
import { toast } from '@/lib/toast';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

type Place = {
  id: string; name: string; category?: string; description?: string; address?: string; lat?: number; lng?: number; map_url?: string; cover_url?: string; cover_image?: string; is_published: boolean; created_at?: string;
};

const categories = ['tarih','doğa','gastronomi'];

export default function KesfetPage() {
  const role = useRole();
  const [items, setItems] = useState<Place[]>([]);
  const router = useRouter();
  const search = useSearchParams();
  const [category, setCategory] = useState(search.get('kategori') || '');
  const [published, setPublished] = useState<'all' | 'true' | 'false'>((search.get('yayinda') as any) || 'true');
  const [query, setQuery] = useState(search.get('q') || '');
  const [categories, setCategories] = useState<string[]>([]);
  const [editing, setEditing] = useState<Place | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [galleryPlaceId, setGalleryPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let aborter: AbortController | null = null;

  async function load() {
    try {
      setLoading(true); setError(null);
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (published !== 'all') params.set('published', published);
      if (query) params.set('q', query);
      // URL senkronizasyonu (Türkçe param adları)
      const urlParams = new URLSearchParams();
      if (query) urlParams.set('q', query);
      if (category) urlParams.set('kategori', category);
      if (published !== 'all') urlParams.set('yayinda', published);
      router.replace(`?${urlParams.toString()}`);

      // Abortable fetch
      if (aborter) aborter.abort();
      aborter = new AbortController();
      const data = await apiFetch<Place[]>(`/api/explore?${params.toString()}`, { signal: aborter.signal } as any);
      setItems(data || []);
    } catch (e:any) {
      setError(String(e?.message || 'Bir hata oluştu'));
    } finally { setLoading(false); }
  }

  useEffect(() => { const t = setTimeout(load, 350); return () => clearTimeout(t); }, [category, published, query]);

  async function refreshCategories() {
    try {
      const list = await apiFetch<string[]>(`/api/explore/meta/categories?t=${Date.now()}`);
      setCategories((list||[]).slice().sort((a,b)=>a.localeCompare(b,'tr')));
    } catch {}
  }
  useEffect(() => { refreshCategories(); }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Keşfet</h1>
      <div className="flex gap-2 items-center">
        <input className="border p-1" placeholder="Ara" value={query} onChange={(e)=>setQuery(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); load(); } }} aria-label="Genel arama" />
        <select className="border p-1" value={category} onChange={(e)=>setCategory(e.target.value)} aria-label="Kategori">
          <option value="">Kategori (hepsi)</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="border p-1" value={published} onChange={(e)=>setPublished(e.target.value as any)} aria-label="Yayın durumu">
          <option value="all">Hepsi</option>
          <option value="true">Yayında</option>
          <option value="false">Yayında Değil</option>
        </select>
        {canEdit(role) && <Button variant="primary" className="ml-auto" onClick={()=>{ setEditing(null); setShowForm(true); }}>Yeni</Button>}
      </div>

      <div className="rounded-lg border border-gray-300 shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-300 border-collapse rounded-lg">
          <thead className="bg-gray-50 sticky top-0 z-[5] border-b border-gray-300">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-300 bg-gray-50">Kapak</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-300 bg-gray-50">Ad</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-300 bg-gray-50">Kategori</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-300 bg-gray-50">Yayında</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-300 bg-gray-50">Oluşturulma Tarihi</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-300 bg-gray-50">İşlemler</th>
            </tr>
          </thead>
          <tbody>
          {items.map(p => (
            <tr key={p.id} className="hover:bg-gray-50 odd:bg-gray-50/30 transition-colors">
              <td className="px-3 py-2 border border-gray-200 w-16">
                {p.cover_image ? <img src={p.cover_image} className="h-10 w-16 object-cover rounded" /> : null}
              </td>
              <td className="px-3 py-2 border border-gray-200">{p.name}</td>
              <td className="px-3 py-2 border border-gray-200">{p.category}</td>
              <td className="px-3 py-2 border border-gray-200">{p.is_published ? '✓' : '—'}</td>
              <td className="px-3 py-2 border border-gray-200">{p.created_at ? new Date(p.created_at).toLocaleString('tr-TR') : '—'}</td>
              <td className="px-3 py-2 text-right w-64 border border-gray-200">
                <div className="flex items-center justify-end gap-2">
                  {canEdit(role) && <Button variant="secondary" onClick={()=>setGalleryPlaceId(p.id)}>Galeri</Button>}
                  {(() => {
                    const url = p.map_url || (typeof p.lat === 'number' && typeof p.lng === 'number' ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}` : undefined);
                    return url ? <LinkButton variant="secondary" href={url} target="_blank" rel="noreferrer" className="whitespace-nowrap">Yol Tarifi</LinkButton> : null;
                  })()}
                  {canEdit(role) && <Button variant="secondary" onClick={()=>{ setEditing(p); setShowForm(true); }}>Düzenle</Button>}
                  {canDelete(role) && <Button variant="destructive" onClick={()=>onDelete(p.id)}>Sil</Button>}
                </div>
              </td>
            </tr>
          ))}
          {(!items || items.length===0) && (
            <tr><td colSpan={6} className="text-center text-gray-500 py-6 border border-gray-200">Veri bulunamadı</td></tr>
          )}
          </tbody>
        </table>
      </div>

      {showForm && (typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[1000]">
          <PlaceForm
            initial={editing || undefined}
            onClose={() => { setShowForm(false); load(); }}
            onSaved={async ()=>{
              await refreshCategories();
              await load();
            }}
          />
        </div>, document.body) : null)}

      {galleryPlaceId && (
        <GalleryModal
          kind="explore"
          placeId={galleryPlaceId}
          onClose={()=>setGalleryPlaceId(null)}
          onSaved={async ()=>{ await load(); }}
        />
      )}
    </div>
  );

  async function onDelete(id: string) {
    if (!confirm('Silinsin mi?')) return;
    await apiFetchAuth(`/api/explore/${id}`, { method: 'DELETE' });
    await load();
    await refreshCategories();
  }
}

function authHeader(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

const isGoogleMapsUrl = (u: unknown) => typeof u === 'string' && /^(https:\/\/www\.google\.com\/maps|https:\/\/goo\.gl\/maps)/i.test(u);
const schema = z.object({
  name: z.string().min(1, 'Ad alanı zorunludur.'),
  category: z.string().min(1, 'Kategori seçiniz.'),
  description: z.string().optional(),
  mapUrl: z.string().refine(isGoogleMapsUrl, 'Geçerli bir Google Maps bağlantısı giriniz.'),
  cover_url: z.string().url('Geçersiz URL').optional().or(z.literal('')),
  is_published: z.boolean().default(true)
});
type FormData = z.infer<typeof schema>;

function PlaceForm({ initial, onClose, onSaved }: { initial?: Place; onClose: () => void; onSaved?: () => void }) {
  const [coverUrl, setCoverUrl] = useState(initial?.cover_url || initial?.cover_image || '');
  const { register, handleSubmit, formState:{ errors, isSubmitting }, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name || '',
      category: initial?.category || '',
      description: initial?.description || '',
      mapUrl: initial?.map_url || (typeof initial?.lat === 'number' && typeof initial?.lng === 'number' ? `https://www.google.com/maps/dir/?api=1&destination=${initial!.lat},${initial!.lng}` : ''),
      cover_url: initial?.cover_url || '',
      is_published: initial?.is_published ?? true
    }
  });
  const isEdit = !!initial;

  async function onSubmit(values: FormData) {
    const path = isEdit ? `/api/explore/${initial!.id}` : `/api/explore`;
    const method = isEdit ? 'PUT' : 'POST';
    const payload = { name: values.name, category: values.category, description: values.description, mapUrl: values.mapUrl, cover_url: values.cover_url ?? null, is_published: values.is_published } as any;
    try {
      await apiFetchAuth(path, { method, body: JSON.stringify(payload) });
      toast('Kaydedildi','success');
      onClose();
      try { onSaved && (await onSaved()); } catch {}
    } catch (e:any) {
      const msg = String(e?.message || 'Kaydedilemedi');
      if (/Bu ad zaten mevcut/i.test(msg)) toast('Aynı adda zaten bir kayıt mevcut.', 'error');
      else toast(msg,'error');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-[1000]">
      <div className="bg-white p-4 rounded w-full max-w-2xl space-y-3 z-[1001]">
        <h2 className="text-lg font-semibold">{isEdit ? 'Düzenle' : 'Yeni'} Yer</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-2" noValidate>
          <div>
            <input className="border p-2 w-full" placeholder="Ad" {...register('name')} />
            {errors.name && <div className="text-xs text-red-600">{String(errors.name.message)}</div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="border p-2" placeholder="Kategori" {...register('category')} />
            {errors.category && <div className="text-xs text-red-600 col-span-2">{String(errors.category.message)}</div>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('is_published')} /> Yayında</label>
          </div>
          <textarea className="border p-2" placeholder="Açıklama" {...register('description')} />
          <input className="border p-2" placeholder="https://www.google.com/maps/..." aria-label="Google Maps Linki" {...register('mapUrl')} />
          {errors.mapUrl && <div className="text-xs text-red-600">{String(errors.mapUrl.message)}</div>}
          <div className="grid gap-2">
            <Uploader folder="explore" accept="image/*" maxSizeMB={5} label="Kapak" value={coverUrl} onChange={async (u)=>{
              setCoverUrl(u); setValue('cover_url', u);
            }} />
            <div className="flex justify-end gap-2">
              {coverUrl && (
                <button type="button" className="px-2 py-1 border text-red-600" onClick={async ()=>{
                  try {
                    await apiFetchAuth(`/api/explore/${initial?.id}/cover`, { method: 'PUT', body: JSON.stringify({ cover_url: null }) });
                    setCoverUrl(''); setValue('cover_url','');
                    toast('Kapak temizlendi','success');
                  } catch (e:any) { toast(e?.message||'Temizlenemedi','error'); }
                }}>Temizle</button>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" className="px-3 py-1 border" onClick={onClose} disabled={isSubmitting}>İptal</button>
            <button type="submit" className="px-3 py-1 bg-blue-600 text-white disabled:opacity-50" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}</button>
          </div>
          {initial?.created_at && (
            <div className="text-xs text-gray-500">Oluşturulma Tarihi: {new Date(initial.created_at).toLocaleString('tr-TR')}</div>
          )}
        </form>
        {coverUrl && <img src={coverUrl} className="w-full h-64 object-cover border" />}
      </div>
    </div>
  );
}

// GalleryManager kaldırıldı


