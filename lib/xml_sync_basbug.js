const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const BASBUG_API = 'https://api.basbug.com.tr';
const FIRMA_ADI = 'BASBUG';
const DEPO = 'MRK';
const BRAND_GROUPS = ['FORD', 'PSA', 'OPEL', 'VW', 'RENAULT', 'FIAT', 'JAPON'];
const PARALLEL = 50;

const EXCLUDE_BRANDS = new Set([
    'AKZONOBEL-D','AXALTA-D','BARUM-D','BASFORD','BMTS','BRIGESTONE-D','CASTROL-D',
    'COJALI','CONTI TURBO','CONTINENTAL-D','DE-GA','ERC','FLEETGUARD','FMY','FRENLAS',
    'GOODYEAR-D','HDK','IHI','IMP','INCI','IOF','JBU678','KNK','KORMORAN-D','LASSA-D',
    'KNORR BREMSE','LUKOIL-D','MATADOR-D','MICHELIN-D','NRX','POLISAN-D','PPG-D',
    'PRESSAN','ROMBAT','SANKE','SBK','SEIW','SHELL','STABILUS','SOFIMA','STANADYNE',
    'STARLAS','TAMA','TCIC','TIMKEN','TIRSAN','TM','TOTAL-D','TRW','TUNAP-D',
    'WILDCAT','WURTH-D','ZF'
]);

function mapBrand(uk) {
    if (!uk) return uk;
    if (uk === 'BOEM') return 'LOGOSUZ OEM';
    if (uk === 'BSG') return 'ARTPAR';
    if (uk.startsWith('IOE')) return 'OEM ' + uk.slice(3).trim();
    if (uk.startsWith('OE-')) return 'ORİJİNAL ' + uk.slice(3);
    return uk;
}

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

