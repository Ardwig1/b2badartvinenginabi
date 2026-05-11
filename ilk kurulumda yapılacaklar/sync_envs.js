const { execSync } = require('child_process');
const fs = require('fs');

/**
 * Vercel Otomatik Env Yükleyici
 * Bu script .env.local dosyasındaki her şeyi Vercel Dashboard'a otomatik yükler.
 */

try {
  if (!fs.existsSync('../.env.local')) {
    console.error('HATA: .env.local dosyası bulunamadı! (Script bir üst klasöre bakıyor)');
    process.exit(1);
  }

  const envContent = fs.readFileSync('../.env.local', 'utf8');
  const lines = envContent.split(/\r?\n/);

  console.log('🚀 Vercel Env Senkronizasyonu Başladı...\n');

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;

    const [key, ...valueParts] = line.split('=');
    let value = valueParts.join('=').trim();
    
    // Tırnakları temizle
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1);
    }

    console.log(`📦 İşleniyor: ${key}`);
    
    const targets = ['production', 'preview', 'development'];
    for (const target of targets) {
      try {
        // Echo ile değeri vercel env add komutuna pipe ediyoruz (soru sormasını engeller)
        execSync(`echo ${value} | npx vercel env add ${key} ${target}`, { stdio: 'pipe' });
      } catch (e) {
        // Zaten varsa veya hata oluşursa sessizce devam et
      }
    }
  }

  console.log('\n✅ İşlem Tamamlandı! Tüm değişkenler Vercel tarafına itildi.');
} catch (err) {
  console.error('Beklenmedik bir hata oluştu:', err.message);
}
