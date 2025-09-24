"use client";
import Link from 'next/link';

export default function AdminHome() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center gap-3">
          <h1 className="font-semibold">Yönetim</h1>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <section className="rounded-xl p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border">
          <h2 className="text-xl font-semibold">Hoş geldiniz</h2>
          <p className="text-gray-600 mt-1">Aşağıdaki bölümlerden içerikleri kolayca yönetebilirsiniz.</p>
        </section>

        <section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/admin/yemek" className="group rounded-lg border p-4 hover:shadow-md transition bg-white">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 grid place-items-center rounded-full bg-orange-100 text-orange-700 text-lg">🍽️</div>
                <div>
                  <div className="font-semibold">Yemek</div>
                  <p className="text-sm text-gray-600">Restoranlar, menüler ve iletişim bilgileri.</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500 group-hover:text-gray-700">Yemek içeriklerini düzenle →</div>
            </Link>

            <Link href="/admin/slider" className="group rounded-lg border p-4 hover:shadow-md transition bg-white">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 grid place-items-center rounded-full bg-purple-100 text-purple-700 text-lg">🖼️</div>
                <div>
                  <div className="font-semibold">Slider</div>
                  <p className="text-sm text-gray-600">Ana sayfa görsellerini sırala ve yayınla.</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500 group-hover:text-gray-700">Slider görsellerini yönet →</div>
            </Link>

            <Link href="/admin/ulasim" className="group rounded-lg border p-4 hover:shadow-md transition bg-white">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 grid place-items-center rounded-full bg-green-100 text-green-700 text-lg">🚌</div>
                <div>
                  <div className="font-semibold">Ulaşım</div>
                  <p className="text-sm text-gray-600">Rota, saat ve dosyaları düzenleyin.</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500 group-hover:text-gray-700">Ulaşım içeriklerini yönet →</div>
            </Link>

            <Link href="/admin/kesfet" className="group rounded-lg border p-4 hover:shadow-md transition bg-white">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 grid place-items-center rounded-full bg-cyan-100 text-cyan-700 text-lg">🧭</div>
                <div>
                  <div className="font-semibold">Keşfet</div>
                  <p className="text-sm text-gray-600">Gezi noktaları ve kapak görselleri.</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500 group-hover:text-gray-700">Keşfet yerlerini düzenle →</div>
            </Link>

            <Link href="/admin/feedback" className="group rounded-lg border p-4 hover:shadow-md transition bg-white">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 grid place-items-center rounded-full bg-rose-100 text-rose-700 text-lg">💬</div>
                <div>
                  <div className="font-semibold">Geri Bildirim</div>
                  <p className="text-sm text-gray-600">Ziyaretçi mesajlarını gör, filtrele ve dışa aktar.</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500 group-hover:text-gray-700">Mesajları Gör →</div>
            </Link>
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-4 bg-white">
            <h3 className="font-semibold">Hızlı Başlangıç</h3>
            <ul className="list-disc pl-5 text-sm text-gray-600 mt-2 space-y-1">
              <li>Yeni slider ekle ve sıralamayı güncelle.</li>
              <li>Keşfet yerlerinde kapak görseli belirle.</li>
              <li>Yemek sayfasında telefon ve harita linkini kontrol et.</li>
            </ul>
          </div>
          <div className="rounded-xl border p-4 bg-white">
            <h3 className="font-semibold">İpucu</h3>
            <p className="text-sm text-gray-600 mt-2">CSV dışa aktarmada Türkçe karakter desteği aktif. Filtreleri uygulayıp öyle indir.</p>
          </div>
        </section>
      </main>
    </div>
  );
}


