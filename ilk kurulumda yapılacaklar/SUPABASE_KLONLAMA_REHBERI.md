# 🛡️ Supabase Proje Klonlama Rehberi

Bu döküman, mevcut bir müşterinin (Master Proje) Supabase altyapısını birebir yeni bir müşteriye nasıl aktaracağınızı anlatır.

## 📦 Hazırlık
Yeni bir müşteriye geçerken elinizde şu iki ana dosya olmalıdır (Bu klasörde yer almaktadır):
1.  **`COMPLETE_CLONE.sql`**: Tüm tablo yapılarını, verileri, fonksiyonları ve RLS politikalarını içeren ana dosya.
2.  **`RESTORE_PERMISSIONS.sql`**: Veritabanı yetkilerini onaran yardımcı dosya.

---

## 🚀 Adım Adım Kurulum

### 1. Yeni Supabase Projesi Açın
*   [Supabase](https://supabase.com) üzerinden yeni bir organizasyon ve proje oluşturun.
*   Veritabanı şifresini güvenli bir yere not edin.

### 2. Yapıyı ve Verileri Aktarın
*   Yeni projenin panelinde sol menüden **"SQL Editor"** kısmına gidin.
*   **`COMPLETE_CLONE.sql`** dosyasının içeriğini kopyalayıp buraya yapıştırın.
*   **"Run"** butonuna basın. 
    *   *Bu işlem tüm tabloları silecek, yeniden oluşturacak ve verileri (kullanıcılar dahil) yükleyecektir.*

### 3. Yetkileri Tanımlayın (KRİTİK)
*   SQL Editor'da yeni bir sorgu penceresi açın.
*   **`RESTORE_PERMISSIONS.sql`** dosyasının içeriğini yapıştırın ve **"Run"** deyin.
    *   *Bu adım, uygulamanın verilere erişebilmesi için gerekli olan "Grant" izinlerini tanımlar.*

### 4. Sayaçları (Sequences) Kontrol Edin
*   Eğer sipariş oluştururken "sequence does not exist" hatası alırsanız, SQL Editor'da şu komutu çalıştırın:
    ```sql
    CREATE SEQUENCE IF NOT EXISTS public.document_no_seq START WITH 1;
    GRANT ALL ON SEQUENCE public.document_no_seq TO postgres, anon, authenticated, service_role;
    ```

### 5. Kimlik Doğrulama Ayarları
*   Supabase panelinde **Authentication -> URL Configuration** kısmına gidin.
*   **Site URL** bilgisini yeni müşterinin canlı domaini (`https://b2b.yeni-musteri.com`) ile güncelleyin.

---

## ⚠️ Dikkat Edilmesi Gerekenler
*   **Test Verileri:** Klonlama işlemi eski müşterinin kullanıcılarını ve siparişlerini de getirir. Teslimattan önce `auth.users`, `public.orders` ve `public.companies` tablolarını temizlemeyi unutmayın.
*   **.env Güncellemesi:** Vercel veya yerel ortamdaki `NEXT_PUBLIC_SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` bilgilerini mutlaka yeni projeninkilerle değiştirin.
*   **Generated Columns:** Eğer PostgreSQL "cannot insert into generated column" hatası verirse, kullandığınız SQL dosyasının **V4 veya üzeri** olduğundan emin olun (bu sürümde bu sütunlar otomatik ayıklanmıştır).

---
*Hazırlayan: Gemini CLI ✌️*
