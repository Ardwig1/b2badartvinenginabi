import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const body = await req.json();
        const { threeDSessionId, cardHolderName, cardNumber, expireMonth, expireYear, cvv } = body;

        const BASE_URL = process.env.TOSLA_API_BASE_URL;

        if (!BASE_URL) {
            return NextResponse.json({ error: 'Ödeme sistemi ayarları eksik (Base URL).' }, { status: 500 });
        }

        // ProcessCardForm requires x-www-form-urlencoded
        const formData = new URLSearchParams();
        formData.append('ThreeDSessionId', threeDSessionId);
        formData.append('CardHolderName', cardHolderName);
        formData.append('CardNo', cardNumber.replace(/\s/g, ''));
        // Make sure it is MM/YY format specifically
        formData.append('ExpireDate', `${String(expireMonth).padStart(2, '0')}/${String(expireYear).slice(-2)}`);
        formData.append('Cvv', cvv);

        const response = await fetch(`${BASE_URL}/Payment/ProcessCardForm`, {
            method: 'POST',
            body: formData,
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        const responseText = await response.text();
        console.log(`Tosla ProcessCardForm Response Status: ${response.status} ${response.statusText}`);

        // According to documentation, successful ProcessCardForm likely returns an HTML 
        // with an auto-submitting form targeting the 3D secure bank page, or JSON if an error occurred.
        if (response.ok) {
            // We assume it's HTML if successful or a specific JSON format
            let jsonData = null;
            try {
                jsonData = JSON.parse(responseText);
            } catch(e) {
                // Not JSON, probably HTML. Perfect.
            }

            // Tosla error format could be isSuccess=false or Code != 0
            if (jsonData && (jsonData.isSuccess === false || (jsonData.Code !== undefined && jsonData.Code !== 0))) {
                 return NextResponse.json({ error: jsonData.Message || jsonData.message || 'Kart işlemi başarısız', details: jsonData }, { status: 400 });
            }

            // Return the HTML payload back to the frontend to render the iframe/3D redirect
            return NextResponse.json({ success: true, data: responseText });
        } else {
             return NextResponse.json({ error: 'Banka işlem formunda hata', details: responseText }, { status: response.status });
        }
        
    } catch (error) {
        console.error('Payment process error:', error);
        return NextResponse.json({ error: 'Sunucu hatası oluştu.', details: String(error), stack: error.stack }, { status: 500 });
    }
}
