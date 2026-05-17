const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const BASBUG_API = 'https://api.basbug.com.tr';
const FIRMA_ADI = 'BASBUG';
const DEPO = 'MRK';

// Toyota netleşince buraya ekle
const BRAND_GROUPS = ['FORD', 'PSA', 'OPEL', 'VW', 'RENAULT', 'FIAT'];

async function getToken() {
    const res = await axios.post(`${BASBUG_API}/auth/Login`, {
        KullaniciAdi: process.env.BASBUG_USER || 'MS8012',
        Parola: process.env.BASBUG_PASS || '6SCHUCEY1E6HB9MN',
        ClientSecret: process.env.BASBUG_SECRET || 'W2wOU8V6w3eSWfo6sxi2CThf1g9EYmZ3',
        ClientID: process.env.BASBUG_CLIENT_ID || 'materialApi',
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });

    const token = res.data.token;
    if (!token) throw new Error('Basbug token alınamadı');
    return token;
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function getMalzemeDetail(code, authHeader) {
    try {
        const res = await axios.get(
            `${BASBUG_API}/material/MalzemeAra?MalzemeNo=${encodeURIComponent(code)}&FirmaAdi=${FIRMA_ADI}`,
            { headers: authHeader, timeout: 10000 }
        );
        return res.data || null;
    } catch {
        return null;
    }
}

async function syncBasbugApi() {
    console.log('🚀 Basbug API Sync başlıyor...');

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fiyat marjı ayarları
    const { data: marginSettings } = await supabase
        .from('price_groups')
        .select('*')
        .eq('name', 'GLOBAL_PROFIT_MARGIN')
        .single();
    const globalMargin = Number(marginSettings?.discount_percent || 0);
    const pricingRules = marginSettings?.rules || {};

    const token = await getToken();
    const authHeader = { Authorization: `Bearer ${token}` };

    // Tüm markalardan fiyat verisi çek
    const allPriceMap = {}; // code -> { nf, currency, brandGroup }
    for (const group of BRAND_GROUPS) {
        console.log(`📥 FiyatGetir: ${group}`);
        try {
            const res = await axios.get(
                `${BASBUG_API}/material/FiyatGetir?ListeGrubu=${group}&FirmaAdi=${FIRMA_ADI}&Depo=${DEPO}`,
                { headers: authHeader, timeout: 30000 }
            );
            const list = res.data.fiyatListesi || [];
            console.log(`   → ${list.length} ürün`);
            for (const item of list) {
                if (item.no) allPriceMap[item.no] = { nf: item.nf, currency: 'EUR', brandGroup: group };
            }
        } catch (err) {
            console.error(`❌ FiyatGetir ${group} hatası:`, err.message);
        }
    }

    const allCodes = Object.keys(allPriceMap);
    console.log(`\n📦 Toplam benzersiz ürün: ${allCodes.length}`);

    // DB'deki mevcut kodları çek (sayfalı)
    console.log('🔍 DB\'deki mevcut ürünler kontrol ediliyor...');
    const existingCodes = new Set();
    let pageFrom = 0;
    const pageSize = 1000;
    while (true) {
        const { data: page, error } = await supabase
            .from('products')
            .select('code')
            .range(pageFrom, pageFrom + pageSize - 1);
        if (error || !page || page.length === 0) break;
        page.forEach(p => existingCodes.add(p.code));
        if (page.length < pageSize) break;
        pageFrom += pageSize;
    }
    console.log(`   → DB'de ${existingCodes.size} ürün var`);

    const newCodes = allCodes.filter(c => !existingCodes.has(c));
    const existingToUpdate = allCodes.filter(c => existingCodes.has(c));
    console.log(`   → ${newCodes.length} yeni, ${existingToUpdate.length} güncelleme`);

    // Mevcut ürünlerin fiyatını güncelle (MalzemeAra'ya gerek yok)
    if (existingToUpdate.length > 0) {
        console.log('\n💰 Mevcut ürünlerin fiyatları güncelleniyor...');
        const priceUpdates = existingToUpdate.map(code => {
            const { nf, currency } = allPriceMap[code];
            const activeMargin = globalMargin;
            return {
                code,
                cost_price: nf,
                list_price: nf * (1 + activeMargin / 100),
                profit_margin: activeMargin,
                currency,
                is_active: true,
            };
        });
        const chunkSize = 500;
        for (let i = 0; i < priceUpdates.length; i += chunkSize) {
            const chunk = priceUpdates.slice(i, i + chunkSize);
            const { error } = await supabase.from('products').upsert(chunk, { onConflict: 'code' });
            if (error) console.error(`Fiyat güncelleme hatası (chunk ${i}):`, error.message);
            else process.stdout.write('.');
        }
        console.log('\n✅ Fiyat güncelleme tamam');
    }

    // Yeni ürünler için MalzemeAra ile detay çek (rate limit: 6.5sn aralık)
    let newAdded = 0;
    if (newCodes.length > 0) {
        console.log(`\n🆕 ${newCodes.length} yeni ürün için detay çekiliyor (rate limit nedeniyle yavaş olabilir)...`);
        const newProducts = [];

        for (let i = 0; i < newCodes.length; i++) {
            const code = newCodes[i];
            const priceInfo = allPriceMap[code];

            const detail = await getMalzemeDetail(code, authHeader);
            if (detail && detail.no) {
                const supplierBrand = detail.uk || 'BASBUG';
                const activeMargin = pricingRules[supplierBrand] !== undefined
                    ? Number(pricingRules[supplierBrand])
                    : globalMargin;
                const nf = priceInfo.nf || 0;

                const nameParts = [detail.ac, detail.ac2].filter(Boolean).join(' ');
                const richName = detail.m
                    ? `${nameParts} - ${detail.m}${detail.mo ? ' ' + detail.mo : ''}${detail.y ? ' (' + detail.y + ')' : ''}`
                    : nameParts;

                const totalStock = (detail.sMrk || 0) + (detail.sIzm || 0) + (detail.sAnk || 0) + (detail.sAdn || 0) + (detail.sErz || 0);

                newProducts.push({
                    code,
                    name: richName.trim() || code,
                    brand: supplierBrand,
                    car_brand: detail.lgk || priceInfo.brandGroup,
                    car_model: detail.m || '',
                    supplier_brand: supplierBrand,
                    oem_no: String(detail.oe || '').trim(),
                    list_price: nf * (1 + activeMargin / 100),
                    cost_price: nf,
                    profit_margin: activeMargin,
                    currency: detail.dc || 'EUR',
                    stock_quantity: totalStock + (detail.sYol || 0),
                    stock_merkez: totalStock,
                    stock_depo: detail.sYol || 0,
                    is_active: true,
                });
                newAdded++;
            }

            // Her 50 üründe bir toplu kaydet
            if (newProducts.length >= 50) {
                const { error } = await supabase.from('products').upsert(newProducts, { onConflict: 'code' });
                if (error) console.error('Yeni ürün kayıt hatası:', error.message);
                else process.stdout.write(`[${i + 1}/${newCodes.length}]`);
                newProducts.length = 0;
            }

            // Rate limit: dakikada 10 istek = 6 saniye bekleme
            await sleep(6100);
        }

        // Kalan ürünleri kaydet
        if (newProducts.length > 0) {
            const { error } = await supabase.from('products').upsert(newProducts, { onConflict: 'code' });
            if (error) console.error('Son batch kayıt hatası:', error.message);
        }
    }

    // Artık Basbug'da olmayan ürünleri pasife al
    const removedCodes = [...existingCodes].filter(c => !allPriceMap[c]);
    if (removedCodes.length > 0) {
        console.log(`\n🗑️ ${removedCodes.length} ürün Basbug'dan kalkmış, pasife alınıyor...`);
        for (let i = 0; i < removedCodes.length; i += 500) {
            const chunk = removedCodes.slice(i, i + 500);
            await supabase.from('products').update({ is_active: false }).in('code', chunk);
        }
    }

    const summary = {
        success: true,
        total: allCodes.length,
        updated: existingToUpdate.length,
        new: newAdded,
        deactivated: removedCodes.length,
    };
    console.log('\n🎉 Basbug Sync tamamlandı!', summary);

    // Son sync tarihini kaydet
    await supabase.from('site_settings').upsert({
        setting_key: 'last_basbug_sync',
        setting_value: { date: new Date().toISOString().split('T')[0], ...summary }
    }, { onConflict: 'setting_key' });

    return summary;
}

module.exports = { syncBasbugApi };
