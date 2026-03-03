import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const response = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', {
            // Add a cache revalidation time to avoid fetching on every hit, e.g., every 15 mins (900s)
            next: { revalidate: 900 }
        });

        if (!response.ok) {
            throw new Error(`TCMB API error: ${response.status}`);
        }

        const xmlText = await response.text();

        // Basic Regex parsing for USD and EUR Selling Rates
        // XML structure example:
        // <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">...<ForexSelling>18.1234</ForexSelling>...

        // Extract USD ForexSelling
        const usdMatch = xmlText.match(/<Currency[^>]*Kod="USD"[^>]*>[\s\S]*?<ForexSelling>([\d.]+)<\/ForexSelling>/);
        const usdRate = usdMatch ? parseFloat(usdMatch[1]).toFixed(2) : null;

        // Extract EUR ForexSelling
        const eurMatch = xmlText.match(/<Currency[^>]*Kod="EUR"[^>]*>[\s\S]*?<ForexSelling>([\d.]+)<\/ForexSelling>/);
        const eurRate = eurMatch ? parseFloat(eurMatch[1]).toFixed(2) : null;

        return NextResponse.json({
            USD: usdRate,
            EUR: eurRate,
            source: 'tcmb'
        });

    } catch (error) {
        console.error('TCMB fetch helper error:', error);
        return NextResponse.json({ error: 'Failed to fetch rates' }, { status: 500 });
    }
}
