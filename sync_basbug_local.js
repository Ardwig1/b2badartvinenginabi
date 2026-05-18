const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const BASBUG_API = 'https://api.basbug.com.tr';
const FIRMA_ADI = 'BASBUG';
const DEPO = 'MRK';
const BRAND_GROUPS = ['FORD', 'PSA', 'OPEL', 'VW', 'RENAULT', 'FIAT', 'JAPON'];
const PARALLEL = 50;
const DB_BATCH = 200;

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

const SUPABASE_URL = 'https://xpziispstwarngpsmstd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwemlpc3BzdHdhcm5ncHNtc3RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUyODc4NywiZXhwIjoyMDk0MTA0Nzg3fQ.HVNDvY8iwXuFvDfd0Oqii-8fWSavVEMNuapn7x9XArk';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
    const time = new Date().toLocaleTimeString('tr-TR');
    console.log(`[${time}] ${msg}`);
}

async function getToken() {
    const res = await axios.post(`${BASBUG_API}/auth/Login`, {
        KullaniciAdi: 'MS8012',
        Parola: '6SCHUCEY1E6HB9MN',
        ClientSecret: 'W2wOU8V6w3eSWfo6sxi2CThf1g9EYmZ3',
        ClientID: 'materialApi',
    }, { timeout: 15000 });
    const token = res.data.token;
    if (!token) throw new Error('Token alınamadı');
    return token;
}

