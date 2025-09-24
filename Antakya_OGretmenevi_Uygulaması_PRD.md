
# Antakya Öğretmenevi Mobil Uygulaması – PRD

> Platform: React Native (Expo, iOS & Android)  
> Yönetim Paneli: Next.js (Web)  
> Backend: Node.js (NestJS/Express) + Microsoft SQL Server + Azure Blob Storage

---

## 1) Ürün Özeti
**Amaç:** Antakya Öğretmenevi misafirlerine şehir ve tesis bilgilerini tek uygulamada sunmak: Anasayfa (tanıtım + slider), Yemek (sponsor restoranlar), Ulaşım (otobüs hatları ve güzergâh görselleri/PDF), Şehri Keşfet (gezilecek yerler), Bize Ulaşın (geri bildirim formu).  
**Hedef kullanıcılar:**
- **Misafirler**: Şehri ilk kez ziyaret edenler, hızlı yön bulma ve öneri arayanlar.
- **Personel/Yönetim**: İçerikleri güncelleyen, sponsorlukları yöneten ekip.

**Başarı ölçütleri (KPI):**
- Haftalık aktif kullanıcı (WAU)
- Yemek menüsünde yönlendirme tıklamaları ("Yol Tarifi"/"Ara")
- Ulaşım ekranında hat görüntüleme sayısı
- Keşfet detay sayfası görüntüleme süresi
- Geri bildirim gönderim oranı

---

## 2) Kapsam
### 2.1 Mobil Uygulama Modülleri
1. **Splash**: 1–2 sn Öğretmenevi logosu, ardından Anasayfa.
2. **Anasayfa**: Otomatik dönen 5–10 görsellik slider (tarihî ve kültürel görseller + kısa başlıklar). CTA: "Şehri Keşfet" ve "Ulaşım" kısayolları.
3. **Yemek**: 10–15 sponsor restoran kartı (görsel, başlık, mutfak tipi, adres, Google Maps linki, telefon). Filtre: mutfak türü/mesafe. Butonlar: **Ara**, **Yol Tarifi**.
4. **Ulaşım**: Otobüs hat listesi (örn. 100/200/300 serileri). Hat seçilince detay: güzergâh metni, rota görseli (varsa), PDF bağlantısı, Google Maps yönlendirme (başlangıç/hedef). Arama ve favori hatlar.
5. **Şehri Keşfet**: Kart grid‘inde yerler (küçük görsel + başlık + “Detay”). Detay: tarihçe, foto galerisi, saatler/ücret (varsa), **Yol Tarifi**.
6. **Bize Ulaşın**: İsim, e‑posta, açıklama. Gönderimler MSSQL’e kaydedilir. Gönderim sonrası teşekkür ekranı.

### 2.2 Yönetim Paneli (Web)
- **Auth & Roller**: Admin, Editör, Görüntüleyici (JWT/NextAuth, MSSQL’de `users` ve `roles`).
- **İçerik Yönetimi**:
  - Anasayfa Slider: listeler, sürükle-bırak sıralama, yayınla/taslak.
  - **Yemek**: restoran CRUD, sponsor etiketi, görünürlük, konum (lat/lng), telefon, logo/kapak.
  - **Ulaşım**: hat CRUD, PDF ve rota görselleri yükleme (Azure Blob), etiketler (100/200/300), arama anahtar kelimeleri.
  - **Keşfet**: yer CRUD, kategori (tarih, doğa, gastronomi), galeriler, Google Maps linki.
  - **Geri Bildirim**: listele, okunmuş/yanıtlandı durumları, CSV dışa aktar.
- **Medya**: Azure Blob Storage klasörleri (home/, food/, transport/, explore/, uploads/).
- **Yayın Akışı**: Draft → Review → Publish.

### 2.3 Kapsam Dışı (V1)
- Canlı otobüs konumları, push bildirim kampanyaları, çok dilli içerik (TR dışı), rezervasyon/ödeme.

## 3) Kullanıcı Akışları
### 3.1 İlk Açılış
Splash → Onboarding (opsiyonel 2–3 slayt) → Anasayfa slider → menü.

### 3.2 Yemek: Yol Tarifi
Liste → Restoran kartı → **Yol Tarifi** → Google Maps deeplink (lat,lng).

### 3.3 Ulaşım: Hat Seçimi
Hat listesi → 101 gibi bir hattı seç → güzergâh metni + rota görseli + PDF link → **Yol Tarifi** şablonları (başlangıç: Öğretmenevi veya mevcut konum; hedef: rota üzerindeki bir durak).

