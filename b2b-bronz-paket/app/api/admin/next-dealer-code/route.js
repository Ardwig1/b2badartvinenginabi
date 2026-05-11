import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const city = searchParams.get('city')?.trim().toLocaleUpperCase('tr-TR');

        if (!city || city.length < 2) return NextResponse.json({ nextCode: '' });

        const supabase = await createClient();
        
        // 1. Get prefix (first 3 chars of city, ASCII friendly)
        let prefix = city.substring(0, 3)
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Basic accent removal
            .replace(/İ/g, 'I')
            .replace(/ı/g, 'i')
            .replace(/Ğ/g, 'G')
            .replace(/ğ/g, 'g')
            .replace(/Ü/g, 'U')
            .replace(/ü/g, 'u')
            .replace(/Ş/g, 'S')
            .replace(/ş/g, 's')
            .replace(/Ö/g, 'O')
            .replace(/ö/g, 'o')
            .replace(/Ç/g, 'C')
            .replace(/ç/g, 'c')
            .toUpperCase(); // Ensure final is uppercase ASCII

        // 2. Fetch all dealer codes for this city
        const { data: companies, error } = await supabase
            .from('companies')
            .select('dealer_code')
            .ilike('city', city);

        if (error) throw error;

        let maxNum = 1000; // Let's start from 1001 if no one exists

        if (companies && companies.length > 0) {
            let foundMatch = false;
            companies.forEach(c => {
                const code = c.dealer_code || '';
                const parts = code.split('-');
                if (parts.length === 2) {
                    const num = parseInt(parts[1]);
                    if (!isNaN(num)) {
                        foundMatch = true;
                        if (num > maxNum) maxNum = num;
                    }
                }
            });
            // If we found firms but none had the PREFIX-NUMBER format, 
            // still use 1000 as base.
        }

        const nextCode = `${prefix}-${maxNum + 1}`;
        return NextResponse.json({ nextCode });

    } catch (err) {
        console.error('Next dealer code error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
