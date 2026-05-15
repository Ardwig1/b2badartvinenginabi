# Proje Durumu ve Son Güncellemeler (8 Nisan 2026)

Bu dosya, yapılan son geliştirmeleri ve projenin kritik yapılandırmalarını içermektedir.

## ✅ Son Yapılan Değişiklikler

### 1. Performans ve Yükleme Optimizasyonları
- **Sonsuz Döngü Fixi:** `app/dashboard/catalog/page.js` ve `app/admin/products/page.js` dosyalarında `filtered` ürün listesi `useMemo` kapsamına alındı. Bu sayede görsel yüklemeleri bittiğinde sayfanın sürekli baştan render olup sonsuz döngüye girmesi engellendi.
- **Görsel Ön Yükleme (Preloading):** Mobil cihazlar için görsel yükleme zaman aşımı (timeout) 2.5 saniyeden **1.5 saniye**ye düşürüldü.
- **Kullanıcı Deneyimi:** Yükleme ekranına **"Beklemeden sonuçları gör"** butonu eklendi. İnterneti yavaş olan kullanıcılar görsellerin tamamlanmasını beklemeden listeye geçebilir.
- **Loading Mesajları:** "Yükleniyor..." yerine yapılan işleme göre "Ürünler Aranıyor..." veya "Görseller Hazırlanıyor..." mesajları eklendi.

### 2. Cloudflare R2 & Banner Sorunu
- **ISP Engeli Aşımı:** Türkiye'deki servis sağlayıcıların `r2.dev` domainini engellemesi nedeniyle, `.env.local` dosyasındaki `R2_PUBLIC_URL` bilgisi `https://cdn.artpar.com` (özel domain) olarak güncellendi.
- **Veritabanı Güncellemesi:** `banners` tablosunda `r2.dev` uzantısıyla kalmış olan eski kayıtlar manuel olarak `cdn.artpar.com` adresine çekildi.
- **Vercel Konfigürasyonu:** Vercel üzerindeki `R2_PUBLIC_URL` çevre değişkeni production ortamında güncellendi.

### 3. Kimlik Doğrulama & Middleware (Auth)
- **Hakkımızda & Yasal Sayfalar:** `/hakkimizda`, `/mesafeli-satis-sozlesmesi`, `/iptal-ve-iade-kosullari` ve `/gizlilik-ve-guvenlik` sayfaları **public (açık)** hale getirildi.
- `lib/supabase/middleware.js` güncellenerek bu rotalara giriş yapmamış kullanıcıların da erişebilmesi sağlandı (Login sayfasına yönlendirme kaldırıldı).

## 🚀 Canlı Ortam Bilgileri
- **GitHub Reposu:** `b2bkaanabi`
- **Vercel Projesi:** `b2bkaanabi`

## ⚡ Performans ve Ölçekleme Standartları
- Proje 100.000+ ürün ölçeğinde tasarlandığı için `PERFORMANS_STANDARTLARI.md` dosyasındaki kurallara uymak **zorunludur**. 
- Veritabanı aramalarında mutlaka `Indexing` ve `Server-side Pagination` kullanılmalıdır.


## 💳 QNB Finansbank Sanal POS Entegrasyonu (11 Mayıs 2026 Güncellemesi)
- Proje tamamen yeni bir hesaba ve repoya taşınarak stabilize edildi.
- Mevcut proxy yapısı (`34.63.166.56`) ve XML entegrasyonu korunarak yeni ortama aktarıldı.

### Mevcut Durum ve Teknik Mimari
QNB Finansbank (Payfor) altyapısı ile Sanal POS entegrasyonu tamamlandı ve canlıya alındı.

**1. Proxy Sunucusu (Google Cloud):**
- **IP:** `34.63.166.56` (Banka tarafında tanımlı olan tek yetkili IP).
- **Çalışma Şekli:** Banka sadece bu IP'den gelen XML isteklerini kabul ettiği için Vercel üzerinden gelen talepler bu proxy üzerinden `vpos.qnbfinansbank.com/Gateway/XmlGate.aspx` adresine tünelleniyor.
- **Yönetim:** Sunucuda **PM2** ile `qnb-proxy` adıyla arka planda kesintisiz çalışıyor. SSH kapansa da aktiftir.

**2. Yapılan Geliştirmeler (Backend):**
- **Güvenli Yönlendirme:** 3D Secure formu artık proxy üzerinden değil, doğrudan bankanın resmi **HTTPS** adresi üzerinden post ediliyor. Bu sayede "Güvenli Değil" uyarısı çözüldü.
- **SHA1 Hashing:** Doküman Sayfa 8'e uygun olarak `MerchantPass` kullanılarak dinamik hash hesaplama sistemi kuruldu.
- **Akıllı Tarih Fixi:** `MMYY` formatı zorunlu hale getirildi; frontend'den ters (`YYMM`) veri gelse bile backend bunu otomatik algılayıp düzeltiyor.
- **Sıfır Boşluklu XML:** Bankanın hassas parser'ı için XML paketi tüm boşluklardan arındırıldı.
- **3DModel Geçişi:** En kararlı yapı olan 3DModel akışı seçildi.

**3. Bekleyen Sorun ve Çözüm Yolu:**
- **Hata:** `M042 - Plugin bulunamadı`.
- **Neden:** Banka tarafında terminalin "XML POST" veya "3D Model" yetkilerinin eksik tanımlanmış olması.
- **Aksiyon:** Banka aranarak terminalin 3D Model ve XML yetkilerinin IP: `34.63.166.56` için aktif edilmesi istenecek.

### Kritik Değişkenler (Vercel)
- `QNB_MERCHANT_ID`: Üye İşyeri Numarası
- `QNB_USER_CODE`: API Kullanıcı Adı
- `QNB_USER_PASS`: API Şifresi
- `QNB_MERCHANT_PASS`: 3D Güvenlik Anahtarı (btgL!...)
- `QNB_MBR_ID`: 5 (Sabit)