### 3.4 Şehri Keşfet: Detay
Keşfet listesi → Detay → Galeri kaydırma → **Yol Tarifi**.

### 3.5 Bize Ulaşın: Gönderim
Form doldur → Gönder → DB’ye kayıt → Başarılı mesajı → (Ops.) e‑posta bildirimi.

---

## 4) Bilgi Mimarisi & Site Haritası
- **/ (Anasayfa)**
- **/yemek**
  - /yemek/:id
- **/ulasim**
  - /ulasim/:hatNo (örn. /ulasim/101)
- **/kesfet**
  - /kesfet/:id
- **/iletisim**

Admin (web): /admin, /admin/login, /admin/yemek, /admin/ulasim, /admin/kesfet, /admin/slider, /admin/feedback

---

## 5) Veri Modeli (Microsoft SQL Server – T‑SQL)
> Not: `uniqueidentifier` + `NEWID()`, `datetime2`, `bit`; dizi alanlar için ilişki tablosu kullanılır.

```sql
-- users & roles (özet)
CREATE TABLE users (
  id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  email NVARCHAR(255) NOT NULL UNIQUE,
  name NVARCHAR(120) NULL,
  password_hash VARBINARY(256) NULL, -- admin için; son kullanıcı mobilde gerekmez
  role NVARCHAR(50) NOT NULL DEFAULT 'editor', -- admin | editor | viewer
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE sliders (
  id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  title NVARCHAR(200) NULL,
  image_url NVARCHAR(1000) NOT NULL,
  link NVARCHAR(1000) NULL,
  position INT NOT NULL DEFAULT 0,
  is_published BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE restaurants (
  id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  name NVARCHAR(200) NOT NULL,
  cuisine NVARCHAR(120) NULL,
  phone NVARCHAR(40) NULL,
  address NVARCHAR(400) NULL,
  lat FLOAT NULL,
  lng FLOAT NULL,
  image_url NVARCHAR(1000) NULL,
  is_sponsor BIT NOT NULL DEFAULT 0,
  is_published BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE routes (
  id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  code NVARCHAR(20) NOT NULL,           -- örn: '101'
  title NVARCHAR(200) NULL,
  description NVARCHAR(MAX) NULL,       -- tam güzergâh
  pdf_url NVARCHAR(1000) NULL,          -- Azure Blob URL
  image_url NVARCHAR(1000) NULL,        -- rota görseli
  series NVARCHAR(10) NULL,             -- 100/200/300
  is_published BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE explore_places (
  id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  name NVARCHAR(200) NOT NULL,
  category NVARCHAR(80) NULL,           -- tarih, doğa, gastronomi
  description NVARCHAR(MAX) NULL,
  address NVARCHAR(400) NULL,
  lat FLOAT NULL,
  lng FLOAT NULL,
  cover_url NVARCHAR(1000) NULL,
  is_published BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE explore_place_gallery (
  id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  place_id UNIQUEIDENTIFIER NOT NULL,
  image_url NVARCHAR(1000) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  CONSTRAINT FK_gallery_place FOREIGN KEY (place_id) REFERENCES explore_places(id) ON DELETE CASCADE
);

CREATE TABLE feedback (
  id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  name NVARCHAR(120) NULL,
  email NVARCHAR(255) NULL,
  message NVARCHAR(MAX) NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  handled BIT NOT NULL DEFAULT 0
);

CREATE INDEX IX_routes_code ON routes(code);
CREATE INDEX IX_restaurants_published ON restaurants(is_published);
```

### 5.1 Yetkilendirme
- Mobil API: yalnızca `is_published = 1` olan kayıtları döndüren **read‑only** endpoint’ler.
- Admin API: JWT/role bazlı koruma; MSSQL’de opsiyonel **Row‑Level Security** kullanılabilir (SQL Server 2016+).

---

## 6) Entegrasyonlar
- **Google Maps**: 
  - Mobil: `Linking.openURL('https://www.google.com/maps/dir/?api=1&destination=lat,lng')`
  - Geocoding istenirse üçüncü parti servis.
- **Konum İzni**: Expo Location.
- **Medya Deposu**: **Azure Blob Storage** klasörleri: `home/`, `food/`, `transport/`, `explore/`, `uploads/`.
- **Sunucu**: Node.js (NestJS/Express) + `mssql`/TypeORM/Prisma ile Azure SQL’e bağlanır.

---

