"use client";
import * as React from 'react';
import { apiFetchAuth } from '@/lib/api';
import { toast } from '@/lib/toast';

type Props = { kind: 'explore' | 'restaurant'; placeId: string; onClose: () => void; onSaved?: () => void };

export default function GalleryModal({ kind, placeId, onClose, onSaved }: Props) {
  const [images, setImages] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [cover, setCover] = React.useState<string | null>(null);
  const base = kind === 'explore' ? '/api/explore' : '/api/restaurants';

  async function load() {
    const r = await apiFetchAuth(`${base}/${placeId}/images`);
    setImages((r as any)?.images || []);
    try {
      const detail = await apiFetchAuth(`${kind === 'explore' ? '/api/explore/admin' : '/api/restaurants'}/${placeId}`);
      setCover((detail as any)?.cover_image || null);
    } catch {}
  }
  React.useEffect(() => { load(); }, [placeId]);

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const { uploadUrl, blobUrl } = await apiFetchAuth(`${base === '/api/explore' ? '/api/explore' : '/api/restaurants'}/upload-sas`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ type:'image', size: files[0].size, filename: files[0].name }) });
      const put = await fetch(uploadUrl, { method:'PUT', headers: { 'x-ms-blob-type':'BlockBlob', 'Content-Type': files[0].type || 'image/jpeg' }, body: files[0] });
      if (!put.ok) throw new Error('Yükleme hatası');
      await apiFetchAuth(`${base}/${placeId}/images`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ url: blobUrl }) });
      await load();
      onSaved && onSaved();
    } finally { setBusy(false); }
  }

  async function remove(url: string) {
    await apiFetchAuth(`${base}/${placeId}/images`, { method:'DELETE', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ url }) });
    await load();
    onSaved && onSaved();
  }

  async function makeCover(url: string) {
    await apiFetchAuth(`${base}/${placeId}/cover`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ cover_url: url }) });
    try { toast('Kapak güncellendi','success'); } catch {}
    setCover(url);
    onSaved && onSaved();
  }

  async function reorder(from: number, to: number) {
    const next = [...images];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    await apiFetchAuth(`${base}/${placeId}/images`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ images: next }) });
    setImages(next);
    onSaved && onSaved();
  }

  // Minimal drag handling
  const dragIndex = React.useRef<number | null>(null);

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-[1000]">
      <div className="bg-white p-4 rounded w-full max-w-3xl space-y-3 z-[1001]">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold">Galeri</h2>
          <button className="ml-auto btn btn-secondary" onClick={onClose}>Kapat</button>
        </div>
        <input type="file" accept="image/*" onChange={(e)=>addFiles(e.target.files)} disabled={busy} />
        <ul className="grid grid-cols-4 gap-2">
          {images.map((u, idx) => (
            <li key={u} className={`border p-1 space-y-1 relative ${cover === u ? 'ring-2 ring-green-600' : ''}`}>
              <img src={u} className="w-full h-24 object-cover rounded" draggable onDragStart={()=>{ dragIndex.current = idx; }} onDragOver={(e)=>e.preventDefault()} onDrop={()=>{ if (dragIndex.current !== null && dragIndex.current !== idx) reorder(dragIndex.current, idx); dragIndex.current = null; }} />
              {cover === u && <span className="absolute top-1 left-1 text-xs bg-green-600 text-white px-1 rounded">Kapak</span>}
              <div className="flex gap-1">
                <button className="btn btn-secondary" onClick={()=>makeCover(u)}>Kapak</button>
                <button className="btn btn-destructive ml-auto" onClick={()=>remove(u)}>Sil</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


