export async function getExchangeRates() {
    try {
        const response = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', {
            next: { revalidate: 900 } // Cache for 15 mins
        });

        if (!response.ok) {
            console.error(`TCMB API error: ${response.status}`);
            return { USD: null, EUR: null };
        }

        const xmlText = await response.text();

        // Extract USD ForexSelling
        const usdMatch = xmlText.match(/<Currency[^>]*Kod="USD"[^>]*>[\s\S]*?<ForexSelling>([\d.]+)<\/ForexSelling>/);
        const usdRate = usdMatch ? parseFloat(usdMatch[1]).toFixed(2) : null;

        // Extract EUR ForexSelling
        const eurMatch = xmlText.match(/<Currency[^>]*Kod="EUR"[^>]*>[\s\S]*?<ForexSelling>([\d.]+)<\/ForexSelling>/);
        const eurRate = eurMatch ? parseFloat(eurMatch[1]).toFixed(2) : null;

        return { USD: usdRate, EUR: eurRate };

    } catch (error) {
        console.error('TCMB fetch helper error:', error);
        return { USD: null, EUR: null };
    }
}
