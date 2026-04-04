import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function htmlRedirect(url) {
    return new NextResponse(
        `<html><body><script>window.top.location.href = "${url}";</script>Yönlendiriliyorsunuz...</body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
    );
}

async function handleCallback(req, isGet) {
    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://b2b.omigroups.com';

    try {
        const fields = {};

        if (isGet) {
            req.nextUrl.searchParams.forEach((v, k) => { fields[k.toLowerCase()] = v; });
        } else {
            try {
                const formData = await req.formData();
                formData.forEach((v, k) => { fields[k.toLowerCase()] = String(v); });
            } catch (_) {
                try {
                    const text = await req.text();
                    new URLSearchParams(text).forEach((v, k) => { fields[k.toLowerCase()] = v; });
                } catch (__) {}
            }
        }

        const cidParam = req.nextUrl?.searchParams?.get('cid') ?? fields['cid'] ?? '';
        const orderId  = fields['orderid'] ?? fields['order_id'] ?? '';
        let amount   = parseFloat(fields['amount'] ?? '0') || 0;

        // Log for debugging
        console.log('[Tosla CB] isGet:', isGet, '| cid:', cidParam, '| orderId:', orderId);
        console.log('[Tosla CB] All fields:', JSON.stringify(fields));

        // ──────────────────────────────────────────────────────────────
        // SUCCESS RULE:
        //   BankResponseCode === "00"  →  KESINLIKLE BAŞARILI
        //   AuthCode non-empty         →  BAŞARILI
        //   Hiçbir şey yoksa (Tosla bazen sadece redirect eder) → BAŞARILI say
        //   BankResponseCode VARSA ve "00" DEĞİLSE → BAŞARISIZ
        // ──────────────────────────────────────────────────────────────
        const bankCode  = (fields['bankresponsecode'] ?? '').trim();
        const authCode  = (fields['authcode']         ?? '').trim();
        const procCode  = (fields['procreturncode']   ?? '').trim();

        let isSuccess;
        if (bankCode === '00' || procCode === '00' || authCode !== '') {
            // Explicit bank approval
            isSuccess = true;
        } else if (bankCode !== '' || procCode !== '') {
            // Explicit non-zero bank code = rejected
            isSuccess = false;
        } else {
            // No bank code at all — assume success (Tosla redirected without body)
            isSuccess = true;
        }

        console.log('[Tosla CB] bankCode:', bankCode, '| authCode:', authCode, '| procCode:', procCode, '| isSuccess:', isSuccess);

        if (isSuccess) {
            // Retrieve company ID securely from user_activities (acting as payment_sessions)
            let finalCid = cidParam;
            const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

            let context = '';
            if (orderId) {
                const { data: act } = await supabase.from('user_activities')
                    .select('company_id, details')
                    .eq('action_type', 'payment_init')
                    .contains('details', { orderId: orderId })
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                if (act?.company_id && !finalCid) finalCid = act.company_id;
                if (act?.details?.context) context = act.details.context;
                
                // If amount is 0 (Tosla didn't return it), fetch it from our secure DB.
                // Tosla amountLong was saved in kurus (120 = 1.20 TL)
                if (act?.details?.amount !== undefined && amount === 0) {
                    amount = parseFloat(act.details.amount) / 100;
                }
            }

            // Credit the company account natively 
            if (finalCid) {
                try {
                    // CRITICAL FIX: The previous logic (amount > 500 ? amount / 100 : amount) was wrong.
                    // Tosla returns the same format we sent them.
                    // Let's use the amount directly from Tosla first, but verify it against our init log.
                    let tlAmount = amount;

                    console.log('[Tosla CB] Raw amount from gateway:', amount);

                    if (orderId) {
                        const { data: initAct } = await supabase.from('user_activities')
                            .select('details')
                            .eq('action_type', 'payment_init')
                            .contains('details', { orderId: orderId })
                            .maybeSingle();
                        
                        if (initAct?.details?.amount) {
                            // In init, we sent amountLong in kurus (e.g. 587100)
                            const expectedTl = parseFloat(initAct.details.amount) / 100;
                            
                            // If the gateway sent back a huge number (like 587100), it's kurus.
                            // If it sent back 5871, it's TL.
                            if (tlAmount > expectedTl * 50) { // Safety margin
                                tlAmount = tlAmount / 100;
                            }
                            
                            console.log('[Tosla CB] Expected TL from init:', expectedTl, 'Verified TL:', tlAmount);
                        }
                    }

                    console.log('[Tosla CB] Final Crediting', tlAmount, 'TL to company', finalCid);

                    // Fetch balance
                    const { data: comp } = await supabase.from('companies').select('current_balance').eq('id', finalCid).single();
                    const oldBalance = comp?.current_balance || 0;
                    
                    // In our system, placing an order subtracts from balance.
                    // Paying adds back to the balance.
                    const newBalance = oldBalance + tlAmount;

                    // Update Balance
                    await supabase.from('companies').update({ current_balance: newBalance }).eq('id', finalCid);

                    // Create transaction record
                    await supabase.from('account_transactions').insert({
                        company_id: finalCid,
                        transaction_type: 'TAHSİLAT (K.KARTI)',
                        document_no: orderId || 'TOSLA',
                        description: 'Tosla Online Ödeme',
                        debt: 0,
                        credit: tlAmount,
                        balance_after: newBalance
                    });

                } catch (e) {
                    console.error('[Tosla CB] Payment record error (non-fatal):', e.message);
                }
            } else {
                console.error('[Tosla CB] Could not map finalCid for order:', orderId);
            }
            if (context === 'cart') {
                return htmlRedirect(`${SITE_URL}/dashboard/cart?autoSubmit=true`);
            }
            return htmlRedirect(`${SITE_URL}/dashboard/payment/result?status=success&orderId=${encodeURIComponent(orderId)}`);
        } else {
            const errMsg = fields['bankresponsemessage'] ?? fields['errormessage'] ?? `İşlem reddedildi (${bankCode})`;
            console.error('[Tosla CB] Payment rejected. bankCode:', bankCode, '| msg:', errMsg);
            
            try {
                const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
                await supabase.from('user_activities').insert({
                    company_id: cidParam || null,
                    action_type: 'payment_failed',
                    details: { fields, bankCode, errMsg }
                });
            } catch (e) {
                console.error('[Tosla CB] Failed to log error:', e.message);
            }

            return htmlRedirect(`${SITE_URL}/dashboard/payment/result?status=error&message=${encodeURIComponent(errMsg)}`);
        }

    } catch (err) {
        console.error('[Tosla CB] Fatal error:', err.message);
        return htmlRedirect(`${SITE_URL}/dashboard/payment/result?status=error&message=${encodeURIComponent('Sistem hatası')}`);
    }
}

export async function POST(req) { return handleCallback(req, false); }
export async function GET(req)  { return handleCallback(req, true);  }
