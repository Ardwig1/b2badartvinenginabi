import crypto from 'crypto';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // e.g. https://pub-xxx.r2.dev
const R2_ENDPOINT = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// Helper to calculate SHA256 of a buffer
function getDigest(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

// AWS V4 Signer logic embedded
function getAuthHeader(method, host, path, payloadHash, dateStr, amzDate) {
    const region = 'auto';
    const service = 's3';

    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = `${method}\n/${R2_BUCKET_NAME}/${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStr}/${region}/${service}/aws4_request`;

    const hashedCanonicalRequest = getDigest(Buffer.from(canonicalRequest, 'utf8'));
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${hashedCanonicalRequest}`;

    const kDate = crypto.createHmac('sha256', `AWS4${R2_SECRET_ACCESS_KEY}`).update(dateStr).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

    return `${algorithm} Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

export async function uploadToR2(buffer, fileName, contentType = 'image/webp') {
    if (!R2_ACCOUNT_ID || !R2_BUCKET_NAME) {
        throw new Error('Cloudflare R2 bilgileri .env dosyasına eklenmemiş.');
    }

    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_'); // Dosya ismini güvenli hale getir

    const payloadHash = getDigest(buffer);
    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStr = amzDate.substring(0, 8);

    const authHeader = getAuthHeader('PUT', R2_ENDPOINT, cleanFileName, payloadHash, dateStr, amzDate);

    console.log(`Sending R2 Request: https://${R2_ENDPOINT}/${R2_BUCKET_NAME}/${cleanFileName}`);
    const response = await fetch(`https://${R2_ENDPOINT}/${R2_BUCKET_NAME}/${cleanFileName}`, {
        method: 'PUT',
        headers: {
            'Host': R2_ENDPOINT,
            'x-amz-date': amzDate,
            'x-amz-content-sha256': payloadHash,
            'Authorization': authHeader,
            'Content-Type': contentType,
        },
        body: buffer,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`R2 Yükleme Başarısız: ${response.status} - ${text}`);
    }

    // Return the public URL
    return `${R2_PUBLIC_URL}/${cleanFileName}`;
}

export async function deleteFromR2(fileName) {
    if (!fileName || !R2_BUCKET_NAME) return false;

    // Extract key from URL if a full URL is provided
    let key = fileName;
    if (fileName.startsWith('http')) {
        const parts = fileName.split('/');
        key = parts[parts.length - 1];
    }

    const payloadHash = getDigest(Buffer.from(''));
    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStr = amzDate.substring(0, 8);

    const authHeader = getAuthHeader('DELETE', R2_ENDPOINT, key, payloadHash, dateStr, amzDate);

    try {
        const response = await fetch(`https://${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`, {
            method: 'DELETE',
            headers: {
                'Host': R2_ENDPOINT,
                'x-amz-date': amzDate,
                'x-amz-content-sha256': payloadHash,
                'Authorization': authHeader,
            }
        });

        return response.ok;
    } catch (error) {
        console.error('R2 Silme Hatası:', error);
        return false;
    }
}
