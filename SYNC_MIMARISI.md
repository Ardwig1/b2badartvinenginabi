# B2B Yedek Parça — Sync Mimarisi ve Çalışma Mantığı

## Genel Mimari

- **Platform:** Next.js + Supabase + Vercel (Hobby)
- **Zamanlama:** GitHub Actions (Vercel cron ve cron-job.org kaldırıldı)
- **İki tedarikçi:** Gümüşkale (XML) + Basbug Group (REST API)

---

## 1. Gümüşkale XML Entegrasyonu

### Kaynak
- XML: Gümüşkale tedarikçisinden alınan link
- Ürün sayısı: ~9,337
- Kod formatı: `GKL` ile başlar (örn: `GKL290980`)

### Dosyalar
| Dosya | Açıklama |
|---|---|
| `lib/xml_sync_engin.js` | Ana sync motoru |
| `sync_gumuskale_local.js` | GitHub Actions wrapper |
| `.github/workflows/sync-xml.yml` | Her gece 23:00 TR tetiklenir |

### Çalışma Mantığı
1. XML URL'den veriyi indir
2. fast-xml-parser ile parse et
3. Fiyat marjını `price_groups` tablosundan oku
4. Tüm ürünleri `products` tablosuna upsert et (`onConflict: code`)
5. **Cleanup:** DB'deki `GKL%` kodlarından XML'de olmayanları sil
   - ⚠️ KRİTİK: Sadece `GKL` prefix'li kodları sil, Basbug ürünlerine dokunma!

### Lokal Test
```bash
node sync_gumuskale_local.js
```

---

## 2. Basbug Group API Entegrasyonu

