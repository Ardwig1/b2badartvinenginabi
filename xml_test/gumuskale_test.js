const fs = require('fs');

async function testGumuskale() {
    const url = "https://api.gumuskale.com.tr/Uploads/5884_adartvin.xml";
    console.log("🔗 Gümüşkale XML çekiliyor...");
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        
        // İlk 500 karakteri gösterelim
        console.log("\n📄 XML Yapısı (İlk 500 Karakter):");
        console.log(text.substring(0, 500));
        
        // Basit bir Regex ile ilk ürünün adını çekelim (Kütüphanesiz test için)
        const nameMatch = text.match(/<STOK_ADI>(.*?)<\/STOK_ADI>/);
        const priceMatch = text.match(/<SATIS_FIYATI>(.*?)<\/SATIS_FIYATI>/);
        
        if (nameMatch) {
            console.log("\n✅ Test Başarılı!");
            console.log("📦 Örnek Ürün:", nameMatch[1]);
            console.log("💰 Örnek Fiyat:", priceMatch ? priceMatch[1] : "Bulunamadı");
        }
    } catch (err) {
        console.error("❌ Hata:", err.message);
    }
}

testGumuskale();
