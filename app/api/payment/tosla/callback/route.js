import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function htmlRedirect(url, showroomCid = null, isRep = false) {
    let finalUrl = url;
    if (showroomCid) {
        // If in showroom mode, we want the TOP window to go to the showroom wrapper,
        // but that wrapper should load our result URL in its iframe.
        const wrapperBase = isRep ? `/rep/showroom/${showroomCid}` : `/admin/showroom/${showroomCid}`;
        finalUrl = `${wrapperBase}?inner=${encodeURIComponent(url)}`;
    }

    return new NextResponse(
        `<html><body><script>window.top.location.href = "${finalUrl}";</script>Yönlendiriliyorsunuz...</body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
    );
}

async function handleCallback(req, isGet) {
    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://b2b.adartvin.com';
    const cookieStore = await cookies();
    const impCid = cookieStore.get('impersonate_company_id')?.value;
    
    // Create supabase client to check user role
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    let isRep = false;
    try {
        const { data: { user } } = await supabase.auth.getUser(cookieStore.get('sb-access-token')?.value || '');
        if (user?.user_metadata?.role === 'representative') {
            isRep = true;
        } else if (user) {
            const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
            if (profile?.is_admin) isRep = false;
        }
    } catch (e) {
        console.warn('[Tosla CB] User role check failed:', e.message);
    }

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

        const bankCode  = (fields['bankresponsecode'] ?? '').trim();
        const authCode  = (fields['authcode']         ?? '').trim();
        const procCode  = (fields['procreturncode']   ?? '').trim();

        let isSuccess;
        if (bankCode === '00' || procCode === '00' || authCode !== '') {
            isSuccess = true;
        } else if (bankCode !== '' || procCode !== '') {
            isSuccess = false;
        } else {
            isSuccess = true;
        }

        let finalCid = cidParam;
        let context = '';
        let isShowroomSession = false;

        // Fetch session data from DB (This is the source of truth)
        if (orderId) {
            const { data: act } = await supabase.from('user_activities')
                .select('company_id, details')
                .eq('action_type', 'payment_init')
                .contains('details', { orderId: orderId })
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            if (act?.company_id) finalCid = act.company_id;
            if (act?.details?.context) context = act.details.context;
            if (act?.details?.isShowroom) isShowroomSession = true;
            if (act?.details?.amount !== undefined && amount === 0) {
                amount = parseFloat(act.details.amount) / 100;
            }
        }

        // Final decision for showroom redirect: Use DB flag OR existing cookie
        const redirectCid = isShowroomSession ? finalCid : (impCid && impCid !== 'undefined' ? impCid : null);

        if (isSuccess) {
            if (finalCid) {
                try {
                    let tlAmount = amount;
                    const { data: comp } = await supabase.from('companies').select('current_balance').eq('id', finalCid).single();
                    const oldBalance = comp?.current_balance || 0;
                    const newBalance = oldBalance + tlAmount;
                    await supabase.from('companies').update({ current_balance: newBalance }).eq('id', finalCid);
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
                    console.error('[Tosla CB] Payment record error:', e.message);
                }
            }
            if (context === 'cart') {
                return htmlRedirect(`${SITE_URL}/dashboard/cart?autoSubmit=true`, redirectCid, isRep);
            }
            return htmlRedirect(`${SITE_URL}/dashboard/payment/result?status=success&orderId=${encodeURIComponent(orderId)}`, redirectCid, isRep);
        } else {
            const errMsg = fields['bankresponsemessage'] ?? fields['errormessage'] ?? `İşlem reddedildi (${bankCode})`;
            try {
                await supabase.from('user_activities').insert({
                    company_id: finalCid || null,
                    action_type: 'payment_failed',
                    details: { fields, bankCode, errMsg }
                });
            } catch (e) {}
            return htmlRedirect(`${SITE_URL}/dashboard/payment/result?status=error&message=${encodeURIComponent(errMsg)}`, redirectCid, isRep);
        }
    } catch (err) {
        console.error('[Tosla CB] Fatal error:', err.message);
        const cookieStore = await cookies();
        const impCid = cookieStore.get('impersonate_company_id')?.value;
        return htmlRedirect(`${SITE_URL}/dashboard/payment/result?status=error&message=${encodeURIComponent('Sistem hatası')}`, impCid);
    }
}

export async function POST(req) { return handleCallback(req, false); }
export async function GET(req)  { return handleCallback(req, true);  }
