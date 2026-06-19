const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const BASBUG_API = 'https://api.basbug.com.tr';
const FIRMA_ADI = 'BASBUG';
const DEPO = 'MRK';
const BRAND_GROUPS = ['FORD', 'PSA', 'OPEL', 'VW', 'RENAULT', 'FIAT', 'JAPON', 'BMW'];

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xpziispstwarngpsmstd.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwemlpc3BzdHdhcm5ncHNtc3RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUyODc4NywiZXhwIjoyMDk0MTA0Nzg3fQ.HVNDvY8iwXuFvDfd0Oqii-8fWSavVEMNuapn7x9XArk'
);

function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function getToken() {
    const res = await axios.post(`${BASBUG_API}/auth/Login`, {
        KullaniciAdi: process.env.BASBUG_USER || 'MS8012',
        Parola: process.env.BASBUG_PASS || '6SCHUCEY1E6HB9MN',
        ClientSecret: process.env.BASBUG_SECRET || 'W2wOU8V6w3eSWfo6sxi2CThf1g9EYmZ3',
        ClientID: process.env.BASBUG_CLIENT_ID || 'materialApi',
    }, { timeout: 15000 });
    if (!res.data.token) throw new Error('Token alınamadı');
    return res.data.token;
}

async function main() {
    console.log('=================================================');
    console.log('  Basbug Diff Sync Başlıyor');
    console.log('=================================================\n');

    log('🔐 Token alınıyor...');
    const token = await getToken();
    const auth = { Authorization: `Bearer ${token}` };
    log('✅ Token alındı\n');

    // 1. Tüm gruplardan fiyat + stok listesi paralel çek
    log('📥 FiyatGetir + StokGetir tüm gruplar paralel çekiliyor...');
    const [fiyatResults, stokResults] = await Promise.all([
        Promise.all(BRAND_GROUPS.map(g =>
            axios.get(`${BASBUG_API}/material/FiyatGetir?ListeGrubu=${g}&FirmaAdi=${FIRMA_ADI}&Depo=${DEPO}`, { headers: auth, timeout: 30000 })
                .then(r => ({ group: g, list: r.data.fiyatListesi || [] }))
                .catch(e => { log(`  ❌ FiyatGetir ${g}: ${e.message}`); return { group: g, list: [] }; })
        )),
        Promise.all(BRAND_GROUPS.map(g =>
            axios.get(`${BASBUG_API}/material/StokGetir?ListeGrubu=${g}&FirmaAdi=${FIRMA_ADI}&Depo=${DEPO}`, { headers: auth, timeout: 30000 })
                .then(r => ({ group: g, list: (r.data.stokListesi || []).filter(x => x.stok > 0) }))
                .catch(e => { log(`  ❌ StokGetir ${g}: ${e.message}`); return { group: g, list: [] }; })
        ))
    ]);

    // Fiyat map: code -> nf
    const priceMap = {};
    fiyatResults.forEach(({ group, list }) => {
        list.forEach(x => { if (x.no) priceMap[x.no] = x.nf; });
    });

    // Stok set: merkez stoklu kodlar
    const stockedSet = new Set();
    stokResults.forEach(({ list }) => list.forEach(x => stockedSet.add(x.no)));

    log(`  Fiyatlı ürün: ${Object.keys(priceMap).length}`);
    log(`  Merkez stoklu: ${stockedSet.size}\n`);

    // Kar marjı
    const { data: marginSettings } = await supabase
        .from('price_groups').select('*').eq('name', 'GLOBAL_PROFIT_MARGIN').maybeSingle();
    const globalMargin = Number(marginSettings?.discount_percent || 0);
    log(`💰 Global kar marjı: %${globalMargin}\n`);

    // 2. DB'den tüm ürünleri sayfalı oku
    log('🔍 DB ürünleri okunuyor...');
    const dbProducts = {}; // code -> { cost_price, is_active }
    let pageFrom = 0;
    while (true) {
        const { data: page, error } = await supabase
            .from('products')
            .select('code, cost_price, is_active, stock_merkez, is_manual')
            .range(pageFrom, pageFrom + 999);
        if (error || !page || page.length === 0) break;
        page.forEach(p => { dbProducts[p.code] = { cost_price: p.cost_price, is_active: p.is_active, stock_merkez: p.stock_merkez, is_manual: p.is_manual }; });
        if (page.length < 1000) break;
        pageFrom += 1000;
    }
    log(`  DB'de ${Object.keys(dbProducts).length} ürün var\n`);

    // 3. Diff hesapla — sadece Basbug ürünlerini kontrol et (priceMap'te olan kodlar)
    const priceUpdates = [];   // nf değişmiş
    const stockUpdates = [];   // stok durumu değişmiş

    for (const code of Object.keys(priceMap)) {
        const db = dbProducts[code];
        if (!db) continue; // DB'de yok, atla (yeni ürün eklenmeyecek)
        if (db.is_manual) continue; // Manuel eklenen ürün, XML'den güncelleme yapma

        const newNf = priceMap[code];
        const shouldBeActive = stockedSet.has(code);

        // Fiyat değişmiş mi? (0.01 tolerans)
        if (Math.abs((db.cost_price || 0) - newNf) > 0.01) {
            priceUpdates.push({
                code,
                cost_price: newNf,
                list_price: newNf * (1 + globalMargin / 100),
                profit_margin: globalMargin,
            });
        }

        // Stok durumu değişmiş mi? Ya da stoklu ama sayı 100'den düşük mü?
        const currentlyActive = db.is_active && (db.stock_merkez || 0) > 0;
        const stockBelowMax = shouldBeActive && (db.stock_merkez || 0) < 100;
        if (shouldBeActive !== currentlyActive || stockBelowMax) {
            stockUpdates.push({
                code,
                is_active: shouldBeActive,
                stock_quantity: shouldBeActive ? 100 : 0,
                stock_merkez: shouldBeActive ? 100 : 0,
            });
        }
    }

    log(`📊 Değişiklik özeti:`);
    log(`   Fiyat değişen: ${priceUpdates.length} ürün`);
    log(`   Stok değişen: ${stockUpdates.length} ürün\n`);

    // 4. Fiyat güncellemesi
    if (priceUpdates.length > 0) {
        log('💰 Fiyatlar güncelleniyor...');
        let done = 0;
        for (let i = 0; i < priceUpdates.length; i += 500) {
            const { error } = await supabase.from('products')
                .upsert(priceUpdates.slice(i, i + 500), { onConflict: 'code' });
            if (error) log(`  ❌ Fiyat güncelleme hatası: ${error.message}`);
            else done += Math.min(500, priceUpdates.length - i);
        }
        log(`  ✅ ${done} ürün fiyatı güncellendi\n`);
    } else {
        log('✅ Fiyat değişikliği yok\n');
    }

    // 5. Stok güncellemesi
    if (stockUpdates.length > 0) {
        log('📦 Stok durumları güncelleniyor...');
        let done = 0;
        for (let i = 0; i < stockUpdates.length; i += 500) {
            const { error } = await supabase.from('products')
                .upsert(stockUpdates.slice(i, i + 500), { onConflict: 'code' });
            if (error) log(`  ❌ Stok güncelleme hatası: ${error.message}`);
            else done += Math.min(500, stockUpdates.length - i);
        }
        log(`  ✅ ${done} ürün stok durumu güncellendi\n`);
    } else {
        log('✅ Stok değişikliği yok\n');
    }

    // 6. Özet kaydet
    const summary = {
        date: new Date().toISOString(),
        price_updated: priceUpdates.length,
        stock_updated: stockUpdates.length,
    };
    await supabase.from('site_settings').upsert({
        setting_key: 'last_basbug_diff_sync',
        setting_value: summary
    }, { onConflict: 'setting_key' });

    console.log('\n=================================================');
    console.log('  SYNC TAMAMLANDI');
    console.log('=================================================');
    console.log(JSON.stringify(summary, null, 2));
}

main().catch(e => {
    console.error('\n❌ FATAL HATA:', e.message);
    process.exit(1);
});
