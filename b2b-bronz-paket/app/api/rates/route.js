import { NextResponse } from 'next/server';
import { getExchangeRates } from '@/lib/tcmb';

// Prevent Vercel from aggressively caching empty/null rates
export const revalidate = 900;

export async function GET() {
    try {
        const rates = await getExchangeRates();

        return NextResponse.json({
            USD: rates.USD,
            EUR: rates.EUR,
            source: 'tcmb'
        });

    } catch (error) {
        console.error('TCMB fetch helper error:', error);
        return NextResponse.json({ error: 'Failed to fetch rates' }, { status: 500 });
    }
}
