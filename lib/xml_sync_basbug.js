const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

/**
 * Basbug Group API Sync Engine
 * Logic: Fetch stocks/prices in bulk, then fetch details for in-stock items.
 */

async function syncBasbugApi() {
    console.log("🚀 Starting Basbug API Sync...");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authData = {
        "KullaniciAdi": process.env.BASBUG_USER || "MS8012",
        "Parola": process.env.BASBUG_PAS || process.env.BASBUG_PASS || "6SCHUCEY1E6HB9MN",
        "ClientSecret": process.env.BASBUG_SECRET || "W2wOU8V6w3eSWfo6sxi2CThf1g9EYmZ3",
        "ClientID": process.env.BASBUG_CLIENT_ID || "materialApi"
    };

    const TARGET_BRANDS = [
        "PEUGEOT", "CITROEN", "OPEL", "VOLKSWAGEN", "SKODA", 
        "AUDI", "SEAT", "FORD", "TOYOTA", "RENAULT", "FIAT"
    ];

    const commonHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };

    const PROXY_URL = "https://eosetsm38z4wt4h.m.pipedream.net";

    try {
        // 1. Get Token
        console.log("🔐 Authenticating with Basbug via Proxy...");
        const loginRes = await axios.post(`${PROXY_URL}/auth/Login`, authData, { headers: commonHeaders });
        const token = loginRes.data.token;
        
        if (!token) throw new Error("Could not retrieve token from Basbug.");
        console.log("✅ Token received.");

        // 2. Fetch Pricing Rules
        const { data: marginSettings } = await supabase.from('price_groups').select('*').eq('name', 'GLOBAL_PROFIT_MARGIN').single();
        const globalMargin = Number(marginSettings?.discount_percent || 0);
        const pricingRules = marginSettings?.rules || {};

        const allProductsToUpsert = [];
        const processedCodes = new Set();

        const apiConfig = {
            headers: { 
                ...commonHeaders,
                'Authorization': `Bearer ${token}` 
            }
        };

        for (const brand of TARGET_BRANDS) {
            console.log(`\n📦 Processing Brand: ${brand}...`);
            
            // Fetch Stocks and Prices (NO FILTERS)
            try {
                const stockRes = await axios.get(`${PROXY_URL}/material/StokGetir?ListeGrubu=${encodeURIComponent(brand)}&FirmaAdi=BASBUG&Depo=MRK`, apiConfig);
                const stockList = stockRes.data.stokListesi || [];
                
                console.log(`✨ Found ${stockList.length} total items for ${brand}.`);

                // 200 items per brand to avoid timeout
                const itemsToProcess = stockList.slice(0, 200);

                for (const stockItem of itemsToProcess) {
                    const code = stockItem.no;
                    if (processedCodes.has(code)) continue;

                    try {
                        const detailRes = await axios.get(`${PROXY_URL}/material/MalzemeAra?MalzemeNo=${encodeURIComponent(code)}&FirmaAdi=BASBUG`, apiConfig);
                        const item = detailRes.data;

                        if (item && item.no) {
                            const richName = `${brand} ${item.ac || ''} ${item.ac2 || ''} - ${item.m || ''} (${item.y || ''})`.replace(/\s\s+/g, ' ').trim();
                            const costPrice = item.nf || 0;
                            const supplierBrand = item.uk || 'BASBUG';
                            
                            let activeMargin = globalMargin;
                            if (pricingRules[supplierBrand] !== undefined) {
                                activeMargin = Number(pricingRules[supplierBrand]);
                            }
                            const listPrice = costPrice * (1 + activeMargin / 100);

                            const totalLocalStock = (item.sMrk || 0) + (item.sIzm || 0) + (item.sAnk || 0) + (item.sAdn || 0) + (item.sErz || 0);
                            const incomingStock = item.sYol || 0;

                            allProductsToUpsert.push({
                                code: code,
                                name: richName,
                                brand: supplierBrand,
                                car_brand: brand,
                                supplier_brand: supplierBrand,
                                oem_no: String(item.oe || '').trim(),
                                list_price: listPrice,
                                cost_price: costPrice,
                                profit_margin: activeMargin,
                                currency: item.dc || 'TL',
                                stock_quantity: totalLocalStock + incomingStock, 
                                stock_merkez: totalLocalStock,
                                stock_depo: incomingStock,
                                is_active: true
                            });

                            processedCodes.add(code);
                            process.stdout.write(".");
                        }
                    } catch (err) {
                        // Skip individual errors
                    }
                }
            } catch (err) {
                console.error(`❌ Failed to fetch list for ${brand}:`, err.message);
            }
        }

                    if (item && item.no) {
                        // 🏷️ RICH PRODUCT NAME: [Brand] [Name] - [Compatibility] ([Year])
                        const richName = `${brand} ${item.ac || ''} ${item.ac2 || ''} - ${item.m || ''} (${item.y || ''})`.replace(/\s\s+/g, ' ').trim();
                        
                        const costPrice = priceMap.get(code) || item.nf || 0;
                        const supplierBrand = item.uk || 'BASBUG';
                        
                        // 🛠️ PROFESYONEL FİYAT MOTORU
                        let activeMargin = globalMargin;
                        if (pricingRules[supplierBrand] !== undefined) {
                            activeMargin = Number(pricingRules[supplierBrand]);
                        }
                        const listPrice = costPrice * (1 + activeMargin / 100);

                        // 📦 STOK MANTIĞI: Gerçek Rakamlar
                        // Istanbul/Merkez = Tüm yerel depoların toplamı
                        // Depo = Sadece yoldaki stok (sYol)
                        const totalLocalStock = (item.sMrk || 0) + (item.sIzm || 0) + (item.sAnk || 0) + (item.sAdn || 0) + (item.sErz || 0);
                        const incomingStock = item.sYol || 0;

                        allProductsToUpsert.push({
                            code: code,
                            name: richName,
                            brand: supplierBrand,
                            car_brand: brand,
                            supplier_brand: supplierBrand,
                            oem_no: String(item.oe || '').trim(),
                            list_price: listPrice,
                            cost_price: costPrice,
                            profit_margin: activeMargin,
                            currency: item.dc || 'TL',
                            stock_quantity: totalLocalStock + incomingStock, 
                            stock_merkez: totalLocalStock,
                            stock_depo: incomingStock,
                            is_active: true
                        });

                        processedCodes.add(code);
                        process.stdout.write(".");
                    }
                } catch (err) {
                    console.error(`\n❌ Error fetching details for ${code}:`, err.message);
                }
            }
        }

        console.log(`\n⬆️ Upserting ${allProductsToUpsert.length} products to Supabase...`);
        const chunkSize = 500;
        for (let i = 0; i < allProductsToUpsert.length; i += chunkSize) {
            const chunk = allProductsToUpsert.slice(i, i + chunkSize);
            const { error } = await supabase.from('products').upsert(chunk, { onConflict: 'code' });
            if (error) console.error("❌ Supabase Error:", error.message);
        }

        console.log("🎉 Basbug Sync Completed!");
        return { success: true, count: allProductsToUpsert.length };

    } catch (error) {
        console.error("💥 Critical Basbug Sync Error:", error.message);
        return { success: false, error: error.message };
    }
}

module.exports = { syncBasbugApi };
