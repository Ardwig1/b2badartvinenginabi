import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req) {
    try {
        const body = await req.json();
        const requestBody = body.requestBody; // Pass exactly what we want to send

        const url = process.env.TOSLA_API_BASE_URL + '/Payment/threeDPayment';
        const res = await fetch(url, { 
            method: 'POST', 
            body: JSON.stringify(requestBody), 
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            } 
        });
        
        const headersObj = {};
        res.headers.forEach((v, k) => headersObj[k] = v);

        const text = await res.text();
        return NextResponse.json({ ok: res.ok, status: res.status, headers: headersObj, text: text });
    } catch(e) {
        return NextResponse.json({ error: e.message, str: String(e) });
    }
}
