import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/auth/admin';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Fiyat hesaplama: herhangi 2 bilinirse 3. hesaplanır
function resolvePrices(row) {
    let cost = row['Geliş Fiyatı'] !== '' && row['Geliş Fiyatı'] != null ? Number(row['Geliş Fiyatı']) : null;
    let margin = row['Kâr Oranı (%)'] !== '' && row['Kâr Oranı (%)'] != null ? Number(row['Kâr Oranı (%)']) : null;
    let list = row['Liste Fiyatı'] !== '' && row['Liste Fiyatı'] != null ? Number(row['Liste Fiyatı']) : null;

    if (cost != null && margin != null) {
        list = parseFloat((cost * (1 + margin / 100)).toFixed(2));
    } else if (cost != null && list != null && list > 0) {
        margin = parseFloat(((list / cost - 1) * 100).toFixed(2));
    } else if (list != null && margin != null) {
        cost = parseFloat((list / (1 + margin / 100)).toFixed(2));
    }

    return { cost_price: cost ?? 0, profit_margin: margin ?? 0, list_price: list ?? 0 };
}

function parseSheet(buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

// GET: önizleme — dosyayı parse et, çakışanları bul, döndür
export async function POST(req) {
    try {
        const user = await verifyAdmin();
        if (!user) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

        const formData = await req.formData();
        const action = formData.get('action'); // 'preview' veya 'confirm'
        const file = formData.get('file');
        const conflictDecisionsRaw = formData.get('decisions'); // JSON string

        if (!file) return NextResponse.json({ error: 'Dosya bulunamadı.' }, { status: 400 });

        const buf = Buffer.from(await file.arrayBuffer());
        let rows;
        try {
            rows = parseSheet(buf);
        } catch (e) {
            return NextResponse.json({ error: 'Excel dosyası okunamadı: ' + e.message }, { status: 400 });
        }

        // Zorunlu alan: Stok Kodu
        const valid = rows.filter(r => String(r['Stok Kodu'] || '').trim() !== '');
        if (valid.length === 0) return NextResponse.json({ error: 'Geçerli ürün bulunamadı. "Stok Kodu" kolonu dolu olmalı.' }, { status: 400 });

        const codes = valid.map(r => String(r['Stok Kodu']).trim().toUpperCase());

        // DB'deki mevcut ürünleri çek
        const existing = {};
        for (let i = 0; i < codes.length; i += 500) {
            const { data } = await supabaseAdmin
                .from('products')
                .select('code, name, supplier_brand, is_manual')
                .in('code', codes.slice(i, i + 500));
            (data || []).forEach(p => { existing[p.code] = p; });
        }

        if (action === 'preview') {
            const newProducts = [];
            const conflicts = []; // aynı kod var ama is_manual DEĞİL (XML ürünü)
            const ownProducts = []; // supplier_brand='b2bartpar' → direkt güncelle

            valid.forEach(r => {
                const code = String(r['Stok Kodu']).trim().toUpperCase();
                const db = existing[code];
                const prices = resolvePrices(r);

                const item = {
                    code,
                    name: String(r['Ürün Adı'] || '').trim() || code,
                    prices,
                    row: r,
                };

                if (!db) {
                    newProducts.push(item);
                } else if (db.supplier_brand === 'b2bartpar') {
                    ownProducts.push({ ...item, dbName: db.name });
                } else {
                    conflicts.push({ ...item, dbName: db.name, dbSupplier: db.supplier_brand });
                }
            });

            return NextResponse.json({
                success: true,
                summary: {
                    total: valid.length,
                    new: newProducts.length,
                    own: ownProducts.length,
                    conflicts: conflicts.length,
                },
                newProducts: newProducts.map(p => ({ code: p.code, name: p.name })),
                ownProducts: ownProducts.map(p => ({ code: p.code, name: p.name, dbName: p.dbName })),
                conflicts: conflicts.map(p => ({ code: p.code, name: p.name, dbName: p.dbName, dbSupplier: p.dbSupplier })),
            });
        }

        if (action === 'confirm') {
            // decisions: { [code]: 'excel' | 'keep' }
            const decisions = conflictDecisionsRaw ? JSON.parse(conflictDecisionsRaw) : {};

            const toUpsert = [];

            valid.forEach(r => {
                const code = String(r['Stok Kodu']).trim().toUpperCase();
                const db = existing[code];
                const prices = resolvePrices(r);

                // Çakışan XML ürünü → kullanıcı kararına bak
                if (db && db.supplier_brand !== 'b2bartpar') {
                    if (decisions[code] !== 'excel') return; // 'keep' veya belirtilmemişse atla
                }

                const product = {
                    code,
                    name: String(r['Ürün Adı'] || '').trim() || code,
                    oem_no: String(r['OEM No'] || '').trim(),
                    brand: String(r['Marka'] || '').trim(),
                    supplier_brand: 'b2bartpar',
                    car_brand: String(r['Araç Markası'] || '').trim(),
                    car_model: String(r['Araç Modeli'] || '').trim(),
                    category: String(r['Kategori'] || '').trim(),
                    currency: String(r['Para Birimi'] || 'TRY').trim() || 'TRY',
                    unit: String(r['Birim'] || 'adet').trim() || 'adet',
                    box_quantity: Number(r['Koli Adeti']) || 1,
                    stock_merkez: Number(r['İstanbul Stok']) || 0,
                    stock_depo: Number(r['Depo Stok']) || 0,
                    discount_rate: Number(r['İskonto Oranı (%)']) || 0,
                    cart_discount_rate: Number(r['Sepette İndirim (%)']) || 0,
                    description: String(r['Açıklama'] || '').trim(),
                    image_url: String(r['Görsel URL'] || '').trim(),
                    is_manual: true,
                    is_active: String(r['Durum'] || 'Aktif').trim() !== 'Pasif',
                    ...prices,
                };
                product.stock_quantity = product.stock_merkez + product.stock_depo;

                toUpsert.push(product);
            });

            let done = 0;
            for (let i = 0; i < toUpsert.length; i += 500) {
                const { error } = await supabaseAdmin
                    .from('products')
                    .upsert(toUpsert.slice(i, i + 500), { onConflict: 'code' });
                if (!error) done += Math.min(500, toUpsert.length - i);
                else console.error('Import upsert error:', error.message);
            }

            return NextResponse.json({ success: true, imported: done });
        }

        return NextResponse.json({ error: 'Geçersiz action.' }, { status: 400 });

    } catch (e) {
        console.error('Import error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
