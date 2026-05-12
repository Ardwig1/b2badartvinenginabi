const fs = require('fs');

// Başbuğ Group API Kimlik Bilgileri
const authInfo = {
    "KullaniciAdi": "MS8012",
    "Parola": "6SCHUCEY1E6HB9MN",
    "ClientSecret": "W2wOU8V6w3eSWfo6sxi2CThf1g9EYmZ3",
    "ClientID": "materialApi"
};

async function testBasbugAPI() {
    console.log("🚀 Başbuğ Group API Testi Başlatılıyor...");
    
    const loginUrl = "https://api.basbug.com.tr/auth/Login";
    const dataUrl = "https://api.basbug.com.tr/material/StokGetir?ListeGrubu=FIAT&FirmaAdi=BASBUG&Depo=MRK";

    try {
        // 1. ADIM: Login ve Token Alma
        console.log("🔑 Giriş yapılıyor (Token alınıyor)...");
        const authResponse = await fetch(loginUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(authInfo)
        });

        const authData = await authResponse.json();
        
        if (!authResponse.ok || !authData.token) {
            console.error("❌ Giriş Başarısız!", authData);
            return;
        }

        const token = authData.token;
        console.log("✅ Token Alındı:", token.substring(0, 15) + "...");

        // 2. ADIM: Veri Çekme (Stok Getir)
        console.log("📦 Veri çekiliyor (StokGetir)...");
        const dataResponse = await fetch(dataUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await dataResponse.json();

        if (!dataResponse.ok) {
            console.error("❌ Veri Çekme Başarısız!", result);
            return;
        }

        console.log("\n✅ BAŞARILI! Gelen veriden örnek (İlk 2 kayıt):");
        console.log(JSON.stringify(Array.isArray(result) ? result.slice(0, 2) : result, null, 2));

        // 3. ADIM: Dosyaya Kaydet (İncelemek için)
        fs.writeFileSync('xml_test/basbug_sample.json', JSON.stringify(result, null, 2));
        console.log("\n📄 Tüm veri 'xml_test/basbug_sample.json' dosyasına kaydedildi.");

    } catch (err) {
        console.error("❌ Beklenmedik Hata:", err.message);
    }
}

testBasbugAPI();
