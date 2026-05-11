# 🚀 Vercel Env ve Deploy Rehberi

Kanka selam! Bu klasördeki `.env.local` değişkenlerini Vercel'e tek tek elle girmekten kurtulman için bu sistemi kurdum.

## 🛠️ Nasıl Kullanılır?

1.  **.env.local** dosyanın güncel olduğundan emin ol.
2.  Şu komutu çalıştır:
    ```bash
    node sync_envs.js
    ```
    *Bu komut dosyadaki tüm değişkenleri Vercel'e (Production, Preview, Dev) otomatik atar, sana soru sormaz.*

## 📦 Projeyi Nasıl Deploy Ederim?

Eğer GitHub ile uğraşmadan doğrudan buradan uçurmak istersen:
```bash
npx vercel --prod --yes
```

## ⚠️ Dikkat Edilmesi Gerekenler
- Eğer yeni bir değişken eklersen, önce `.env.local`'a yaz, sonra `node sync_envs.js` çalıştır.
- Vercel'de "Murat Kaan" hatası alırsan (Identity Blocked), şu komutla yazar bilgisini sıfırla:
  `git commit --amend --no-edit --reset-author`

*Keyifli geliştirmeler!* ✌️
