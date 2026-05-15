import crypto from 'crypto';

async function testToslaJSONBrute() {
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
    const sess = initData.ThreeDSessionId;

    const variations = [
        {threeDSessionId: sess, cardHolderName: 'TEST USER', cardNo: '4546711234567894', expireDate: '12/26', cvv: '000'},
        {ThreeDSessionId: sess, CardHolderName: 'TEST USER', CardNo: '4546711234567894', ExpireDate: '12/26', Cvv: '000', Hash: hash},
        {threeDSessionId: sess, cardHolderName: 'TEST USER', cardNumber: '4546711234567894', expireMonth: '12', expireYear: '26', cvv: '000'},
        {ThreeDSessionId: sess, CardHolderName: 'TEST USER', CardNumber: '4546711234567894', ExpireMonth: '12', ExpireYear: '26', Cvv: '000'},
        {sessionId: sess, cardHolderName: 'TEST USER', cardNo: '4546711234567894', expireDate: '12/26', cvv: '000'},
        {ThreeDSessionId: sess, card: { holderName: 'TEST USER', cardNo: '4546711234567894', expireDate: '12/26', cvv: '000' } }
    ];

    for (let i = 0; i < variations.length; i++) {
        try {
            const res = await fetch('https://entegrasyon.tosla.com/api/Payment/ProcessCardForm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
                body: JSON.stringify(variations[i])
            });
            const text = await res.text();
            console.log(`Test JSON ${i+1}: Status:`, res.status, 'Body:', text);
        } catch(e) { console.error('Error on', i); }
    }
}
testToslaJSONBrute();
