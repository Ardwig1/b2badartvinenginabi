# QNB Finansbank Sanal POS Entegrasyon Rehberi (3DPay)

Bu belge, B2B projesi için QNB Finansbank Sanal POS entegrasyonunun (3DPay modeli) uçtan uca nasıl kurgulandığını, yapılandırıldığını ve çalıştığını açıklamaktadır. Herhangi bir sorun anında sistemi hızlıca onarmak veya yeniden kurmak için kullanılabilir.

## 1. Mimari ve Çalışma Mantığı

QNB Finansbank, güvenlik sebebiyle API isteklerinin yalnızca sisteme kayıtlı olan sabit bir IP adresinden (`34.63.166.56`) gelmesini zorunlu tutmaktadır. Vercel gibi platformların dinamik IP havuzları olduğundan, araya bir **Proxy Sunucusu** eklenmiştir.

**Sistem Akışı:**
1. **Frontend (Kullanıcı):** Kredi kartı ve ödeme bilgilerini girer.
2. **Next.js API (Backend):** 3DPay için gerekli Hash değerini hesaplar ve işlem paketini (XML) oluşturur.
3. **GCP Proxy Sunucusu:** Next.js'den gelen bu isteği alır ve kendi sabit IP'si üzerinden bankanın `vpos.qnb.com.tr` adresine yönlendirir.
4. **Banka Yanıtı:** Banka, proxy aracılığıyla Next.js API'sine kullanıcının SMS gireceği 3D Secure yönlendirme sayfasının HTML formunu döner.
5. **Next.js API:** Gelen HTML formundaki yönlendirme adresini (Action URL) ayıklar ve temiz bir HTML form olarak frontend'e iletir.
6. **Frontend (Yönlendirme):** Gelen formu ekrana (DOM) basar ve otomatik olarak `submit()` eder. Kullanıcı bankanın SMS sayfasına gider.
7. **Banka Callback:** SMS doğrulandıktan ve paranın çekimi tamamlandıktan sonra banka sistemi, kullanıcının sonucunu (Başarılı/Başarısız) projemizdeki `callback` adresine POST eder.

---

## 2. Proxy Sunucusu (Sabit IP - 34.63.166.56)

