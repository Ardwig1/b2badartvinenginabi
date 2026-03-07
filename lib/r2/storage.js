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
function getAuthHeader(method, host, path, payloadHash, dateStr, amzDate, accessKey, secretKey, bucketName) {
    const region = 'auto';
    const service = 's3';

    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = `${method}\n/${bucketName}/${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStr}/${region}/${service}/aws4_request`;

    const hashedCanonicalRequest = getDigest(Buffer.from(canonicalRequest, 'utf8'));
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${hashedCanonicalRequest}`;

    const kDate = crypto.createHmac('sha256', `AWS4${secretKey}`).update(dateStr).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

    return `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

export async function uploadToR2(buffer, fileName, contentType = 'image/webp', r2Config = null) {
    const accountId = r2Config?.accountId || R2_ACCOUNT_ID;
    const accessKeyId = r2Config?.accessKeyId || R2_ACCESS_KEY_ID;
    const secretAccessKey = r2Config?.secretAccessKey || R2_SECRET_ACCESS_KEY;
    const bucketName = r2Config?.bucketName || R2_BUCKET_NAME;
    const publicUrl = r2Config?.publicUrl || R2_PUBLIC_URL;

    if (!accountId || !bucketName) {
        throw new Error('Cloudflare R2 bilgileri .env dosyasına eklenmemiş.');
    }

    const endpoint = `${accountId}.r2.cloudflarestorage.com`;
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_'); // Dosya ismini güvenli hale getir

    const payloadHash = getDigest(buffer);
    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStr = amzDate.substring(0, 8);

    const authHeader = getAuthHeader('PUT', endpoint, cleanFileName, payloadHash, dateStr, amzDate, accessKeyId, secretAccessKey, bucketName);

    console.log(`Sending R2 Request: https://${endpoint}/${bucketName}/${cleanFileName}`);
    const response = await fetch(`https://${endpoint}/${bucketName}/${cleanFileName}`, {
        method: 'PUT',
        headers: {
            'Host': endpoint,
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

    return `${publicUrl}/${cleanFileName}`;
}

export async function deleteFromR2(fileName) {
    if (!fileName || !R2_BUCKET_NAME) return false;

    let key = fileName;
    if (fileName.startsWith('http')) {
        const parts = fileName.split('/');
        key = parts[parts.length - 1];
    }

    const endpoint = R2_ENDPOINT;
    const payloadHash = getDigest(Buffer.from(''));
    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStr = amzDate.substring(0, 8);

    const authHeader = getAuthHeader('DELETE', endpoint, key, payloadHash, dateStr, amzDate, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME);

    try {
        const response = await fetch(`https://${endpoint}/${R2_BUCKET_NAME}/${key}`, {
            method: 'DELETE',
            headers: {
                'Host': endpoint,
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