## 8) Teknik Mimari
- **Mobil**: React Native + Expo Router, TypeScript, React Query, Zustand, Zod.
- **Web Admin**: Next.js (App Router), TypeScript, shadcn/ui, React Hook Form + Zod, TanStack Table, dosya yükleme (Azure Blob SAS).
- **Backend**: Node.js (NestJS veya Express). ORM: Prisma (SQL Server connector) **veya** TypeORM. Auth: JWT/NextAuth (admin). Rate limit ve CORS.
- **Analitik**: Sentry, PostHog (ops.).
- **CI/CD**: Expo EAS; Vercel (admin) + Azure App Service/Container Apps (API); Azure SQL DB migrations.

### 8.1 Dizin Yapıları (özet)
```
/apps
  /mobile (Expo)
    app/
      (tabs)/
      index.tsx
      yemek/
      ulasim/
      kesfet/
      iletisim/
    src/components/
    src/lib/
    src/api/
  /admin (Next.js)
    app/
      (dashboard)/
      yemek/
      ulasim/
      kesfet/
      slider/
      feedback/
    components/
    lib/
  /api (NestJS/Express)
    src/
      modules/
        restaurants/
        routes/
        sliders/
        explore/
        feedback/
      common/
      prisma-or-typeorm/
/migrations
```

---

## 10) Örnek API/Sözleşmeler
### REST
```http
GET    /api/routes?series=100&published=true
GET    /api/routes/:code
POST   /api/routes            # admin
PUT    /api/routes/:id        # admin
DELETE /api/routes/:id        # admin

GET    /api/restaurants?published=true
GET    /api/explore
POST   /api/feedback          # mobil formu
```

### Örnek TypeScript Modelleri
```ts
export type Route = {
  id: string; code: string; title?: string; description?: string; pdf_url?: string; image_url?: string; series?: string;
  is_published: boolean;
};
```

---

## 11) PDF & Görsel Yönetimi (Ulaşım)
- PDF’ler ve görseller **Azure Blob Storage** `transport/` klasörüne.
- Admin’de PDF önizleme ve “Metni çıkar” (opsiyonel server-side işlem).
- Hat kodunu dosya adından veya form alanından alın.
- Normalize: GİDİŞ/DÖNÜŞ bölümleri, satır sonları temizliği.

---

## 12) Performans & Offline
- React Query cache + `staleTime`: 5 dk.
- İlk açılışta prefetch: slider, restoranlar, hatlar.
- Görseller için `expo-image` + önbellek.
- Offline: son cache’i göster; feedback kuyruğu (ops.).

---

## 13) Güvenlik
- Admin API’lerinde JWT + rol bazlı yetki; şifreler `bcrypt` ile hashlenir.
- MSSQL bağlantısı için en az `ReadOnly` ve `Write` için ayrık kullanıcılar; üretimde **Azure SQL AAD** tercih edin.
- (Ops.) SQL Server **Row‑Level Security** ile yayınlanmamış veriye erişim kısıtlama.
- Dosya yüklemelerinde içerik tipi doğrulama ve boyut limiti; Blob SAS token süre kısıtı.

---

## 15) Yayın & Operasyon
- **Mobil**: EAS build, TestFlight/Closed testing, prod.
- **Admin**: Vercel (ENV: NEXTAUTH_SECRET, NEXTAUTH_URL, API_BASE_URL, AZURE_… ).
- **API**: Azure App Service/Container Apps; ENV: `DATABASE_URL` (SQL Server), `JWT_SECRET`, Blob ayarları (account, container, key/SAS).
- **Veritabanı**: versiyonlama `migrations` (Prisma migrate veya TypeORM migrations).
- **Loglama**: App Insights / Sentry.

---

## 18) Cursor AI ile Çalışma Planı (Kısaltılmış)
1. **Repo kur**: `pnpm create expo`, `pnpm dlx create-next-app@latest`, `pnpm dlx @nestjs/cli new api` (veya Express).
2. **.cursor/rules**: PRD, şema ve hedefleri bağlam olarak sabitle; MSSQL + Azure altyapısını değişmez kıl.
3. **Görevler**: “MSSQL için şema ve migration üret”, “API’de /routes CRUD modülü oluştur (Prisma/TypeORM)”, “Admin’de routes CRUD sayfası”.
4. **Entegrasyon**: Azure Blob yükleme yardımcıları (SAS) ve admin formu.
5. **Debug/Test**: Jest + E2E (Playwright/Detox); hatayı Cursor’a ver, düzeltme PR’ı üret.

---
