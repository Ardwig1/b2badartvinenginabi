import crypto from 'crypto';

async function testToslaMultipart() {
    const rnd = crypto.randomBytes(12).toString('hex');
    const now = new Date();
    now.setUTCHours(now.getUTCHours() + 3);
    const ts = now.getUTCFullYear() + String(now.getUTCMonth() + 1).padStart(2, '0') + String(now.getUTCDate()).padStart(2, '0') + String(now.getUTCHours()).padStart(2, '0') + String(now.getUTCMinutes()).padStart(2, '0') + String(now.getUTCSeconds()).padStart(2, '0');
    const hStr = 'Y0XBP1D4AE' + '1000006176' + 'apiUser3037726' + rnd + ts;
    const hash = crypto.createHash('sha512').update(hStr, 'utf8').digest('base64');

    const initRes = await fetch('https://entegrasyon.tosla.com/api/Payment/threeDPayment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            clientId: '1000006176',
            apiUser: 'apiUser3037726',
            rnd: rnd,
            timeSpan: ts,
            hash: hash,
            orderId: 'B2B_' + crypto.randomBytes(6).toString('hex'),
            amount: 1000,
            currency: '949',
            installmentCount: '1',
            callbackUrl: 'https://b2b.artpar.com/api/payment/tosla/callback',
            description: 'B2B Yedek Parca'
        })
    });
    
    const initData = await initRes.json();
    console.log('Init Sess:', initData.ThreeDSessionId);

    // Test form-data payload to ProcessCardForm
    const fd = new FormData();
    fd.append('ThreeDSessionId', initData.ThreeDSessionId);
    fd.append('CardHolderName', 'TEST USER');
    fd.append('CardNo', '4546711234567894');
    fd.append('ExpireDate', '12/26');
    fd.append('Cvv', '000');
    
    const formRes = await fetch('https://entegrasyon.tosla.com/api/Payment/ProcessCardForm', {
        method: 'POST',
        headers: { 
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json'
        },
        body: fd
    });
    console.log('Form Request returned Status:', formRes.status);
    const txt = await formRes.text();
    console.log('Text Length:', txt.length, 'Content:', txt.slice(0, 100));

    console.log('Dumping headers:', Object.fromEntries(formRes.headers.entries()));
}

testToslaMultipart();
