const axios = require('axios');

async function testBasbug() {
    const authData = {
        "KullaniciAdi": "MS8012",
        "Parola": "6SCHUCEY1E6HB9MN",
        "ClientSecret": "W2wOU8V6w3eSWfo6sxi2CThf1g9EYmZ3",
        "ClientID": "materialApi"
    };

    try {
        console.log("🔐 Getting Token...");
        const loginResponse = await axios.post('https://api.basbug.com.tr/auth/Login', authData);
        const token = loginResponse.data.token;
        console.log("✅ Token received.");

        console.log("📥 Fetching FiyatGetir (FIAT)...");
        try {
            const fiyatResponse = await axios.get('https://api.basbug.com.tr/material/FiyatGetir?ListeGrubu=FIAT&FirmaAdi=BASBUG', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log("💰 FiyatGetir Response Preview:");
            console.log(JSON.stringify(fiyatResponse.data.fiyatListesi?.[0] || fiyatResponse.data[0], null, 2));
        } catch (e) {
            console.log("❌ FiyatGetir failed.");
        }

        console.log("\n📥 Fetching another MalzemeAra (Item: 1606333280)...");
        try {
            const malz2 = await axios.get('https://api.basbug.com.tr/material/MalzemeAra?MalzemeNo=1606333280&FirmaAdi=BASBUG', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log("📦 Item 2 Preview:");
            console.log(JSON.stringify(malz2.data, null, 2));
        } catch (e) { console.log("❌ Item 2 failed."); }

        console.log("\n📥 Fetching RENAULT Stock Preview...");
        try {
            const renResponse = await axios.get('https://api.basbug.com.tr/material/StokGetir?ListeGrubu=RENAULT&FirmaAdi=BASBUG&Depo=MRK', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log("📦 RENAULT First Item:");
            console.log(JSON.stringify(renResponse.data.stokListesi?.[0], null, 2));
            
            if (renResponse.data.stokListesi?.[0]?.no) {
                const renDetail = await axios.get(`https://api.basbug.com.tr/material/MalzemeAra?MalzemeNo=${renResponse.data.stokListesi[0].no}&FirmaAdi=BASBUG`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                console.log("📦 RENAULT Detail Preview:");
                console.log(JSON.stringify(renDetail.data, null, 2));
            }
        } catch (e) { console.log("❌ RENAULT failed."); }

        console.log("\n🔍 Searching for an item with STOCK > 2 in Basbug...");
        try {
            // Farklı markaları deneyerek yüksek stoklu ürün bulmaya çalışalım
            const brandsToTry = ["FIAT", "RENAULT", "FORD", "VOLKSWAGEN"];
            let foundHighStock = false;

            for (const brand of brandsToTry) {
                if (foundHighStock) break;
                console.log(`📡 Checking brand: ${brand}...`);
                
                const stockRes = await axios.get(`https://api.basbug.com.tr/material/StokGetir?ListeGrubu=${brand}&FirmaAdi=BASBUG&Depo=MRK`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const stockItems = stockRes.data.stokListesi || [];
                
                // Toplam stoğu 2'den fazla olanı bul
                const highStockItem = stockItems.find(s => (s.stok + s.sYol + s.sFarkliDepo) > 2);

                if (highStockItem) {
                    console.log(`✅ Found item in ${brand}! Fetching details for ${highStockItem.no}...`);
                    const detail = await axios.get(`https://api.basbug.com.tr/material/MalzemeAra?MalzemeNo=${encodeURIComponent(highStockItem.no)}&FirmaAdi=BASBUG`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    const d = detail.data;
                    const total = (d.sMrk || 0) + (d.sIzm || 0) + (d.sAnk || 0) + (d.sAdn || 0) + (d.sErz || 0);
                    
                    if (total > 2 || d.sYol > 2) {
                        console.log("📦 HIGH STOCK Data Preview:");
                        console.log(JSON.stringify({
                            no: d.no,
                            ac: d.ac,
                            sMrk: d.sMrk,
                            sIzm: d.sIzm,
                            sAnk: d.sAnk,
                            sAdn: d.sAdn,
                            sErz: d.sErz,
                            sYol: d.sYol,
                            TOTAL_LOCAL: total
                        }, null, 2));
                        foundHighStock = true;
                    }
                }
            }

            if (!foundHighStock) {
                console.log("❌ Could not find an item with stock > 2 in tested brands.");
            }
        } catch (e) {
            console.log("❌ High stock search failed:", e.message);
        }

    } catch (error) {
        console.error("❌ Error:", error.response?.data || error.message);
    }
}

testBasbug();
