import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/auth/admin';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const fmt2 = (v) => {
    const n = Number(v);
    return isNaN(n) ? '' : parseFloat(n.toFixed(2));
};

export async function GET() {
    try {
        const user = await verifyAdmin();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Fetch all products in chunks of 1000 to bypass PostgREST row limit
        let all = [];
        let from = 0;
        const CHUNK = 1000;

        while (true) {
            const { data, error } = await supabaseAdmin
                .from('products')
                .select('*')
                .order('created_at', { ascending: false })
                .range(from, from + CHUNK - 1);

            if (error) throw error;
            if (!data || data.length === 0) break;
            all = all.concat(data);
            if (data.length < CHUNK) break;
            from += CHUNK;
        }

        const cols = [
            { label: 'Stok Kodu',                      key: 'code' },
            { label: 'OEM No',                          key: 'oem_no' },
            { label: 'Ürün Adı',                        key: 'name' },
            { label: 'Marka',                           key: 'brand' },
            { label: 'Ürünün Alındığı Firma (GİZLİ)',   key: 'supplier_brand' },
            { label: 'Araç Markası',                    key: 'car_brand' },
            { label: 'Araç Modeli',                     key: 'car_model' },
            { label: 'Kategori',                        key: 'category' },
            { label: 'Para Birimi',                     key: 'currency' },
            { label: 'Geliş Fiyatı',                   key: 'cost_price',          fmt: fmt2 },
            { label: 'Kâr Oranı (%)',                   key: 'profit_margin',       fmt: fmt2 },
            { label: 'Liste Fiyatı',                    key: 'list_price',          fmt: fmt2 },
            { label: 'İskonto Oranı (%)',               key: 'discount_rate',       fmt: fmt2 },
            { label: 'Sepette İndirim (%)',             key: 'cart_discount_rate',  fmt: fmt2 },
            { label: 'Birim',                           key: 'unit' },
            { label: 'Koli Adeti',                      key: 'box_quantity' },
            { label: 'İstanbul Stok',                   key: 'stock_merkez' },
            { label: 'Depo Stok',                       key: 'stock_depo' },
            { label: 'Kampanyalı mı',                   key: 'is_campaign',         fmt: v => v ? 'Evet' : 'Hayır' },
            { label: 'Sabit Fiyatlı mı',               key: 'is_fixed_price',      fmt: v => v ? 'Evet' : 'Hayır' },
            { label: 'Sabit Fiyat Değeri',             key: 'fixed_price_value',   fmt: fmt2 },
            { label: 'Sabit Fiyat Dövizi',             key: 'fixed_price_currency' },
            { label: 'Durum',                           key: 'is_active',           fmt: v => v ? 'Aktif' : 'Pasif' },
            { label: 'Açıklama',                        key: 'description' },
            { label: 'Görsel URL',                      key: 'image_url' },
        ];

        const header = cols.map(c => c.label);
        const rows = all.map(p =>
            cols.map(c => {
                const raw = p[c.key];
                return c.fmt ? c.fmt(raw) : (raw ?? '');
            })
        );

        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

        // Auto column widths
        const colWidths = header.map((h, i) => {
            const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length));
            return { wch: Math.min(maxLen + 2, 50) };
        });
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Ürünler');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
        return new NextResponse(buf, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="Urunler_${dateStr}.xlsx"`,
            },
        });

    } catch (e) {
        console.error('Export error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
