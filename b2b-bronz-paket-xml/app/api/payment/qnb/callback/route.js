import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
    try {
        // QNB (Payfor) callback verilerini form-urlencoded olarak gönderir
        const formData = await req.formData();
        const params = Object.fromEntries(formData.entries());
        
        console.log('QNB Callback Received:', params);

        const {
            ResultCode,
            AuthCode,
            OrderId,
            Response,
            ProcReturnCode,
            TransId,
            HostMsg
        } = params;

        // URL'den gelen companyId (init kısmında OkUrl içine eklemiştik)
        // formData (POST body) içerisinde cid bulunmaz, URL üzerinden gelmelidir.
        const cid = req.nextUrl.searchParams.get('cid') || params.cid;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const isSuccess = ResultCode === '00' || ProcReturnCode === '00';

        if (isSuccess) {
            // ÖDEME BAŞARILI
            console.log(`Payment Success: ${OrderId}, Amount: ${params.PurchAmount}`);

            if (cid) {
                const amount = parseFloat(params.PurchAmount || 0);
                
                // 1. Cari Bakiyeyi Güncelle
                const { data: company, error: fetchErr } = await supabase
                    .from('companies')
                    .select('current_balance, name')
                    .eq('id', cid)
                    .single();

                if (company) {
                    const newBalance = (Number(company.current_balance) || 0) + amount;
                    
                    await supabase
                        .from('companies')
                        .update({ current_balance: newBalance })
                        .eq('id', cid);

                    // 2. Hesap Hareketi Ekle (Dekont)
                    await supabase.from('account_transactions').insert({
                        company_id: cid,
                        transaction_type: 'KREDİ KARTI',
                        document_no: OrderId,
                        description: `Sanal POS Ödemesi (QNB - ${TransId})`,
                        debt: 0,
                        credit: amount,
                        balance_after: newBalance
                    });

                    // 3. Aktivite Kaydı
                    await supabase.from('user_activities').insert({
                        company_id: cid,
                        action_type: 'payment_success',
                        details: { orderId: OrderId, amount, transId: TransId }
                    });
                }
            }

            return NextResponse.redirect(new URL(`/dashboard/payment/result?status=success&orderId=${OrderId}`, req.url), 303);
        } else {
            // ÖDEME BAŞARISIZ
            console.error(`Payment Failed: ${OrderId}, Error: ${HostMsg}`);
            
            if (cid) {
                await supabase.from('user_activities').insert({
                    company_id: cid,
                    action_type: 'payment_failed',
                    details: { orderId: OrderId, errMsg: HostMsg || Response }
                });
            }

            const errorMsg = encodeURIComponent(HostMsg || Response || 'Banka reddetti');
            return NextResponse.redirect(new URL(`/dashboard/payment/result?status=error&message=${errorMsg}&orderId=${OrderId}`, req.url), 303);
        }

    } catch (error) {
        console.error('QNB Callback Error:', error);
        return NextResponse.json({ error: 'Callback error' }, { status: 500 });
    }
}
