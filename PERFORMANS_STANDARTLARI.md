# 🚀 Büyük Ölçekli Veri ve Performans Standartları

Bu döküman, projenin 100.000+ ürün ve 10.000+ firma gibi yüksek hacimli veriler altında sorunsuz çalışması için uyulması gereken **zorunlu** yazılım kurallarını içerir.

## 1. Veritabanı Sorgu Standartları (SQL & Supabase)
*   **Zorunlu Pagination (Sayfalama):** Hiçbir liste sorgusu (Ürünler, Siparişler, Firmalar) limitsiz çalıştırılamaz. Varsayılan sayfa boyutu 20-50 arası olmalıdır.
*   **Indexing (İndeksleme):** Arama yapılan her sütun (OEM No, Marka, Ürün Adı, Vergi No) için PostgreSQL tarafında `B-Tree` veya `GIN` indeksleri bulunmalıdır.
*   **Full-Text Search:** 100 bin ürün içindeki metin aramaları için `pg_trgm` (Trigram) veya `tsvector` tabanlı tam metin araması kullanılmalıdır. Standard `LIKE %...%` sorguları bu ölçekte yasaktır.

## 2. API ve Backend Standartları
*   **Server-Side Processing:** Arama, filtreleme ve sıralama işlemleri asla istemci tarafında (browser) yapılmamalı, her zaman veritabanı seviyesinde (server-side) bitirilmelidir.
*   **Zaman Aşımı Yönetimi:** XML parse etme veya toplu veri güncelleme gibi 10 saniyeden uzun sürecek işlemler "Batch Processing" veya "Edge Functions" (Vercel) ile parçalara bölünerek yönetilmelidir.
*   **Caching:** Sık değişmeyen veriler (Kategoriler, Marka Listeleri) için `stale-while-revalidate` veya Redis benzeri bir cache katmanı düşünülmelidir.

## 3. Görsel ve Dosya Yönetimi
*   **Unoptimized Images:** Vercel maliyetlerini düşürmek için Next.js Image Component'i `unoptimized={true}` ile kullanılmalı, görsel boyutlandırma işi R2 üzerinden veya yükleme aşamasında (sharp kütüphanesi ile) halledilmelidir.
*   **Lazy Loading:** Tüm ürün listelerindeki görseller "lazy" yüklenmelidir.

## 4. Altyapı Planlaması
*   10.000+ firma girişi beklenen projelerde **Supabase Pro** ve **Vercel Pro** kullanımı mühendislik gereğidir (Timeout ve Connection Limitleri nedeniyle).

---
*Bu kurallara uyulmaması sistemin kilitlenmesine veya yüksek faturalara neden olur.* ⚠️