### API Bilgileri
- Base URL: `https://api.basbug.com.tr`
- Auth: Bearer token (~3-4 dakikada expire, script her 100 batch'te yeniler)
- Credentials: `.env` veya script içindeki fallback değerler

### Marka Grupları
`FORD`, `PSA`, `OPEL`, `VW`, `RENAULT`, `FIAT`, `JAPON` (Toyota)

### API Endpoint'leri
| Endpoint | Kullanım |
|---|---|
| `/auth/Login` | Token alma |
| `/material/FiyatGetir?ListeGrubu=X&FirmaAdi=BASBUG&Depo=MRK` | Fiyat listesi |
| `/material/StokGetir?ListeGrubu=X&FirmaAdi=BASBUG&Depo=MRK` | Stok listesi |
| `/material/MalzemeAra?MalzemeNo=X&FirmaAdi=BASBUG` | Ürün detayı |

### Stok Mantığı
- `StokGetir` → `stok` alanı 0 veya 1 (gerçek adet değil, var/yok bayrağı)
- Sadece **merkez stoklu** (`stok > 0`) ürünler alınır (~48,676 ürün)
- DB'ye yazılır: `stock_merkez = 100`, `stock_depo = 0`, `stock_quantity = 100` (hepsi sabit)

### Fiyat Alanları
- `nf` = net fiyat → `cost_price`
- `list_price = nf × (1 + kar_marjı / 100)`
- `dc` = para birimi (TL veya EUR, ürüne göre değişir)

### Brand Mapping Kuralları
| `uk` (API) | `brand` (görünen marka) | `supplier_brand` (gizli) |
|---|---|---|
| `BSG` | `ARTPAR` | `BSG` |
| `BOEM` | `LOGOSUZ OEM` | `BOEM` |
| `IOE PSA` gibi | `OEM PSA` | `IOE PSA` |
| `OE-FD` gibi | `ORİJİNAL FD` | `OE-FD` |
| Diğerleri | `uk` değeri | `uk` değeri |

### Hariç Tutulan Markalar
```
AKZONOBEL-D, AXALTA-D, BARUM-D, BASFORD, BMTS, BRIGESTONE-D, CASTROL-D,
COJALI, CONTI TURBO, CONTINENTAL-D, DE-GA, ERC, FLEETGUARD, FMY, FRENLAS,
GOODYEAR-D, HDK, IHI, IMP, INCI, IOF, JBU678, KNK, KORMORAN-D, LASSA-D,
KNORR BREMSE, LUKOIL-D, MATADOR-D, MICHELIN-D, NRX, POLISAN-D, PPG-D,
PRESSAN, ROMBAT, SANKE, SBK, SEIW, SHELL, STABILUS, SOFIMA, STANADYNE,
STARLAS, TAMA, TCIC, TIMKEN, TIRSAN, TM, TOTAL-D, TRW, TUNAP-D,
WILDCAT, WURTH-D, ZF
```

### Dosyalar
| Dosya | Açıklama |
|---|---|
| `sync_basbug_local.js` | İlk yükleme scripti (bir kerelik çalıştırılır) |
| `sync_basbug_diff.js` | Günlük diff sync |
| `lib/xml_sync_basbug.js` | Sync motoru (Vercel endpoint için) |
| `.github/workflows/sync-basbug-diff.yml` | Her gece 06:00 TR tetiklenir |

### İlk Yükleme (Bir Kerelik)
```bash
node sync_basbug_local.js          # ~48K ürün, ~20 dakika
node sync_basbug_local.js --retry  # Başarısız olanları tekrar dene
```
Başarısız ürünler `basbug_failed.json`'a kaydedilir. `--retry` dosyayı günceller, başarılıları siler.

### Günlük Diff Sync Mantığı
1. FiyatGetir + StokGetir tüm gruplar paralel çekilir
2. DB'deki tüm ürünler okunur
3. Basbug kodları karşılaştırılır:
   - `cost_price` değişmişse → fiyat güncelle
   - Stok durumu değişmişse → aktif/pasif güncelle
4. Yeni ürün eklenmez, silinmez — sadece mevcut güncellenir

---

## 3. Products Tablosu Mapping

| DB Sütunu | Gümüşkale | Basbug |
|---|---|---|
| `code` | XML kodu | `no` |
| `name` | XML adı | `ac + ac2 - m mo (y)` |
| `brand` | XML markası | `mapBrand(uk)` |
| `supplier_brand` | XML tedarikçi | `uk` (ham değer, gizli) |
| `car_brand` | XML araç markası | `lgk` |
| `car_model` | — | `m` |
| `oem_no` | XML OEM | `oe` |
| `cost_price` | XML fiyatı | `nf` |
| `list_price` | maliyet × marj | `nf × (1 + marj%)` |
| `currency` | TL | `dc` (TL veya EUR) |
| `box_quantity` | — | `k` |
| `stock_merkez` | XML stok | `100` (sabit) |
| `stock_depo` | — | `0` (sabit) |
| `stock_quantity` | XML stok | `100` (sabit) |

---

## 4. GitHub Actions Zamanlaması

```
.github/workflows/
├── sync-xml.yml            → Gümüşkale, her gece 23:00 TR (20:00 UTC)
└── sync-basbug-diff.yml    → Basbug diff, her gece 06:00 TR (03:00 UTC)
```

### Manuel Tetikleme
GitHub → repo → **Actions** sekmesi → workflow seç → **Run workflow**

### Run Geçmişini Görme
GitHub → Actions → sol menüden workflow adına tıkla → her run'ın tarihi + logları

### GitHub Secrets (ayarlanmış olmalı)
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BASBUG_USER`, `BASBUG_PASS`, `BASBUG_SECRET`, `BASBUG_CLIENT_ID`
- (Script'lerde fallback değerler var, secret olmasa da çalışır)

---

## 5. Kritik Notlar

- **Gümüşkale cleanup sadece GKL kodlarını siler** — diğer tedarikçilere dokunmaz
- **Basbug token ~3-4 dakikada expire** — script her 100 batch'te yeniler
- **Basbug paralel istek:** 50 paralel güvenli, 200 çalışır, 500+ timeout
- **Vercel cron'lar kaldırıldı** — `vercel.json` boş `{}`
- **Cron-job.org kaldırıldı** — GitHub Actions kullanılıyor
- **Basbug diff sync yeni ürün eklemez** — sadece fiyat ve stok günceller
- **HTTP 601 hatası** — Basbug'da o kod bulunamıyor, kalıcı hata, tekrar denemeye gerek yok
