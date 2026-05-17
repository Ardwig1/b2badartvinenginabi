const { XMLParser } = require('fast-xml-parser');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

/**
 * Engin Abi - Gumuskale XML Sync Script (v2 - Robust Parsing)
 */

async function syncGumuskaleXml() {
    console.log("🚀 Starting XML Sync for Engin Abi...");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const XML_URL = "https://api.gumuskale.com.tr/Uploads/5884_adartvin.xml";

    try {
        // 1. Fetch Global Settings & Rules
        console.log("⚙️ Fetching Pricing Rules...");
        const { data: marginSettings } = await supabase.from('price_groups').select('*').eq('name', 'GLOBAL_PROFIT_MARGIN').single();
        const globalMargin = Number(marginSettings?.discount_percent || 0);
        const pricingRules = marginSettings?.rules || {};

        console.log("📥 Fetching XML data...");
        const response = await axios.get(XML_URL, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 60000,
            responseType: 'arraybuffer'
        });

        let xmlData = Buffer.from(response.data).toString('utf16le');
        if (!xmlData.includes('<root>')) xmlData = Buffer.from(response.data).toString('utf8');
        xmlData = xmlData.replace(/^\uFEFF/, '');

        console.log("🧩 Splitting XML items...");
        const rawItems = xmlData.split(/<item\s*>/i).slice(1); 
        console.log(`📦 Found ${rawItems.length} potential products.`);

        const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: true, trimValues: true });
        const xmlProductCodes = [];
        const productsToUpsert = [];

        for (let rawItem of rawItems) {
            const itemXml = `<item>${rawItem.split('</item>')[0]}</item>`;
            const parsed = parser.parse(itemXml);
            const item = parsed.item;

            if (item && item.STOK_KODU) {
                const code = String(item.STOK_KODU).trim();
                xmlProductCodes.push(code);

                const costPrice = parseFloat(String(item.MALIYET_FIYATI || 0).replace(',', '.')) || 0;
                const supplierBrand = String(item.STOK_MARKASI || '').trim();
                const carBrand = String(item.ARAC_MARKASI || '').trim();
                const stockStatus = String(item.STOK_DURUMU || '').toUpperCase();
                
                // 📦 STOK MANTIĞI GÜNCELLEME (Gümüşkale: VAR/AZ VAR/YOK)
                let stockQty = 0;
                if (stockStatus === 'VAR') {
                    stockQty = 2; // Tam Yeşil
                } else if (stockStatus === 'AZ VAR') {
                    stockQty = 1; // Yarım Yeşil
                }

                // 🏷️ MARKA DÖNÜŞÜM MANTIĞI
                let productBrand = supplierBrand;
                if (supplierBrand === 'GKL') productBrand = 'ARTEA';
                else if (supplierBrand === 'PRO-A') productBrand = 'ARTEAN';
                else if (supplierBrand === 'OEM' || supplierBrand === 'CHİNA OEM') productBrand = 'OEM';
                else if (supplierBrand === 'ORİJİNAL') productBrand = 'ORİJİNAL';

                // 🛠️ PROFESYONEL FİYAT MOTORU
                let activeMargin = globalMargin;
                if (pricingRules[supplierBrand] !== undefined) {
                    activeMargin = Number(pricingRules[supplierBrand]);
                }

                const listPrice = costPrice * (1 + activeMargin / 100);

                productsToUpsert.push({
                    code: code,
                    name: String(item.STOK_ADI || 'İsimsiz Ürün').trim(),
                    brand: productBrand,
                    car_brand: carBrand,
                    supplier_brand: supplierBrand,
                    oem_no: String(item.OEM_KODU || '').trim(),
                    list_price: listPrice,
                    cost_price: costPrice,
                    profit_margin: activeMargin,
                    currency: String(item.PARA_BIRIMI || 'TRY').trim(),
                    stock_quantity: stockQty,
                    stock_merkez: stockQty,
                    is_active: true
                });
            }
        }

        console.log(`✨ Processed ${productsToUpsert.length} valid products.`);

        // 4. Batch Upsert to Supabase
        const chunkSize = 500;
        console.log("⬆️ Syncing products to Supabase...");
        for (let i = 0; i < productsToUpsert.length; i += chunkSize) {
            const chunk = productsToUpsert.slice(i, i + chunkSize);
            const { error } = await supabase
                .from('products')
                .upsert(chunk, { onConflict: 'code' });

            if (error) {
                console.error(`❌ Upsert error at chunk ${i}:`, error.message);
            } else {
                process.stdout.write(`.`);
            }
        }
        console.log("\n✅ Upsert finished.");

        // 5. Cleanup
        console.log("🧹 Cleaning up old products (Delete missing)...");
        let allDbProducts = [];
        let pageFrom = 0;
        const pageSize = 1000;
        while (true) {
            const { data: page, error: pageError } = await supabase
                .from('products')
                .select('code')
                .range(pageFrom, pageFrom + pageSize - 1);
            if (pageError || !page || page.length === 0) break;
            allDbProducts = allDbProducts.concat(page);
            if (page.length < pageSize) break;
            pageFrom += pageSize;
        }
        const fetchError = null;

        if (!fetchError) {
            const xmlCodeSet = new Set(xmlProductCodes);
            const dbCodes = allDbProducts.map(p => p.code);
            const codesToDelete = dbCodes.filter(c => !xmlCodeSet.has(c));
            
            console.log(`🗑️ Found ${codesToDelete.length} products to delete.`);
            if (codesToDelete.length > 0) {
                for (let i = 0; i < codesToDelete.length; i += chunkSize) {
                    const chunk = codesToDelete.slice(i, i + chunkSize);
                    await supabase.from('products').delete().in('code', chunk);
                }
            }
        }

        console.log("🎉 XML Sync Completed Successfully!");

        // 6. Record last sync date to prevent multiple runs today
        const today = new Date().toISOString().split('T')[0];
        await supabase.from('site_settings').upsert({
            setting_key: 'last_xml_sync',
            setting_value: { date: today, status: 'success', last_count: productsToUpsert.length }
        });

        return { success: true, count: productsToUpsert.length };

    } catch (error) {
        console.error("💥 Critical Sync Error:", error.message);
        return { success: false, error: error.message };
    }
}

module.exports = { syncGumuskaleXml };
