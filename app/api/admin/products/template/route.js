import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth/admin';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const user = await verifyAdmin();
        if (!user) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

        const headers = [
            'Stok Kodu',
            'Ürün Adı',
            'OEM No',
            'Marka',
            'Araç Markası',
            'Araç Modeli',
            'Kategori',
            'Para Birimi',
            'Birim',
            'Koli Adeti',
            'İstanbul Stok',
            'Depo Stok',
            'Geliş Fiyatı',
            'Kâr Oranı (%)',
            'Liste Fiyatı',
            'İskonto Oranı (%)',
            'Sepette İndirim (%)',
            'Açıklama',
            'Görsel URL',
            'Durum',
        ];

        // Example row to guide the admin
        const exampleRow = {
            'Stok Kodu': 'ORNEK001',
            'Ürün Adı': 'Örnek Ürün Adı',
            'OEM No': '12345-ABC',
            'Marka': 'ARTPAR',
            'Araç Markası': 'RENAULT',
            'Araç Modeli': 'CLIO 5',
            'Kategori': 'Fren',
            'Para Birimi': 'TRY',
            'Birim': 'adet',
            'Koli Adeti': 1,
            'İstanbul Stok': 10,
            'Depo Stok': 0,
            'Geliş Fiyatı': 100,
            'Kâr Oranı (%)': 30,
            'Liste Fiyatı': 130,
            'İskonto Oranı (%)': 0,
            'Sepette İndirim (%)': 0,
            'Açıklama': '',
            'Görsel URL': '',
            'Durum': 'Aktif',
        };

        const ws = XLSX.utils.json_to_sheet([exampleRow], { header: headers });

        // Column widths
        ws['!cols'] = [
            { wch: 15 }, // Stok Kodu
            { wch: 40 }, // Ürün Adı
            { wch: 15 }, // OEM No
            { wch: 15 }, // Marka
            { wch: 15 }, // Araç Markası
            { wch: 20 }, // Araç Modeli
            { wch: 15 }, // Kategori
            { wch: 12 }, // Para Birimi
            { wch: 10 }, // Birim
            { wch: 12 }, // Koli Adeti
            { wch: 14 }, // İstanbul Stok
            { wch: 12 }, // Depo Stok
            { wch: 14 }, // Geliş Fiyatı
            { wch: 14 }, // Kâr Oranı
            { wch: 14 }, // Liste Fiyatı
            { wch: 16 }, // İskonto Oranı
            { wch: 18 }, // Sepette İndirim
            { wch: 30 }, // Açıklama
            { wch: 40 }, // Görsel URL
            { wch: 10 }, // Durum
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Ürünler');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(buf, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="Urun_Yukleme_Sablonu.xlsx"',
                'Cache-Control': 'no-store',
            },
        });
    } catch (e) {
        console.error('Template error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
