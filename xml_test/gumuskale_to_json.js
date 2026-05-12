const fs = require('fs');

async function convertGumuskaleToJson() {
    const url = "https://api.gumuskale.com.tr/Uploads/5884_adartvin.xml";
    console.log("🔗 Gümüşkale XML çekiliyor (UTF-16LE Modu)...");
    
    try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        
        // Buffer'ı UTF-16LE olarak decode et
        const decoder = new TextDecoder('utf-16le');
        let text = decoder.decode(buffer);
        
        // BOM (Byte Order Mark) temizle
        text = text.replace(/^\uFEFF/, "");

        // 1. Ayıklama: <item> etiketine göre split et
        const parts = text.split('<item>');
        parts.shift(); // <root> kısmını atla

        const items = [];
        const limit = Math.min(parts.length, 100);

        for (let i = 0; i < limit; i++) {
            const content = parts[i].split('</item>')[0];
            const item = {};
            
            const tags = ['STOK_KODU', 'STOK_ADI', 'ARAC_MARKASI', 'STOK_MARKASI', 'OEM_KODU', 'STOK_ADETI', 'SATIS_FIYATI', 'PARA_BIRIMI', 'KDV'];
            
            tags.forEach(tag => {
                const startTag = `<${tag}>`;
                const endTag = `</${tag}>`;
                if (content.includes(startTag) && content.includes(endTag)) {
                    item[tag] = content.split(startTag)[1].split(endTag)[0].trim();
                }
            });
            
            if (Object.keys(item).length > 0) {
                items.push(item);
            }
        }
        
        const output = {
            source: "Gümüşkale XML (UTF-16LE)",
            total_items_in_sample: items.length,
            items: items
        };
        
        fs.writeFileSync('xml_test/gumuskale_sample.json', JSON.stringify(output, null, 2));
        console.log("\n✅ BAŞARILI!");
        console.log(`📦 İlk ${items.length} ürün JSON'a dönüştürüldü.`);
        console.log("📄 Dosya: 'xml_test/gumuskale_sample.json'");
        
    } catch (err) {
        console.error("❌ Hata:", err.message);
    }
}

convertGumuskaleToJson();
