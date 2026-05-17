const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

async function testGumuskaleReal() {
    const XML_URL = "https://api.gumuskale.com.tr/Uploads/5884_adartvin.xml";
    
    try {
        console.log("📥 Fetching real Gumuskale XML data...");
        const response = await axios.get(XML_URL, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 30000,
            responseType: 'arraybuffer'
        });

        let xmlData = Buffer.from(response.data).toString('utf16le');
        if (!xmlData.includes('<root>')) xmlData = Buffer.from(response.data).toString('utf8');
        xmlData = xmlData.replace(/^\uFEFF/, '');

        console.log("🧩 Analyzing all items for stock patterns...");
        const rawItems = xmlData.split(/<item\s*>/i).slice(1);
        const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: true, trimValues: true });
        
        const stockStatusMap = new Map();
        const examples = [];
        
        for (let rawItem of rawItems) {
            const itemXml = `<item>${rawItem.split('</item>')[0]}</item>`;
            const parsed = parser.parse(itemXml);
            const item = parsed.item;
            
            if (item) {
                const status = String(item.STOK_DURUMU || 'N/A');
                const quantity = item.STOK_ADETI;
                
                // Benzersiz durumları topla
                if (!stockStatusMap.has(status)) {
                    stockStatusMap.set(status, { count: 0, minQty: quantity, maxQty: quantity });
                    // Her yeni durum için bir örnek sakla
                    examples.push(item);
                }
                
                const stats = stockStatusMap.get(status);
                stats.count++;
                if (quantity < stats.minQty) stats.minQty = quantity;
                if (quantity > stats.maxQty) stats.maxQty = quantity;
            }
        }
        
        console.log("\n📊 Stock Status Distribution:");
        stockStatusMap.forEach((stats, status) => {
            console.log(`- ${status.padEnd(15)}: ${stats.count} items (Qty Range: ${stats.minQty} to ${stats.maxQty})`);
        });

        console.log("\n📦 Examples for each Status:");
        examples.forEach(item => {
            console.log(`--- Status: ${item.STOK_DURUMU} | Qty: ${item.STOK_ADETI} ---`);
            console.log(`Code: ${item.STOK_KODU} | Name: ${item.STOK_ADI.substring(0, 50)}...`);
        });

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

testGumuskaleReal();
