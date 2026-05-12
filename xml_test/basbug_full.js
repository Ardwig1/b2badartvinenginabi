const fs = require('fs');

const authInfo = {
    "KullaniciAdi": "MS8012",
    "Parola": "6SCHUCEY1E6HB9MN",
    "ClientSecret": "W2wOU8V6w3eSWfo6sxi2CThf1g9EYmZ3",
    "ClientID": "materialApi"
};

async function fetchBasbugFull() {
    console.log("🚀 Başbuğ Group FULL Veri Çekme Başlatılıyor...");
    
    const loginUrl = "https://api.basbug.com.tr/auth/Login";
    // Not: ListeGrubu=FIAT parametresi olduğu için sadece FIAT grubunu çeker. 
    // Tüm grupları çekmek için API dokümanına göre farklı istekler gerekebilir 
    // ama biz şu an mevcut erişebildiğimiz en geniş listeyi çekiyoruz.
    const dataUrl = "https://api.basbug.com.tr/material/StokGetir?ListeGrubu=FIAT&FirmaAdi=BASBUG&Depo=MRK";

    try {
        const authRes = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(authInfo)
        });
        const authData = await authRes.json();
        if (!authRes.ok || !authData.token) throw new Error("Giriş başarısız!");

        console.log("🔑 Token alındı, veriler indiriliyor...");
        const dataRes = await fetch(dataUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${authData.token}` }
        });
        const result = await dataRes.json();

        fs.writeFileSync('xml_test/basbug_full.json', JSON.stringify(result, null, 2));
        console.log(`\n✅ BAŞARILI! Başbuğ verileri 'xml_test/basbug_full.json' dosyasına kaydedildi.`);
        
    } catch (err) {
        console.error("❌ Hata:", err.message);
    }
}

fetchBasbugFull();
