# 🚀 XML Entegrasyon ve Otomasyon Rehberi (B2B SaaS Stratejisi)

Bu belge, 50.000+ ürünlük devasa stok listelerini XML üzerinden otomatik olarak nasıl yöneteceğimizi, maliyetleri ve ticari paketleme stratejilerini içermektedir.

---

## 1. Mimari Yapı: İki Farklı Yaklaşım

Müşteriye sunulacak hizmeti iki farklı paket (Base ve Premium) olarak kurgulayabiliriz.

### A. Managed (Yönetilen) Model - "Senin Yönettiğin"
*   **Kitle:** 70.000 TL ve altı kurulum yapan müşteriler.
*   **Çalışma Şekli:** XML linkini ve eşleştirmeleri (Mapping) kod tarafında veya gizli bir tabloda sen yaparsın. Admin panelinde müşteri bir ayar görmez.
*   **Ticari Avantaj:** Müşteri bu işin çok zor ve "yazılımcı müdahalesi gerektiren" bir iş olduğunu düşünür. Aylık bakım ücretini (3.500 TL+) haklı çıkarır.
*   **Teknik:** Vercel Cron Job her gece çalışır, senin tanımladığın sabit linkten veriyi çeker.

### B. Embedded (Gömülü) Model - "SaaS / Otomasyon"
*   **Kitle:** 120.000 TL+ kurulum yapan "Premium" müşteriler.
*   **Çalışma Şekli:** Admin panelinde "Entegrasyon Yönetimi" sayfası olur. Müşteri XML linkini kendi girer, "Hangi alan nereye gelsin?" (Örn: XML'deki 'Stok' -> B2B'deki 'stock_merkez') eşleşmesini kendi yapar.
*   **Ticari Avantaj:** Tam otomasyon satarsın. "Kendi verinizi kendiniz yönetin" özgürlüğü verilir.
*   **Teknik:** Dinamik bir altyapı gerektirir. Cron Job her gece çalışırken veritabanındaki tüm aktif XML kayıtlarını sırayla döner.

---

## 2. Teknik İşleyiş Detayları (55.000 Ürün Senaryosu)

55.000 ürünü tek seferde işlemek sistemi dondurur. Bu yüzden **"Zeki Robot" (Chunking)** yöntemini kullanacağız:

1.  **Fetch (Veri Çekme):** Robot XML linkine gider, tüm dosyayı (yaklaşık 25MB yazı verisi) tek seferde 5-10 saniyede indirir.
2.  **Parsing (Çözümleme):** XML verisi hızlı bir parser (`fast-xml-parser`) ile JSON formatına çevrilir.
3.  **Chunking (Parçalama):** 55.000 ürün, 5.000'erli 11 adet pakete bölünür.
4.  **Bulk Upsert (Toplu Yazma):** Her paket Supabase'e gönderilir. Supabase'in `upsert` özelliği sayesinde:
    *   Ürün kodunda eşleşme varsa: Fiyat ve Stok **GÜNCELLENİR**.
    *   Ürün kodunda eşleşme yoksa: Yeni ürün **EKLENİR**.
5.  **Clean-up (Temizlik):** XML dosyasında artık bulunmayan ürünler tespit edilir ve sistemde otomatik "Pasif" veya "Stokta Yok" işaretlenir.

---

## 3. Platform Üyelikleri ve Gerekli Araçlar

Yüksek hacimli (50k+) bir sistemin "kurumsal" çalışması için şu üyelikler şarttır:

| Platform | Plan | Aylık Maliyet | Neden Gerekli? |
| :--- | :--- | :--- | :--- |
| **Supabase** | Pro Plan | $25 | 500MB sınırını aşmak ve veritabanı hızını artırmak için. |
| **Vercel** | Pro Plan | $20 | 10 saniyelik işlem limitini 5 dakikaya çıkarmak (XML İşleme için). |
| **Cloudflare R2** | Free/Paid | ~$0 - $5 | Ürün resimlerini depolamak için (İlk 10GB Bedava). |
| **Upstash** | Redis (Free) | $0 | Robotun nerede kaldığını takip etmek için (Opsiyonel). |

**Toplam Sabit Gider:** Aylık yaklaşık **$45 (~1.500 TL)**. 
*(Müşteriye yansıtılan Server Bedeli: 60$ (~2.000 TL+), Kar: +15$)*

---

## 4. Gelecek Vizyonu: Görsel Kontrolü (Image Sync)

Eğer müşteri "Görselleri de XML'den her gün kontrol et" derse uygulanacak stratejiler:

*   **Delta Sync (Sadece Fark):** Robot XML'deki resim linki ile bizim veritabanındakini kıyaslar. Eğer link değişmişse resmi indirip WebP yapar ve R2'ye atar. Link aynıysa pas geçer. (Saniyeler sürer).
*   **Queue (Kuyruk):** Eğer çok fazla yeni resim gelirse (örn: 10.000 yeni ürün), robot bunları zamana yayar. Saatte 1.000 resim işleyerek tüm günü kullanır. Vercel timeout'una asla takılmaz.

---

## 5. Uygulama Adımları (Müşteri XML Verince Yapılacaklar)

1.  **Örnek Veri:** Müşteriden XML dosyasının bir kopyası veya linki istenir.
2.  **Script Yazımı:** Ben (Gemini) o XML yapısına özel bir "Mapper" hazırlarım.
3.  **Cron Kurulumu:** `vercel.json` içine görev eklenir.
4.  **İlk Senkron:** Elle tetiklenerek 55.000 ürün sisteme ilk kez basılır.
5.  **Kontrol:** Bayi panelinde fiyatların ve stokların doğruluğu teyit edilir.

---

**Not:** Bu altyapı ile sistemi 100.000 ürüne kadar hiçbir performans kaybı yaşamadan ölçekleyebiliriz. Next.js'in hızı ve Supabase'in gücü piyasadaki çoğu hazır yazılımdan üstündür.
