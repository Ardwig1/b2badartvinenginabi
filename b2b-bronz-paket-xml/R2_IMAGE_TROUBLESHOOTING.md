# Cloudflare R2 Resim Yüklenememe Sorunu ve Çözümü (ISP Engeli)

## Problem
Cloudflare R2 bucket'ları varsayılan olarak `pub-xxx.r2.dev` şeklinde bir adres verir. Türkiye'deki bazı internet servis sağlayıcıları (Türk Telekom, Turkcell Superonline vb.) bu `r2.dev` adreslerini veya alt alan adlarını güvenlik/regülasyon sebebiyle engelleyebiliyor veya yavaşlatabiliyor. Bu durum resimlerin bazı müşterilerde açılıp bazılarında açılmamasına neden olur.

## Çözüm (Custom Domain Yöntemi)

Bu sorunu kökten çözmek için resimleri Cloudflare'in geçici adresi yerine firmanın kendi domaini üzerinden servis etmek gerekir.

### 1. Alan Adını Cloudflare'a Bağlama
- Alan adının DNS yönetimi Cloudflare'da olmalıdır.
- Eğer değilse, domain panelinden (Natro, GoDaddy vb.) Nameserver (NS) adresleri Cloudflare'a yönlendirilmelidir.

### 2. R2 Bucket'a Custom Domain Ekleme
- Cloudflare Panel -> **R2** -> **Buckets** -> İlgili Bucket'ı seç.
- **Settings** sekmesine git.
- **Custom Domains** başlığı altında **"+ Add"** butonuna bas.
- Örn: `cdn.firmadomain.com` yazıp ekle. Cloudflare DNS kayıtlarını otomatik oluşturacaktır.
- Durumun **"Active"** olmasını bekle.

### 3. CORS Ayarları (Erişim İzni)
- Aynı ekranda en altta **CORS Policy** kısmına gel.
- "Edit" diyerek şu JSON kodunu yapıştır:
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD", "OPTIONS"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

### 4. Yazılım Tarafındaki Güncelleme
- `.env` dosyasındaki veya config içindeki `R2_PUBLIC_URL` bilgisini yeni domain (`https://cdn.firmadomain.com`) ile değiştir.
- `next.config.mjs` içinde `images.remotePatterns` kısmına yeni domaini ekle.

### 5. Veritabanı Güncelleme (SQL)
Eski resim linklerini topluca yeni domaine geçirmek için şu SQL'i çalıştır:
```sql
UPDATE products 
SET image_url = REPLACE(image_url, 'https://eski-r2-adresi.r2.dev', 'https://cdn.firmadomain.com');

UPDATE banners 
SET image_url = REPLACE(image_url, 'https://eski-r2-adresi.r2.dev', 'https://cdn.firmadomain.com');
```

---
*Bu doküman, gelecekteki kurulumlarda referans olması için Gemini CLI tarafından oluşturulmuştur.*
