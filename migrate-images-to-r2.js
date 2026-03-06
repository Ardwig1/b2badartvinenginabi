process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import dotenv from 'dotenv';
import path from 'path';
import https from 'https';
import crypto from 'crypto';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/"/g, '').trim();
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI';
const supabase = createClient(supabaseUrl, supabaseKey);

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID?.replace(/"/g, '');
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID?.replace(/"/g, '');
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY?.replace(/"/g, '');
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME?.replace(/"/g, '');
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/"/g, '');
const R2_ENDPOINT = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// Bypass completely
const agent = new https.Agent({ rejectUnauthorized: false });

// Helper to calculate SHA256 of a buffer
function getDigest(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

// AWS V4 Signer logic embedded
function getAuthHeader(method, host, keyPath, payloadHash, dateStr, amzDate) {
    const region = 'auto';
    const service = 's3';

    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    // IMPORTANT: Path must not contain double slashes leading up to the bucket.
    const canonicalRequest = `${method}\n/${R2_BUCKET_NAME}/${keyPath}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

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

async function uploadToR2Raw(fileName, buffer) {
    return new Promise((resolve, reject) => {
        const payloadHash = getDigest(buffer);
        const date = new Date();
        const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
        const dateStr = amzDate.substring(0, 8);

        const authHeader = getAuthHeader('PUT', R2_ENDPOINT, fileName, payloadHash, dateStr, amzDate);

        const options = {
            hostname: R2_ENDPOINT,
            path: `/${R2_BUCKET_NAME}/${fileName}`,
            method: 'PUT',
            agent: agent, // EXPLICITLY TELL NODE TO IGNORE TLS
            headers: {
                'Host': R2_ENDPOINT,
                'x-amz-date': amzDate,
                'x-amz-content-sha256': payloadHash,
                'Authorization': authHeader,
                'Content-Type': 'image/webp',
                'Content-Length': buffer.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve();
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(buffer);
        req.end();
    });
}

async function downloadFromSupabase(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { agent: agent }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Handle redirect if any
                https.get(res.headers.location, { agent: agent }, (redirectRes) => {
                    const data = [];
                    redirectRes.on('data', (chunk) => data.push(chunk));
                    redirectRes.on('end', () => resolve(Buffer.concat(data)));
                }).on('error', reject);
                return;
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            const data = [];
            res.on('data', (chunk) => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', (e) => reject(e));
    });
}


async function migrateImages() {
    console.log('--- Resim Göçü Başlıyor (Native HTTPS Bypass) ---');

    const { data: products, error } = await supabase.from('products').select('*').not('image_url', 'is', null).neq('image_url', '');
    if (error) { console.error('Hata:', error); return; }

    console.log(`Toplam ${products.length} adet resimli ürün bulundu.`);

    let successCount = 0;
    let failCount = 0;

    for (const product of products) {
        try {
            const oldUrl = product.image_url;
            if (oldUrl.includes('r2.dev') || oldUrl.includes('cloudflarestorage')) continue;

            console.log(`\nİşleniyor: ${product.code} (${oldUrl})`);

            // 1. Download
            const buffer = await downloadFromSupabase(oldUrl);
            console.log(`  --> Resim İndirildi: ${(buffer.length / 1024).toFixed(1)} KB`);

            // 2. Sharp Optimize
            const optimizedBuffer = await sharp(buffer).resize(1080, 1080, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
            console.log(`  --> Sıkıştırıldı: ${(optimizedBuffer.length / 1024).toFixed(1)} KB`);

            // 3. Upload to R2 manually
            const cleanName = product.code ? product.code.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase() : 'product';
            const newFileName = `products/migrated-${Date.now()}-${cleanName}.webp`;

            await uploadToR2Raw(newFileName, optimizedBuffer);

            const newUrl = `${R2_PUBLIC_URL}/${newFileName}`;
            console.log(`  --> R2'ye Yüklendi: ${newUrl}`);

            // 4. Update DB
            await supabase.from('products').update({ image_url: newUrl }).eq('id', product.id);
            console.log(`  --> [BAŞARILI] Veritabanı güncellendi.`);
            successCount++;
        } catch (err) {
            console.error(`  --> [HATA] ${product.code}:`, err.message);
            failCount++;
        }
    }

    console.log('\n--- Göç Tamamlandı ---');
    console.log(`Başarılı: ${successCount} | Başarısız: ${failCount}`);
}

migrateImages();
