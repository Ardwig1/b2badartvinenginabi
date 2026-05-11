const https = require('https');

https.get('https://www.tcmb.gov.tr/kurlar/today.xml', (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        // Extract USD ForexSelling
        const usdMatch = data.match(/<Currency[^>]*Kod="USD"[^>]*>[\s\S]*?<ForexSelling>([\d.]+)<\/ForexSelling>/);
        const usdRate = usdMatch ? parseFloat(usdMatch[1]).toFixed(2) : null;

        // Extract EUR ForexSelling
        const eurMatch = data.match(/<Currency[^>]*Kod="EUR"[^>]*>[\s\S]*?<ForexSelling>([\d.]+)<\/ForexSelling>/);
        const eurRate = eurMatch ? parseFloat(eurMatch[1]).toFixed(2) : null;

        console.log('--- TCMB TEST ---');
        console.log('USD Match:', usdRate);
        console.log('EUR Match:', eurRate);
    });

}).on("error", (err) => {
    console.log("Error: " + err.message);
});
