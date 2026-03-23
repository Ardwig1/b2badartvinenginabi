import { NextResponse } from 'next/server';
import util from 'util';

export async function GET() {
    try {
        const url = process.env.TOSLA_API_BASE_URL + '/Payment/threeDPayment';
        const res = await fetch(url, { 
            method: 'POST', 
            body: '{}', 
            headers: { 'Content-Type': 'application/json' } 
        });
        const text = await res.text();
        return NextResponse.json({ ok: res.ok, status: res.status, text: text.slice(0,100) });
    } catch(e) {
        return NextResponse.json({ 
             error: e.message, 
             causeMessage: e.cause?.message,
             causeCode: e.cause?.code,
             causeStr: util.inspect(e.cause)
        });
    }
}
