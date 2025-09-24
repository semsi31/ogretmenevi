"use client";
import { useEffect, useMemo, useState } from 'react';
import GalleryModal from '@/components/GalleryModal';
import { useForm, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRole, canEdit, canDelete } from '@/lib/auth';
import { toast } from '@/lib/toast';
import Uploader from '@/components/Uploader';
import DataTable from '@/components/DataTable';
import { createPortal } from 'react-dom';
import { apiFetch, apiFetchAuth } from '@/lib/api';

type Restaurant = { id: string; name: string; cuisine?: string; phone?: string; address?: string; lat?: number; lng?: number; image_url?: string | string[]; cover_image?: string | null; is_sponsor: boolean; is_published: boolean; created_at?: string };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function RestaurantsPage() {
  const role = useRole();
  const [items, setItems] = useState<Restaurant[]>([]);
  const [published, setPublished] = useState<'all' | 'true' | 'false'>('true');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [galleryId, setGalleryId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const params = new URLSearchParams();
    // 'all' gönderildiğinde API filtre uygulamaz; diğerlerinde true/false değeri uygulanır
    params.set('published', published);
    if (query) params.set('q', query);
    const data = await apiFetch<Restaurant[]>(`/api/restaurants?${params.toString()}`);
    setItems(data || []);
  }

  // Ulaşım sayfasındaki gibi otomatik filtreleme (debounce)
  useEffect(() => {
    const t = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(t);
  }, [published, query]);

  const columns = useMemo(() => [
    { header: 'Kapak', id: 'cover', cell: ({ row }: any) => {
      const r = row.original as Restaurant;
      const img = Array.isArray(r.image_url) ? (r.image_url[0] || null) : r.image_url;
      const cover = (r as any).cover_image || img;
      return cover ? <img src={cover} className="h-8 w-12 object-cover rounded border" /> : null;
    } },
    { header: 'Ad', accessorKey: 'name' },
    { header: 'Mutfak', accessorKey: 'cuisine' },
    { header: 'Telefon', cell: ({ row }: any) => {
      const p = String((row.original as any).phone || '');
      const d = p.replace(/\D+/g,'');
      const s = d.length === 11 ? d : (d.length === 12 && d.startsWith('90') ? '0'+d.slice(2) : d);
      if (s.length === 11) {
        const area = s.slice(1,4); const p1 = s.slice(4,7); const p2 = s.slice(7,9); const p3 = s.slice(9);
        return `(${area}) ${p1} ${p2} ${p3}`;
      }
      return p;
    } },
    { id: 'published', header: 'Yayında', cell: ({ row }: any) => (row.original.is_published ? '✓' : '—') },
    { id: 'sponsor', header: 'Sponsor', cell: ({ row }: any) => (row.original.is_sponsor ? '✓' : '—') },
    { id: 'directions', header: 'Yol Tarifi', cell: ({ row }: any) => {
      const r = row.original as Restaurant;
      const url = r.lat != null && r.lng != null
        ? `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`
        : r.address
          ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.address)}`
          : undefined;
      return url ? (
        <a className="px-2 py-1 border rounded" href={url} target="_blank" rel="noreferrer">Aç</a>
      ) : null;
    } },
    {
      id: 'actions', header: 'İşlemler',
      cell: ({ row }: any) => (
        <div className="flex gap-2 justify-end">
          {canEdit(role) && <button className="btn btn-secondary" onClick={()=>setGalleryId(row.original.id)}>Galeri</button>}
          {canEdit(role) && <button className="btn btn-secondary" onClick={()=>{ setEditing(row.original); setShowForm(true); }}>Düzenle</button>}
          {canDelete(role) && <button className="btn btn-destructive" onClick={()=>onDelete(row.original.id)}>Sil</button>}
        </div>
      )
    }
  ], [role]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Yemek</h1>
      <div className="flex gap-2 items-center">
        <input className="border p-1" placeholder="Ara" value={query} onChange={(e)=>setQuery(e.target.value)} />
        <select className="border p-1" value={published} onChange={(e)=>setPublished(e.target.value as any)}>
          <option value="all">Yayın (hepsi)</option>
          <option value="true">Yayında</option>
          <option value="false">Yayında değil</option>
        </select>
        {canEdit(role) && <button className="btn btn-primary ml-auto" onClick={()=>{ setEditing(null); setShowForm(true); }}>Yeni</button>}
      </div>

      <DataTable columns={columns as any} data={items} globalFilterPlaceholder="Ara" showGlobalFilter={false} />

      {showForm && (typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[1000]">
          <RestaurantForm initial={editing || undefined} onClose={() => { setShowForm(false); load(); }} />
        </div>, document.body) : null)}
      {galleryId && (
        <GalleryModal
          kind="restaurant"
          placeId={galleryId}
          onClose={()=>{ setGalleryId(null); load(); }}
          onSaved={async ()=>{ await load(); }}
        />
      )}
    </div>
  );

  async function onDelete(id: string) {
    if (!confirm('Silinsin mi?')) return;
    try { await apiFetchAuth(`/api/restaurants/${id}`, { method: 'DELETE' }); toast('Silindi','success'); await load(); } catch (e:any) { toast(e?.message||'Silinemedi','error'); }
  }
}

const schema = z.object({
  name: z.string().min(1,'Ad zorunludur'),
  cuisine: z.string().min(1,'Mutfak zorunludur'),
  phone: z.string().min(1,'Telefon zorunludur'),
  address: z.string().min(1,'Adres zorunludur'),
  lat: z.preprocess((v)=> v === '' || v === null || typeof v === 'undefined' ? undefined : Number(v), z.number({ required_error: 'Lat zorunludur', invalid_type_error: 'Lat sayısal olmalı' })),
  lng: z.preprocess((v)=> v === '' || v === null || typeof v === 'undefined' ? undefined : Number(v), z.number({ required_error: 'Lng zorunludur', invalid_type_error: 'Lng sayısal olmalı' })),
  image_url: z.string().url('Geçersiz URL').optional().or(z.literal('')),
  is_sponsor: z.boolean().default(false),
  is_published: z.boolean().default(true)
});
type FormData = z.infer<typeof schema>;

function RestaurantForm({ initial, onClose }: { initial?: Restaurant; onClose: () => void }) {
  const isEdit = !!initial;
  const initialCover = Array.isArray(initial?.image_url)
    ? ((initial?.image_url as string[])[0] || '')
    : (initial?.image_url || '');
  const [imageUrl, setImageUrl] = useState(initialCover);
  const [mapsLink, setMapsLink] = useState(() => {
    if (initial?.lat != null && initial?.lng != null) {
      return `https://www.google.com/maps/dir/?api=1&destination=${initial.lat},${initial.lng}`;
    }
    return '';
  });
  const { register, handleSubmit, formState:{ errors }, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name || '',
      cuisine: initial?.cuisine || '',
      phone: initial?.phone || '',
      address: initial?.address || '',
      lat: initial?.lat,
      lng: initial?.lng,
      image_url: initialCover,
      is_sponsor: initial?.is_sponsor ?? false,
      is_published: initial?.is_published ?? true
    }
  });

  function parseLatLng(link: string): { lat?: number; lng?: number } {
    try {
      if (!link) return {};
      const u = new URL(link);
      const q = u.searchParams;
      // Pattern 1: destination=lat,lng or daddr=lat,lng
      const dest = q.get('destination') || q.get('daddr') || q.get('q');
      const atMatch = u.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      const pair = dest && dest.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
      const m = pair || atMatch;
      if (m) {
        const lat = Number(m[1]);
        const lng = Number(m[2]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }
      return {};
    } catch { return {}; }
  }

  function onMapsLinkChange(val: string) {
    setMapsLink(val);
    const { lat, lng } = parseLatLng(val);
    if (typeof lat === 'number' && typeof lng === 'number') {
      setValue('lat', lat as any, { shouldValidate: true });
      setValue('lng', lng as any, { shouldValidate: true });
    } else {
      // boşalt, validasyon uyarısı tetiklensin
      setValue('lat', undefined as any, { shouldValidate: true });
      setValue('lng', undefined as any, { shouldValidate: true });
    }
  }

  const onSubmit: SubmitHandler<FormData> = async (values) => {
    const path = isEdit ? `/api/restaurants/${initial!.id}` : `/api/restaurants`;
    const method = isEdit ? 'PUT' : 'POST';
    try {
      // mapsLink verildiyse bir kez daha parse et
      if (mapsLink) {
        const parsed = parseLatLng(mapsLink);
        if (parsed.lat == null || parsed.lng == null) {
          toast('Geçerli bir Google Maps linki girin', 'error');
          return;
        }
        (values as any).lat = parsed.lat;
        (values as any).lng = parsed.lng;
      }
      // Telefonu normalize et: +90XXXXXXXXXX => 0XXXXXXXXXX, sadece rakamları bırak
      if (values.phone) {
        let s = String(values.phone).replace(/\D+/g, '');
        if (s.startsWith('90') && s.length === 12) s = '0' + s.slice(2);
        if (s.length === 10) s = '0' + s;
        if (!/^0\d{10}$/.test(s)) {
          toast('Geçerli bir telefon numarası giriniz', 'error');
          return;
        }
        (values as any).phone = s;
      }
      await apiFetchAuth(path, { method, body: JSON.stringify(values) });
      toast('Kaydedildi','success'); onClose();
    } catch (e:any) {
      const msg = String(e?.message || 'Kaydedilemedi');
      if (/Aynı isimde|duplicate|unique|DUPLICATE_NAME/i.test(msg)) {
        toast('Aynı isimle başka bir restoran mevcut.', 'error');
      } else if (/DUPLICATE_PHONE|telefon/i.test(msg)) {
        toast('Aynı telefon numarası mevcut.', 'error');
      } else {
        toast(msg, 'error');
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-[1000]">
      <div className="bg-white p-4 rounded w-full max-w-2xl space-y-3 z-[1001]">
        <h2 className="text-lg font-semibold">{isEdit ? 'Düzenle' : 'Yeni'} Restoran</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-2" noValidate>
          <input className="border p-2" placeholder="Ad" {...register('name', { required: true })} />
          {errors.name && <div className="text-xs text-red-600">{errors.name.message || 'Ad zorunludur'}</div>}
          <div className="grid grid-cols-2 gap-2">
            <input className="border p-2" placeholder="Mutfak" {...register('cuisine', { required: true })} />
            {errors.cuisine && <div className="text-xs text-red-600 col-span-2">{errors.cuisine.message || 'Mutfak zorunludur'}</div>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('is_published')} /> Yayında</label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="border p-2"
              placeholder="Telefon"
              type="tel"
              inputMode="numeric"
              {...register('phone', {
                required: 'Telefon zorunludur',
                validate: (v: any) => {
                  const raw = String(v || '');
                  let digits = raw.replace(/\D+/g, '');
                  if (digits.startsWith('0090')) digits = digits.slice(4);
                  if (digits.startsWith('90') && digits.length === 12) digits = '0' + digits.slice(2);
                  if (digits.length === 10) digits = '0' + digits;
                  if (/^0\d{10}$/.test(digits)) return true;
                  return 'Geçerli bir telefon numarası giriniz';
                },
                onChange: (e: any) => {
                  const raw = String(e.target.value || '');
                  let digits = raw.replace(/\D+/g, '');
                  if (digits.startsWith('0090')) digits = digits.slice(4);
                  if (digits.startsWith('90') && digits.length <= 12) digits = '0' + digits.slice(2);
                  if (digits.length > 0 && digits[0] !== '0') digits = '0' + digits;
                  digits = digits.slice(0, 11);
                  const display = digits.replace(/^(\d)(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2}).*$/, (_:any,a:string,b:string,c:string,d:string,e:string)=>{
                    let out = a; if (b) out += b.length===3? ' ' + b : b; if (c) out += ' ' + c; if (d) out += ' ' + d; if (e) out += ' ' + e; return out; });
                  e.target.value = display.trim();
                }
              })}
            />
            {errors.phone && <div className="text-xs text-red-600 col-span-2">{(errors.phone as any)?.message || 'Telefon zorunludur'}</div>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('is_sponsor')} /> Sponsor</label>
          </div>
          <input className="border p-2" placeholder="Adres" {...register('address', { required: true })} />
          {errors.address && <div className="text-xs text-red-600">{errors.address.message || 'Adres zorunludur'}</div>}
          <div className="grid gap-2">
            <input className="border p-2" placeholder="Google Maps Linki (Yol Tarifi)" value={mapsLink} onChange={(e)=>onMapsLinkChange(e.target.value)} />
            {/* Gizli alanlar: validasyon ve backend uyumluluğu için */}
            <input type="hidden" {...register('lat', { required: true })} />
            <input type="hidden" {...register('lng', { required: true })} />
            {(errors.lat || errors.lng) && <div className="text-xs text-red-600">Geçerli bir Google Maps linki zorunludur</div>}
          </div>
          <div className="grid gap-2">
            <Uploader folder="food" accept="image/*" maxSizeMB={5} label="Kapak Yükle" value={imageUrl} onChange={(u)=>{ setImageUrl(u); setValue('image_url', u); }} />
            {imageUrl && (
              <div className="flex justify-end">
                <button type="button" className="px-2 py-1 border text-red-600" onClick={async ()=>{
                  if (!confirm('Görsel kalıcı olarak silinsin mi?')) return;
                  try { await apiFetchAuth('/api/restaurants/delete-blob', { method: 'POST', body: JSON.stringify({ url: imageUrl }) }); toast('Görsel silindi','success'); } catch (e:any) { toast(e?.message||'Görsel silinemedi','error'); }
                  setImageUrl(''); setValue('image_url','');
                }}>Görseli Sil</button>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="px-3 py-1 border" onClick={onClose}>İptal</button>
            <button type="submit" className="px-3 py-1 bg-blue-600 text-white">Kaydet</button>
          </div>
        </form>
      </div>
    </div>
  );
}


