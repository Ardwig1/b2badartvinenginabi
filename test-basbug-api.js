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

        const PROXY_URL = "https://eosetsm38z4wt4h.m.pipedream.net";
        const TARGET_BRANDS = [
            "PEUGEOT", "CITROEN", "OPEL", "VOLKSWAGEN", "SKODA", 
            "AUDI", "SEAT", "FORD", "TOYOTA", "RENAULT", "FIAT"
        ];

        console.log("\n🔍 Investigating 'ListeGrubu' variations for FIAT...");
        const variations = ["FIAT", "FİAT", "Fiat", "fiat", "FIAT GRUBU", "FİAT GRUBU"];
        for (const v of variations) {
            try {
                const res = await axios.get(`${PROXY_URL}/material/StokGetir?ListeGrubu=${encodeURIComponent(v)}&FirmaAdi=BASBUG&Depo=MRK`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const count = res.data.stokListesi?.length || 0;
                console.log(`- Variation '${v}': ${count} items.`);
                if (count > 0) break;
            } catch (e) {}
        }

        console.log("\n🔍 Checking for Group List endpoint...");
        const metaEndpoints = ["ListeGruplari", "GruplariGetir", "MarkaListesi", "MarkaGetir"];
        for (const ep of metaEndpoints) {
            try {
                const res = await axios.get(`${PROXY_URL}/material/${ep}?FirmaAdi=BASBUG`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                console.log(`✅ Endpoint ${ep} found! Data:`, JSON.stringify(res.data, null, 2).substring(0, 500));
            } catch (e) {
                console.log(`❌ Endpoint ${ep} not found.`);
            }
        }

    } catch (error) {
        console.error("❌ Error:", error.response?.data || error.message);
    }
}

testBasbug();
