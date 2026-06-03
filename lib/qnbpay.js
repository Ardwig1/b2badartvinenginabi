import crypto from 'crypto';

const BASE_URL = 'https://portal.qnbpay.com.tr/ccpayment';

/** Hash key oluşturma (PHP openssl_encrypt ile birebir uyumlu) */
export function generateHashKey(data, appSecret) {
    const iv   = crypto.createHash('sha1').update(Math.random().toString()).digest('hex').slice(0, 16);
    const salt = crypto.createHash('sha1').update(Math.random().toString()).digest('hex').slice(0, 8);
    const password = crypto.createHash('sha1').update(appSecret).digest('hex');
    const saltWithPassword = crypto.createHash('sha256').update(password + salt).digest('hex');

    // AES-256-CBC: key = ilk 32 byte, iv = 16 byte string
    const key = Buffer.from(saltWithPassword.slice(0, 32), 'utf8');
    const ivBuf = Buffer.from(iv, 'utf8');

    const cipher = crypto.createCipheriv('aes-256-cbc', key, ivBuf);
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    let bundle = `${iv}:${salt}:${encrypted}`;
    bundle = bundle.replace(/\//g, '__');
    return bundle;
}

/** Hash key doğrulama (callback'ten gelen hash_key'i çöz) */
export function validateHashKey(hashKey, appSecret) {
    try {
        hashKey = hashKey.replace(/__/g, '/');
        const password = crypto.createHash('sha1').update(appSecret).digest('hex');
        const parts = hashKey.split(':');
        if (parts.length < 3) return null;

        const iv   = parts[0];
        const salt = parts[1];
        const encryptedMsg = parts.slice(2).join(':');

        const saltWithPassword = crypto.createHash('sha256').update(password + salt).digest('hex');
        const key = Buffer.from(saltWithPassword.slice(0, 32), 'utf8');
        const ivBuf = Buffer.from(iv, 'utf8');

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, ivBuf);
        let decrypted = decipher.update(encryptedMsg, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        const [status, total, invoiceId, orderId, currencyCode] = decrypted.split('|');
        return { status, total, invoiceId, orderId, currencyCode };
    } catch {
        return null;
    }
}

/** Bearer token al (2 saat geçerli) */
export async function getQnbpayToken(appId, appSecret) {
    const res = await fetch(`${BASE_URL}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret })
    });
    const data = await res.json();
    if (!data?.data?.token) throw new Error(data?.message || 'Token alınamadı');
    return data.data.token;
}

/** QNBpay ödeme linki oluştur */
export async function createPaymentLink({ token, merchantKey, appSecret, invoiceId, amount, returnUrl, cancelUrl, name, surname, items }) {
    const productItems = items || [{ name: 'Bakiye Yükleme', price: String(amount), quantity: 1, description: 'Cari hesap bakiyesi' }];

    // invoice alanları nested "invoice" objesi içinde gönderilmeli
    const body = {
        merchant_key: merchantKey,
        currency_code: 'TRY',
        invoice: {
            invoice_id: invoiceId,
            invoice_description: `B2B Hesap Ödemesi - ${invoiceId}`,
            total: String(amount),
            return_url: returnUrl,
            cancel_url: cancelUrl,
            response_method: 'GET',
            items: productItems
        },
        name: name || 'B2B',
        surname: surname || 'Musteri',
        is_comission_from_user: 0,
        selected_installments: [1]
    };

    console.log('[QNBpay] purchase/link body:', JSON.stringify(body));

    const res = await fetch(`${BASE_URL}/purchase/link`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    console.log('[QNBpay] purchase/link response:', JSON.stringify(data));
    return data;
}
