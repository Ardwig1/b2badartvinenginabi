const fs = require('fs');

async function convertGumuskaleFull() {
    const url = "https://api.gumuskale.com.tr/Uploads/5884_adartvin.xml";
    console.log("🔗 Gümüşkale FULL XML çekiliyor (Bu biraz zaman alabilir)...");
    
    try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder('utf-16le');
        let text = decoder.decode(buffer);
        text = text.replace(/^\uFEFF/, "");

        const parts = text.split('<item>');
        parts.shift();

        const items = [];
        console.log(`📦 Toplam ${parts.length} ürün tespit edildi. Dönüştürülüyor...`);

        for (let i = 0; i < parts.length; i++) {
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
            
            if (Object.keys(item).length > 0) items.push(item);
        }
        
        fs.writeFileSync('xml_test/gumuskale_full.json', JSON.stringify(items, null, 2));
        console.log(`\n✅ BAŞARILI! ${items.length} ürün 'xml_test/gumuskale_full.json' dosyasına kaydedildi.`);
        
    } catch (err) {
        console.error("❌ Hata:", err.message);
    }
}

convertGumuskaleFull();