async function syncBasbugApi() {
    console.log('🚀 Basbug API Sync başlıyor...');

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Kar marjı ayarları
    const { data: marginSettings } = await supabase
        .from('price_groups')
        .select('*')
        .eq('name', 'GLOBAL_PROFIT_MARGIN')
        .maybeSingle();
    const globalMargin = Number(marginSettings?.discount_percent || 0);
    const pricingRules = marginSettings?.rules || {};

    let token = await getToken();
    let auth = { Authorization: `Bearer ${token}` };

    // Fiyat listesi — tüm gruplar paralel
    console.log('📥 FiyatGetir tüm gruplar...');
    const fiyatResults = await Promise.all(
        BRAND_GROUPS.map(g =>
            axios.get(`${BASBUG_API}/material/FiyatGetir?ListeGrubu=${g}&FirmaAdi=${FIRMA_ADI}&Depo=${DEPO}`, { headers: auth, timeout: 30000 })
                .then(r => ({ group: g, list: r.data.fiyatListesi || [] }))
                .catch(e => { console.error(`❌ FiyatGetir ${g}:`, e.message); return { group: g, list: [] }; })
        )
    );
    const priceMap = {};
    fiyatResults.forEach(({ group, list }) => {
        console.log(`   ${group}: ${list.length}`);
        list.forEach(x => { if (x.no) priceMap[x.no] = { nf: x.nf, brandGroup: group }; });
    });

    // Stok listesi — sadece merkez stoklu
    console.log('📦 StokGetir tüm gruplar (sadece merkez stoklu)...');
    const stokResults = await Promise.all(
        BRAND_GROUPS.map(g =>
            axios.get(`${BASBUG_API}/material/StokGetir?ListeGrubu=${g}&FirmaAdi=${FIRMA_ADI}&Depo=${DEPO}`, { headers: auth, timeout: 30000 })
                .then(r => ({ group: g, list: (r.data.stokListesi || []).filter(x => x.stok > 0) }))
                .catch(e => { console.error(`❌ StokGetir ${g}:`, e.message); return { group: g, list: [] }; })
        )
    );
    const stockedCodes = new Set();
    stokResults.forEach(({ group, list }) => {
        console.log(`   ${group}: ${list.length} merkez stoklu`);
        list.forEach(x => stockedCodes.add(x.no));
    });

    // Hem fiyatlı hem merkez stoklu
    const targetCodes = [...stockedCodes].filter(c => priceMap[c]);
    console.log(`\n🎯 Hedef: ${targetCodes.length} ürün`);

    // DB'deki mevcut Basbug kodları
    const existingCodes = new Set();
    let pageFrom = 0;
    while (true) {
        const { data: page, error } = await supabase
            .from('products').select('code')
            .range(pageFrom, pageFrom + 999);
        if (error || !page || page.length === 0) break;
        page.forEach(p => existingCodes.add(p.code));
        if (page.length < 1000) break;
        pageFrom += 1000;
    }

    const newCodes = targetCodes.filter(c => !existingCodes.has(c));
    const updateCodes = targetCodes.filter(c => existingCodes.has(c));
    console.log(`   → ${newCodes.length} yeni, ${updateCodes.length} güncelleme`);

    // Mevcut ürünlerin fiyat + stok güncelle
    if (updateCodes.length > 0) {
        console.log('\n💰 Mevcut ürün fiyatları güncelleniyor...');
        const updates = updateCodes.map(code => {
            const { nf } = priceMap[code];
            return {
                code,
                cost_price: nf,
                list_price: nf * (1 + globalMargin / 100),
                profit_margin: globalMargin,
                stock_quantity: 100,
                stock_merkez: 100,
                stock_depo: 0,
                is_active: true,
            };
        });
        for (let i = 0; i < updates.length; i += 500) {
            const { error } = await supabase.from('products').upsert(updates.slice(i, i + 500), { onConflict: 'code' });
            if (error) console.error(`Güncelleme hatası:`, error.message);
            else process.stdout.write('.');
        }
        console.log('\n✅ Fiyat güncelleme tamam');
    }

    // Yeni ürünler — 50 paralel + token yenileme
    let newAdded = 0;
    if (newCodes.length > 0) {
        console.log(`\n🆕 ${newCodes.length} yeni ürün için MalzemeAra çekiliyor...`);
        const buffer = [];
        let batchCount = 0;

        const saveBuffer = async () => {
            if (buffer.length === 0) return;
            const { error } = await supabase.from('products').upsert([...buffer], { onConflict: 'code' });
            if (!error) newAdded += buffer.length;
            else console.error('Kayıt hatası:', error.message);
            buffer.length = 0;
        };

        for (let i = 0; i < newCodes.length; i += PARALLEL) {
            if (batchCount > 0 && batchCount % 100 === 0) {
                try {
                    token = await getToken();
                    auth = { Authorization: `Bearer ${token}` };
                    console.log('\n🔄 Token yenilendi');
                } catch (e) {
                    console.error('\n⚠️ Token yenilenemedi:', e.message);
                }
            }
            batchCount++;

            const batch = newCodes.slice(i, i + PARALLEL);
            const details = await Promise.allSettled(
                batch.map(code =>
                    axios.get(`${BASBUG_API}/material/MalzemeAra?MalzemeNo=${encodeURIComponent(code)}&FirmaAdi=${FIRMA_ADI}`, { headers: auth, timeout: 15000 })
                        .then(r => ({ code, data: r.data }))
                )
            );

            for (const result of details) {
                if (result.status !== 'fulfilled') continue;
                const { code, data: d } = result.value;
                if (!d || !d.no) continue;

                const uk = d.uk || 'BASBUG';
                if (EXCLUDE_BRANDS.has(uk)) continue;

                const { nf, brandGroup } = priceMap[code];
                const margin = pricingRules[uk] !== undefined ? Number(pricingRules[uk]) : globalMargin;
                const nameParts = [d.ac, d.ac2].filter(x => x && x.trim()).join(' ');
                const name = d.m
                    ? `${nameParts} - ${d.m}${d.mo ? ' ' + d.mo : ''}${d.y ? ' (' + d.y + ')' : ''}`
                    : nameParts;

                buffer.push({
                    code,
                    name: name.trim() || code,
                    brand: mapBrand(uk),
                    supplier_brand: uk,
                    car_brand: d.lgk || brandGroup,
                    car_model: d.m || '',
                    oem_no: String(d.oe || '').trim(),
                    cost_price: nf,
                    list_price: nf * (1 + margin / 100),
                    profit_margin: margin,
                    currency: d.dc || 'TL',
                    box_quantity: d.k || 1,
                    stock_quantity: 100,
                    stock_merkez: 100,
                    stock_depo: 0,
                    unit: 'adet',
                    is_active: true,
                });
            }

            if (buffer.length >= 200) await saveBuffer();
            process.stdout.write(`\r   [${Math.min(i + PARALLEL, newCodes.length)}/${newCodes.length}] ✅${newAdded}`);
        }
        await saveBuffer();
        console.log(`\n✅ ${newAdded} yeni ürün eklendi`);
    }

    // Artık stokta olmayan ürünleri pasife al
    const targetSet = new Set(targetCodes);
    const toDeactivate = [...existingCodes].filter(c => !targetSet.has(c));
    if (toDeactivate.length > 0) {
        console.log(`\n🗑️ ${toDeactivate.length} ürün stoktan çıkmış, pasife alınıyor...`);
        for (let i = 0; i < toDeactivate.length; i += 500) {
            await supabase.from('products')
                .update({ is_active: false, stock_quantity: 0, stock_merkez: 0 })
                .in('code', toDeactivate.slice(i, i + 500));
        }
    }

    const summary = {
        success: true,
        total: targetCodes.length,
        updated: updateCodes.length,
        new: newAdded,
        deactivated: toDeactivate.length,
    };
    console.log('\n🎉 Basbug Sync tamamlandı!', summary);

    await supabase.from('site_settings').upsert({
        setting_key: 'last_basbug_sync',
        setting_value: { date: new Date().toISOString().split('T')[0], ...summary }
    }, { onConflict: 'setting_key' });

    return summary;
}

module.exports = { syncBasbugApi };
