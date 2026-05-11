import { NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get('url');

    if (!fileUrl) {
        return new NextResponse('Eksik URL', { status: 400 });
    }

    let key = fileUrl;
    if (fileUrl.includes('.r2.dev/')) {
        key = fileUrl.split('.r2.dev/')[1];
    } else if (fileUrl.includes('invoices/')) {
        key = 'invoices/' + fileUrl.split('invoices/')[1];
    }

    try {
        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
        });

        const response = await s3Client.send(command);

        // Web Stream format for Next.js Edge / Route Handlers
        const stream = response.Body?.transformToWebStream ? response.Body.transformToWebStream() : response.Body;

        return new NextResponse(stream, {
            headers: {
                'Content-Type': response.ContentType || 'application/pdf',
                'Content-Disposition': `inline; filename="${key.split('/').pop()}"`,
                'Cache-Control': 'public, max-age=86400',
            },
        });
    } catch (error) {
        console.error('File proxy fetch error (R2):', error);
        return new NextResponse('Dosya bulunamadı veya güvenli bağlantıya izin verilmiyor.', { status: 404 });
    }
}
