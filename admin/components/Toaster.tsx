"use client";
import { useEffect, useState } from 'react';
import { subscribe } from '@/lib/toast';

export default function Toaster() {
  const [items, setItems] = useState<{ id: number; message: string; type?: 'success'|'error'|'info' }[]>([]);
  useEffect(() => {
    return subscribe((t) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== t.id)), 3000);
    });
  }, []);
  return (
    <div className="fixed bottom-6 right-6 z-[2000] space-y-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2 rounded-md text-white shadow-lg backdrop-blur-sm/10 ${t.type === 'error' ? 'bg-red-600' : t.type === 'success' ? 'bg-green-600' : 'bg-gray-900'}
          transition-opacity duration-200`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}


