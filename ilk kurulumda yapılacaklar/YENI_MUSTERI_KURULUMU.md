# 🚀 Yeni Müşteri Kurulum ve Devre Alma Rehberi

Bu döküman, mevcut B2B platformunun yeni bir müşteriye (örneğin Engin Abi, Kaan Abi vb.) kurulurken değiştirilmesi gereken tüm kritik noktaları içerir. Her müşteri tamamen bağımsız (izole) bir altyapıya sahip olmalıdır.

## 1. Veritabanı ve Kimlik Doğrulama (Supabase)
Her müşterinin verisi kendine özel olmalıdır.
*   **Yeni Proje:** [Supabase](https://supabase.com) üzerinden yeni bir proje açılmalı.
*   **Tablo Yapısı:** Mevcut projedeki SQL şemaları (tables, functions, RLS policies) yeni projeye "SQL Editor" üzerinden basılmalı.
*   **.env.local Güncellemesi:**
    *   `NEXT_PUBLIC_SUPABASE_URL`
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    *   `SUPABASE_SERVICE_ROLE_KEY` (Sadece backend işlemleri için)

## 2. Ödeme Sistemleri (Sanal POS)
Para doğrudan müşterinin kendi banka hesabına yatmalıdır.
*   **QNB Finansbank:** Bankadan alınan API ve Terminal bilgileri güncellenmeli:
    *   `QNB_MERCHANT_ID`, `QNB_TERMINAL_ID`, `QNB_USER_CODE`, `QNB_USER_PASS`, `QNB_MERCHANT_PASS`
*   **Tosla:** Yeni Tosla işyeri hesabı bilgileri:
    *   `TOSLA_CLIENT_ID`, `TOSLA_API_USER`, `TOSLA_API_PASS`

## 3. Görsel ve Dosya Depolama (Cloudflare R2)
Ürün resimleri ve logoların karışmaması için ayrı bir alan gerekir.
*   **Yeni Bucket:** Cloudflare üzerinde yeni bir R2 Bucket açılmalı.
*   **CORS Ayarı:** Bucket'ın CORS ayarları yeni domaini kapsayacak şekilde düzenlenmeli.
*   **.env.local Güncellemesi:**
    *   `R2_BUCKET_NAME`
    *   `R2_PUBLIC_URL` (Mümkünse `cdn.musteri-domain.com` şeklinde özel domain kullanılmalı).
    *   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`

## 4. Kurumsal Kimlik ve Arayüz
Sitede eski müşterinin izi kalmamalıdır.
*   **Logolar:** `public/` klasöründeki şu dosyalar yeni müşterinin logolarıyla (aynı isimlerde) değiştirilmeli:
    *   `logo.png`, `pwa-icon.png`, `favicon.ico`
*   **İletişim ve Banka:** Şu dosyalar yeni müşterinin bilgilerine göre düzenlenmeli:
    *   `app/dashboard/contact/page.js` (E-posta, Tel, Adres)
    *   `app/dashboard/bank-accounts/page.js` (Banka IBAN'ları)

## 5. Domain ve Site Ayarları
*   **Vercel:** Site yeni bir domaine (`b2b.musteri.com`) bağlanmalı.
*   **NEXT_PUBLIC_SITE_URL:** Canlıdaki domain adresi girilmeli.

## 6. Senkronizasyon
Değişiklikleri yaptıktan sonra şu adımları unutma:
1.  `node sync_envs.js` (Yeni değişkenleri Vercel'e basar).
2.  `npx vercel --prod --yes` (Siteyi canlıya alır).

---
*Hazırlayan: Gemini CLI & Mustafa Yağız Ünal* ✌️
