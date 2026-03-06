import crypto from 'crypto';

export function signS3v4(method, urlStr, region, service, accessKeyId, secretAccessKey, payloadHash, headers) {
    const url = new URL(urlStr);
    const date = new Date();

    // Format dates
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    // Add required headers
    headers['x-amz-date'] = amzDate;
    headers['host'] = url.host;
    if (payloadHash) {
        headers['x-amz-content-sha256'] = payloadHash;
    }

    // 1. Create Canonical Request
    const canonicalUri = url.pathname;
    const canonicalQueryString = ''; // assuming no query strings for simple PUT

    const signedHeadersList = Object.keys(headers).map(k => k.toLowerCase()).sort();
    const canonicalHeaders = signedHeadersList.map(k => `${k}:${headers[k]}\n`).join('');
    const signedHeaders = signedHeadersList.join(';');

    const canonicalRequest = [
        method,
        canonicalUri,
        canonicalQueryString,
        canonicalHeaders,
        signedHeaders,
        payloadHash
    ].join('\n');

    // 2. Create String to Sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex');

    const stringToSign = [
        algorithm,
        amzDate,
        credentialScope,
        hashedCanonicalRequest
    ].join('\n');

    // 3. Calculate Signature
    const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

    // 4. Add Authorization Header
    headers['Authorization'] = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return headers;
}