async function main() {
    console.log('=================================================');
    console.log('  Basbug Lokal Sync Başlıyor');
    console.log('=================================================\n');

    // --- 1. TOKEN ---
    log('🔐 Token alınıyor...');
    const token = await getToken();
    const auth = { Authorization: `Bearer ${token}` };
    log('✅ Token alındı\n');

    // --- 2. FİYAT LİSTESİ (tüm gruplar paralel) ---
    log('📥 FiyatGetir tüm gruplar çekiliyor...');
    const fiyatResults = await Promise.all(
        BRAND_GROUPS.map(g =>
            axios.get(`${BASBUG_API}/material/FiyatGetir?ListeGrubu=${g}&FirmaAdi=${FIRMA_ADI}&Depo=${DEPO}`, { headers: auth, timeout: 30000 })
                .then(r => ({ group: g, list: r.data.fiyatListesi || [] }))
                .catch(e => { log(`  ❌ FiyatGetir ${g}: ${e.message}`); return { group: g, list: [] }; })
        )
    );
    const priceMap = {}; // code -> { nf, brandGroup }
    fiyatResults.forEach(({ group, list }) => {
        log(`  ${group}: ${list.length} ürün`);
        list.forEach(x => { if (x.no) priceMap[x.no] = { nf: x.nf, brandGroup: group }; });
    });
    log(`\n  Toplam unique fiyatlı ürün: ${Object.keys(priceMap).length}\n`);

    // --- 3. STOK LİSTESİ (tüm gruplar paralel, sadece merkez stoklu) ---
    log('📦 StokGetir tüm gruplar çekiliyor (sadece merkez stoklu)...');
    const stokResults = await Promise.all(
        BRAND_GROUPS.map(g =>
            axios.get(`${BASBUG_API}/material/StokGetir?ListeGrubu=${g}&FirmaAdi=${FIRMA_ADI}&Depo=${DEPO}`, { headers: auth, timeout: 30000 })
                .then(r => ({ group: g, list: (r.data.stokListesi || []).filter(x => x.stok > 0) }))
                .catch(e => { log(`  ❌ StokGetir ${g}: ${e.message}`); return { group: g, list: [] }; })
        )
    );
    const stockedCodes = new Set();
    stokResults.forEach(({ group, list }) => {
        log(`  ${group}: ${list.length} merkez stoklu ürün`);
        list.forEach(x => stockedCodes.add(x.no));
    });
    log(`\n  Toplam unique merkez stoklu ürün: ${stockedCodes.size}\n`);

    // Hem fiyatı hem stoku olan kodlar
    const targetCodes = [...stockedCodes].filter(c => priceMap[c]);
    log(`🎯 Hem fiyatlı hem merkez stoklu: ${targetCodes.length} ürün\n`);

    // --- 4. KAR MARJI AYARLARI ---
    const { data: marginSettings } = await supabase
        .from('price_groups')
        .select('*')
        .eq('name', 'GLOBAL_PROFIT_MARGIN')
        .maybeSingle();
    const globalMargin = Number(marginSettings?.discount_percent || 0);
    const pricingRules = marginSettings?.rules || {};
    log(`💰 Global kar marjı: %${globalMargin}\n`);

    // --- 5. DB'DEKİ MEVCUT KODLAR ---
    log('🔍 DB\'deki mevcut Basbug ürünleri kontrol ediliyor...');
    const existingCodes = new Set();
    let pageFrom = 0;
    const pageSize = 1000;
    while (true) {
        const { data: page, error } = await supabase
            .from('products')
            .select('code')
            .eq('supplier_brand', 'BASBUG') // sadece Basbug ürünleri — diğerlerini etkileme
            .range(pageFrom, pageFrom + pageSize - 1);
        // supplier_brand filtresi yoksa tüm DB'yi çek:
        // .select('code').range(pageFrom, pageFrom + pageSize - 1)
        if (error || !page || page.length === 0) break;
        page.forEach(p => existingCodes.add(p.code));
        if (page.length < pageSize) break;
        pageFrom += pageSize;
    }
    log(`  DB'de ${existingCodes.size} Basbug ürünü var\n`);

    const newCodes = targetCodes.filter(c => !existingCodes.has(c));
    const updateCodes = targetCodes.filter(c => existingCodes.has(c));
    log(`  → ${newCodes.length} yeni ürün eklenecek`);
    log(`  → ${updateCodes.length} mevcut ürün fiyatı güncellenecek\n`);

    // --- 6. MEVCUT ÜRÜN FİYAT GÜNCELLEMESİ ---
    if (updateCodes.length > 0) {
        log('💰 Mevcut ürün fiyatları güncelleniyor...');
        const updates = updateCodes.map(code => {
            const { nf } = priceMap[code];
            const margin = globalMargin;
            return {
                code,
                cost_price: nf,
                list_price: nf * (1 + margin / 100),
                profit_margin: margin,
                stock_quantity: 100,
                stock_merkez: 100,
                stock_depo: 0,
                is_active: true,
            };
        });
        let updated = 0;
        for (let i = 0; i < updates.length; i += DB_BATCH) {
            const chunk = updates.slice(i, i + DB_BATCH);
            const { error } = await supabase.from('products').upsert(chunk, { onConflict: 'code' });
            if (error) log(`  ❌ Güncelleme hatası (chunk ${i}): ${error.message}`);
            else { updated += chunk.length; process.stdout.write('.'); }
        }
        log(`\n  ✅ ${updated} ürün güncellendi\n`);
    }

    // --- 7. YENİ ÜRÜNLER: MalzemeAra (50 paralel) ---
    if (newCodes.length > 0) {
        log(`🆕 ${newCodes.length} yeni ürün için MalzemeAra çekiliyor (${PARALLEL} paralel)...`);
        log(`   Tahmini süre: ~${Math.ceil(newCodes.length / PARALLEL)} saniye\n`);

        let totalAdded = 0;
        let totalExcluded = 0;
        const failedCodes = []; // { code, reason }
        const buffer = [];

        const saveBuffer = async () => {
            if (buffer.length === 0) return;
            const { error } = await supabase.from('products').upsert([...buffer], { onConflict: 'code' });
            if (error) log(`\n  ❌ Kayıt hatası: ${error.message}`);
            else totalAdded += buffer.length;
            buffer.length = 0;
        };

        const processDetail = (code, d) => {
            if (!d || !d.no) { failedCodes.push({ code, reason: 'boş yanıt' }); return; }
            const uk = d.uk || 'BASBUG';
            if (EXCLUDE_BRANDS.has(uk)) { totalExcluded++; return; }

            const { nf, brandGroup } = priceMap[code];
            const supplierBrand = uk;
            const brand = mapBrand(uk);
            const margin = pricingRules[supplierBrand] !== undefined
                ? Number(pricingRules[supplierBrand])
                : globalMargin;

            const nameParts = [d.ac, d.ac2].filter(x => x && x.trim()).join(' ');
            const name = d.m
                ? `${nameParts} - ${d.m}${d.mo ? ' ' + d.mo : ''}${d.y ? ' (' + d.y + ')' : ''}`
                : nameParts;

            buffer.push({
                code,
                name: name.trim() || code,
                brand,
                supplier_brand: supplierBrand,
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
        };

        // Ana geçiş
        let batchCount = 0;
        for (let i = 0; i < newCodes.length; i += PARALLEL) {
            // Her 100 batch'te token yenile (~2 dakikada bir)
            if (batchCount > 0 && batchCount % 100 === 0) {
                try {
                    const newToken = await getToken();
                    auth.Authorization = `Bearer ${newToken}`;
                    process.stdout.write(`\n  🔄 Token yenilendi\n`);
                } catch (e) {
                    process.stdout.write(`\n  ⚠️ Token yenilenemedi: ${e.message}\n`);
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
                if (result.status !== 'fulfilled') {
                    const code = batch[details.indexOf(result)];
                    failedCodes.push({ code, reason: result.reason?.message || 'timeout' });
                    continue;
                }
                processDetail(result.value.code, result.value.data);
            }

            if (buffer.length >= DB_BATCH) await saveBuffer();

            const done = Math.min(i + PARALLEL, newCodes.length);
            const pct = (done / newCodes.length * 100).toFixed(1);
            const remaining = Math.ceil((newCodes.length - done) / PARALLEL);
            process.stdout.write(`\r  [${done}/${newCodes.length}] %${pct} | ✅${totalAdded} kaydedildi ⏭️${totalExcluded} hariç ❌${failedCodes.length} hata | ~${remaining}sn kaldı`);
        }

        await saveBuffer();
        console.log();

        // Başarısız olanları bir kez daha dene
        if (failedCodes.length > 0) {
            console.log(`\n  🔄 ${failedCodes.length} başarısız ürün tekrar deneniyor...`);
            const retryCodes = [...failedCodes];
            failedCodes.length = 0;

            for (let i = 0; i < retryCodes.length; i += PARALLEL) {
                const batch = retryCodes.slice(i, i + PARALLEL);
                const details = await Promise.allSettled(
                    batch.map(({ code }) =>
                        axios.get(`${BASBUG_API}/material/MalzemeAra?MalzemeNo=${encodeURIComponent(code)}&FirmaAdi=${FIRMA_ADI}`, { headers: auth, timeout: 20000 })
                            .then(r => ({ code, data: r.data }))
                    )
                );
                for (const result of details) {
                    if (result.status !== 'fulfilled') {
                        const code = batch[details.indexOf(result)];
                        failedCodes.push({ code: code.code, reason: result.reason?.message || 'timeout' });
                        continue;
                    }
                    processDetail(result.value.code, result.value.data);
                }
                if (buffer.length >= DB_BATCH) await saveBuffer();
            }
            await saveBuffer();
            console.log(`  Retry sonucu: ✅${totalAdded} toplam kaydedildi, ❌${failedCodes.length} hala başarısız`);
        }

        // Hala başarısız olanları dosyaya yaz
        if (failedCodes.length > 0) {
            const fs = require('fs');
            fs.writeFileSync('basbug_failed.json', JSON.stringify(failedCodes, null, 2));
            log(`\n  ⚠️  ${failedCodes.length} ürün hala başarısız → basbug_failed.json dosyasına kaydedildi`);
            log('  Sadece bunları tekrar denemek için: node sync_basbug_local.js --retry');
        }

        console.log(`\n  ✅ ${totalAdded} yeni ürün eklendi, ⏭️ ${totalExcluded} hariç tutuldu, ❌ ${failedCodes.length} başarısız\n`);
    }

    // --- 8. ARTIK STOKTA OLMAYAN ÜRÜNLER PASİFE AL ---
    const targetSet = new Set(targetCodes);
    const toDeactivate = [...existingCodes].filter(c => !targetSet.has(c));
    if (toDeactivate.length > 0) {
        log(`🗑️  ${toDeactivate.length} ürün artık stokta yok, pasife alınıyor...`);
        for (let i = 0; i < toDeactivate.length; i += 500) {
            const chunk = toDeactivate.slice(i, i + 500);
            await supabase.from('products').update({ is_active: false, stock_quantity: 0, stock_merkez: 0 }).in('code', chunk);
        }
        log('  ✅ Pasife alındı\n');
    }

    // --- 9. ÖZET ---
    const summary = {
        hedef: targetCodes.length,
        guncellenen: updateCodes.length,
        eklenen: newCodes.length,
        pasife_alinan: toDeactivate.length,
    };

    await supabase.from('site_settings').upsert({
        setting_key: 'last_basbug_sync',
        setting_value: { date: new Date().toISOString(), ...summary }
    }, { onConflict: 'setting_key' });

    console.log('=================================================');
    console.log('  SYNC TAMAMLANDI');
    console.log('=================================================');
    console.log(JSON.stringify(summary, null, 2));
}

// --retry modu: sadece basbug_failed.json'daki kodları dener
async function retryFailed() {
    const fs = require('fs');
    if (!fs.existsSync('basbug_failed.json')) {
        console.log('basbug_failed.json bulunamadı.');
        return;
    }
    const failed = JSON.parse(fs.readFileSync('basbug_failed.json', 'utf8'));
    console.log(`🔄 ${failed.length} başarısız ürün tekrar deneniyor...\n`);

    const { data: marginSettings } = await supabase.from('price_groups').select('*').eq('name', 'GLOBAL_PROFIT_MARGIN').maybeSingle();
    const globalMargin = Number(marginSettings?.discount_percent || 0);
    const pricingRules = marginSettings?.rules || {};

    const token = await getToken();
    const auth = { Authorization: `Bearer ${token}` };

    // Fiyat map için tüm grupları çek
    const priceMap = {};
    await Promise.all(BRAND_GROUPS.map(g =>
        axios.get(`${BASBUG_API}/material/FiyatGetir?ListeGrubu=${g}&FirmaAdi=${FIRMA_ADI}&Depo=${DEPO}`, { headers: auth, timeout: 30000 })
            .then(r => (r.data.fiyatListesi || []).forEach(x => { if (x.no) priceMap[x.no] = { nf: x.nf, brandGroup: g }; }))
            .catch(() => {})
    ));

    let added = 0;
    const stillFailed = [];
    const buffer = [];
    let retryBatchCount = 0;

    for (let i = 0; i < failed.length; i += PARALLEL) {
        if (retryBatchCount > 0 && retryBatchCount % 100 === 0) {
            try {
                const newToken = await getToken();
                auth.Authorization = `Bearer ${newToken}`;
                process.stdout.write(`\n  🔄 Token yenilendi\n`);
            } catch (e) {
                process.stdout.write(`\n  ⚠️ Token yenilenemedi: ${e.message}\n`);
            }
        }
        retryBatchCount++;

        const batch = failed.slice(i, i + PARALLEL);
        const details = await Promise.allSettled(
            batch.map(({ code }) =>
                axios.get(`${BASBUG_API}/material/MalzemeAra?MalzemeNo=${encodeURIComponent(code)}&FirmaAdi=${FIRMA_ADI}`, { headers: auth, timeout: 20000 })
                    .then(r => ({ code, data: r.data }))
            )
        );
        for (const result of details) {
            if (result.status !== 'fulfilled') {
                stillFailed.push({ code: batch[details.indexOf(result)].code, reason: result.reason?.message });
                continue;
            }
            const { code, data: d } = result.value;
            if (!d || !d.no) { stillFailed.push({ code, reason: 'boş yanıt' }); continue; }
            const uk = d.uk || 'BASBUG';
            if (EXCLUDE_BRANDS.has(uk)) continue;
            const { nf, brandGroup } = priceMap[code] || { nf: 0, brandGroup: 'BILINMIYOR' };
            const margin = Number(pricingRules[uk] ?? globalMargin);
            const nameParts = [d.ac, d.ac2].filter(x => x && x.trim()).join(' ');
            const name = d.m ? `${nameParts} - ${d.m}${d.mo ? ' ' + d.mo : ''}${d.y ? ' (' + d.y + ')' : ''}` : nameParts;
            buffer.push({
                code, name: name.trim() || code, brand: mapBrand(uk), supplier_brand: uk,
                car_brand: d.lgk || brandGroup, car_model: d.m || '', oem_no: String(d.oe || '').trim(),
                cost_price: nf, list_price: nf * (1 + margin / 100), profit_margin: margin,
                currency: d.dc || 'TL', box_quantity: d.k || 1,
                stock_quantity: 100, stock_merkez: 100, stock_depo: 0, unit: 'adet', is_active: true,
            });
        }
        if (buffer.length >= DB_BATCH) {
            const { error } = await supabase.from('products').upsert([...buffer], { onConflict: 'code' });
            if (!error) added += buffer.length;
            buffer.length = 0;
        }
        process.stdout.write(`\r  [${Math.min(i + PARALLEL, failed.length)}/${failed.length}] ✅${added} ❌${stillFailed.length}`);
    }
    if (buffer.length > 0) {
        const { error } = await supabase.from('products').upsert([...buffer], { onConflict: 'code' });
        if (!error) added += buffer.length;
    }
    console.log(`\n\n✅ ${added} eklendi, ❌ ${stillFailed.length} hala başarısız`);
    if (stillFailed.length > 0) {
        require('fs').writeFileSync('basbug_failed.json', JSON.stringify(stillFailed, null, 2));
        console.log('Kalanlar basbug_failed.json\'a yazıldı.');
    } else {
        require('fs').unlinkSync('basbug_failed.json');
        console.log('basbug_failed.json temizlendi, tüm ürünler başarıyla eklendi!');
    }
}

if (process.argv.includes('--retry')) {
    retryFailed().catch(e => { console.error('HATA:', e.message); process.exit(1); });
} else {
    main().catch(e => {
        console.error('\n❌ FATAL HATA:', e.message);
        process.exit(1);
    });
}
