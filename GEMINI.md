# Proje Durumu ve Son Güncellemeler (18 Mayıs 2026)

Bu dosya, yapılan son geliştirmeleri ve projenin kritik yapılandırmalarını içermektedir.

## ✅ Son Yapılan Değişiklikler

### 1. Basbug Group Mikro Servis Entegrasyonu
- **Teknik Mimari:** Basbug Group'un Mikro Servis (API) altyapısı sisteme entegre edildi. 
- **Zeki İsimlendirme:** Ürün adları otomatik olarak `[Araç Markası] [Ürün Adı] [Ek Açıklama] - [Uyumlu Modeller] ([Model Yılı])` formatında zenginleştirildi.
- **Dinamik Stok Dağılımı:** `sYol` verisi `stock_depo` kolonuna, diğer tüm yerel depo stoklarının toplamı ise `stock_merkez` kolonuna map edildi.
- **IP Engeli Çözümü:** Başbuğ'un Vercel IP'lerini engelleme ihtimaline karşı sistem **Pipedream Proxy** üzerinden tünellenerek çalışır hale getirildi.

### 2. Kur Sabitleme ve Kâr Yönetimi
- **Çift Kur Kontrolü:** Dolar (USD) ve Euro (EUR) kurları admin panelinden artık birbirinden tamamen bağımsız olarak "SABİT" veya "GÜNCEL (TCMB)" olarak yönetilebiliyor.
- **Kâr Kuralları Paneli:** Admin panelinde "Aktif Kâr Kuralları" dashboard'u oluşturuldu. Genel kâr oranına ek olarak firma bazlı (Örn: GKL: %100) özel kurallar tanımlanabilir, görüntülenebilir ve silinebilir.
- **Senkronize Silme:** Bir kâr kuralı listeden silindiğinde, o firmaya ait tüm ürünlerin kâr marjı veritabanında anında %0'a (maliyet fiyatına) çekilir.

### 3. Sipariş Bildirim Sistemi (Admin Notification)
- **Email Entegrasyonu:** `nodemailer` kullanılarak sipariş verildiğinde adminin belirlediği e-postaya bilgilendirme maili düşmesi sağlandı.
- **Yönetim Paneli:** Admin -> Sistem Ayarları kısmına bildirim e-postası tanımlama ve bildirimleri açma/kapama özelliği eklendi.
- **İçerik:** Giden mailde müşteri bilgileri, sipariş tutarı, adres, notlar ve sipariş kalemleri detaylı olarak yer alır.

### 4. Admin Panel & Ürün Düzenleme Kısıtlamaları
- **İskonto Kilidi:** Ürün düzenleme sayfasında "İskonto Oranı %" alanı, ürün "Kampanyalı Ürün" olarak işaretlenmediği sürece kilitli (inaktif) hale getirildi.
- **Marka & Logo Güncellemesi:** Login sayfası alt bilgileri temizlendi; ARTPAR ve Bilişim logoları yan yana, kurumsal bir yapıda yerleştirildi.

## 🚀 Canlı Ortam Bilgileri
- **GitHub Reposu:** `b2badartvinenginabi` (GÜNCEL)
- **Vercel Projesi:** `enginb2b` (GÜNCEL)
- **Cron Jobs:** `cron-job.org` üzerinden her sabah 06:00'da Basbug ve Gümüşkale senkronizasyonu tetiklenir.

## ⚡ Performans ve Ölçekleme Standartları
- Proje 100.000+ ürün ölçeğinde tasarlandığı için `PERFORMANS_STANDARTLARI.md` dosyasındaki kurallara uymak **zorunludur**. 
- Veritabanı aramalarında mutlaka `Indexing` ve `Server-side Pagination` kullanılmalıdır.

### Kritik Değişkenler (Vercel)
- **Basbug API:** `BASBUG_USER`, `BASBUG_PASS`, `BASBUG_SECRET`, `BASBUG_CLIENT_ID`
- **Email (SMTP):** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- **Security:** `CRON_SECRET`

