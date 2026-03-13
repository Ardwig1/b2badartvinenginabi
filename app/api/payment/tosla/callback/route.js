import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const API_PASS = process.env.TOSLA_API_PASS;

export async function POST(req) {
    try {
        // Tosla usually posts data via form urlencoded on 3D callback
        const formData = await req.formData();
        
        const status = formData.get('status');
        const orderId = formData.get('orderId');
        const amount = formData.get('amount');
        const hashParams = formData.get('hashParams'); // Usually provided by the pos
        const hashParamsVal = formData.get('hashParamsVal'); // The given hash value
        const errorMessage = formData.get('errorMessage');

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        if (status === '1' || status === 'success') {
            // Hash validation - usually ApiPass + HashParams values
            // The exact string to hash depends on the pos but it is often sent back in the POST
            
            // let stringToHash = API_PASS + hashParams;
            // let generatedHash = crypto.createHash('sha512').update(stringToHash).digest('base64');
            // if(generatedHash !== hashParamsVal) { return redirect('/dashboard/payment/result?status=hash_error'); }

            // Here we would find the user associated with this order ID and update their balance/create payment log.
            const paymentLog = {
                order_id: orderId,
                amount: parseFloat(amount),
                status: 'success',
                gateway: 'tosla',
                created_at: new Date().toISOString()
            };

            // Assuming a table exists like 'payments' (we will need to verify or create it)
            // await supabase.from('payments').insert(paymentLog);

            // Redirect user back to the success result page
            return NextResponse.redirect(new URL(`/dashboard/payment/result?status=success&orderId=${orderId}`, req.url));

        } else {
            console.error('Tosla Callback Error:', errorMessage);
            return NextResponse.redirect(new URL(`/dashboard/payment/result?status=error&message=${encodeURIComponent(errorMessage || 'Ödeme reddedildi.')}`, req.url));
        }

    } catch (error) {
        console.error('Callback parsing error:', error);
        return NextResponse.redirect(new URL(`/dashboard/payment/result?status=error&message=Sistem_hatasi`, req.url));
    }
}

// Bazen banka callback'u GET olarak da yönlendirebilir.
export async function GET(req) {
    return NextResponse.redirect(new URL(`/dashboard/payment/result?status=error&message=Gecersiz_istek`, req.url));
}