Proxy sunucusu, gelen istekleri hiçbir şekilde değiştirmeden (yalnızca header ve body'i olduğu gibi alarak) QNB Finansbank'a iletir.

### Proxy Kurulum Kodu (`server.js`)
Sunucuda `server.js` dosyasını oluşturmak veya güncellemek için terminalde şu komut dizisi kullanılır:

```bash
cat << 'EOF' > server.js
const http = require('http');
const https = require('https');
const qs = require('querystring');

const QNB_HOST = 'vpos.qnb.com.tr';
const QNB_PATH = '/Gateway/XMLGate.aspx';

const server = http.createServer((req, res) => {
    // 1. Sağlık Kontrolü Rotası
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            status: 'ok',
            server: 'B2B QNB Proxy',
            target: `https://${QNB_HOST}${QNB_PATH}`
        }));
    }

    // 2. Sadece /vpos/ ile başlayan istekleri bankaya yönlendir
    if (req.url.startsWith('/vpos/')) {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            // Vercel zaten prmstr=... veya saf XML olarak gönderiyor, burada tekrar sarmalamıyoruz.
            const options = {
                hostname: QNB_HOST,
                port: 443,
                path: QNB_PATH,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(body),
                    'User-Agent': 'Mozilla/5.0'
                }
            };

            const proxyReq = https.request(options, proxyRes => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', e => {
                res.writeHead(500);
                res.end('Proxy Error: ' + e.message);
            });

            proxyReq.write(body);
            proxyReq.end();
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(80, '0.0.0.0', () => {
    console.log('Proxy server running on port 80');
});
EOF
```

### Proxy'yi Başlatma / Yeniden Başlatma
Sunucudaki değişiklikleri uygulamak ve kodun aktif olmasını sağlamak için kullanılan komut:

```bash
sudo pm2 restart all
```

---

## 3. Next.js Backend (Init & Callback)

Ödeme işlemini başlatan, şifreleyen ve bankadan gelen HTML yanıtı filtreleyip frontend'e ileten katmandır.

### Başlatma Adımı: `app/api/payment/qnb/init/route.js`
**Önemli Noktalar:**
- Güvenlik modeli olarak **`3DPay`** kullanılmıştır (`<SecureType>3DPay</SecureType>`).
- Hash hesaplaması: `MBR_ID + orderId + formattedAmount + okUrl + failUrl + TxnType + InstallmentCount(0) + rnd + MERCHANT_PASS` şeklinde sha1-base64 ile yapılır.
- Bankadan dönen yanıt içerisindeki asıl yönlendirme adresi (MPI Service URL) regex (`frm.action`) ile ayıklanarak forma entegre edilir. Böylece React tabanlı yönlendirmelerde sorun yaşanmaz.

### Dönüş Adımı: `app/api/payment/qnb/callback/route.js`
**Önemli Noktalar:**
- Banka SMS onayından sonra sonucu `x-www-form-urlencoded` formatında POST eder.
- `ResultCode === '00'` veya `ProcReturnCode === '00'` koşulu sağlanırsa işlem **Başarılı** kabul edilir.
- İşlem başarılı olduğunda; 
  1. İlgili `companyId (cid)` üzerinden firmanın cari bakiyesi güncellenir.
  2. `account_transactions` tablosuna Kredi Kartı ödemesi olarak dekont kaydı düşülür.
  3. `user_activities` tablosuna aktivite kaydedilir.
- Son olarak kullanıcı `/dashboard/payment/result` sayfasına yönlendirilir.

---

## 4. Next.js Frontend

Kullanıcının kredi kartı bilgilerini girdiği ve güvenli ödeme sayfasına gönderildiği önyüzdür.

### Ödeme Sayfası: `app/dashboard/payment/page.js`
**Önemli Noktalar:**
- Müşteri bilgileri girildikten sonra, veriler `/api/payment/qnb/init` adresine POST edilir.
- API'den dönen yanıt (bankanın 3D HTML formu) React DOM'u içerisine hayali bir kapsayıcı (`div`) ile yerleştirilir.
- Eklenen `<form>` elementi javascript ile otomatik olarak `submit()` edilir. 

**Kod Parçacığı (Form Submit Algoritması):**
```javascript
useEffect(() => {
    if (qnbData?.html) {
        // Bankadan gelen HTML formunu sanal bir element oluşturarak DOM'a ekliyoruz
        const container = document.createElement('div');
        container.innerHTML = qnbData.html;
        document.body.appendChild(container);
        
        // Formu seç ve otomatik submit et
        const form = container.querySelector('form');
        if (form) form.submit();
    }
}, [qnbData]);
```

## 5. Sorun Giderme (Troubleshooting)
1. **"Sisteme ulaşarak kart sms doğrulaması girilmemiş gözükmektedir" hatası:**
   Eğer banka panelinde bu hata görünürse, yönlendirme formundaki (`route.js`) HTML Regex ayrıştırması çalışmıyor veya frontend'deki `form.submit()` engelleniyordur.
2. **Kullanıcı Doğrulama (Auth) Hatası (V036 vb.):**
   Kullanıcı Adı, Şifre veya Terminal Numarası yanlıştır. Projedeki `USER_PASS` büyük/küçük harf duyarlıdır (örn. `QHrU` içermesi gerekir).
3. **Proxy Timeout veya Erişim Reddi:**
   Vercel'den Proxy'ye giden isteklerde sorun varsa `sudo pm2 logs` komutu ile proxy sunucusunun logları incelenmelidir. Bankanın IP sınırlandırması yalnızca Proxy sunucusunu (`34.63.166.56`) kapsar.
