const fs = require('fs');

const authInfo = {
    "KullaniciAdi": "MS8012",
    "Parola": "6SCHUCEY1E6HB9MN",
    "ClientSecret": "W2wOU8V6w3eSWfo6sxi2CThf1g9EYmZ3",
    "ClientID": "materialApi"
};

// Engin Abi'den alacağın veya API'den çekeceğin tüm gruplar
const tumGruplar = ["FIAT", "FORD", "RENAULT", "BMW", "MERCEDES", "VOLKSWAGEN", "AUDI", "OPEL", "PEUGEOT", "TOYOTA"];

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchEverything() {
    console.log("🚀 Başbuğ Group TÜM ÜRÜNLER Çekiliyor...");
    
    // 1. Token Al
    const loginRes = await fetch("https://api.basbug.com.tr/auth/Login", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authInfo)
    });
    const { token } = await loginRes.json();

    const masterList = [];

    for (const grup of tumGruplar) {
        console.log(`📦 ${grup} grubu çekiliyor...`);
        
        try {
            const res = await fetch(`https://api.basbug.com.tr/material/StokGetir?ListeGrubu=${grup}&FirmaAdi=BASBUG&Depo=MRK`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data && data.stokListesi) {
                masterList.push(...data.stokListesi);
                console.log(`✅ ${grup} eklendi (${data.stokListesi.length} ürün)`);
            }

            // ⚠️ KRİTİK: Dakikada 10 istek limitine takılmamak için 6.5 saniye bekle
            console.log("⏳ Limit koruması için bekleniyor...");
            await sleep(6500);

        } catch (err) {
            console.error(`❌ ${grup} çekilemedi:`, err.message);
        }
    }

    fs.writeFileSync('xml_test/basbug_ALL_PRODUCTS.json', JSON.stringify(masterList, null, 2));
    console.log(`\n🏁 İŞLEM TAMAMLANDI! Toplam ${masterList.length} ürün kaydedildi.`);
}

fetchEverything();
