import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function getEffectiveCompanyId() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data: profile } = await adminSupabase.from('profiles').select('is_admin, company_id').eq('id', user.id).maybeSingle();

        const cookieStore = await cookies();
        const impId = cookieStore.get('impersonate_company_id')?.value;
        const isImpersonating = impId && impId !== 'undefined' && impId !== '';

        if (isImpersonating) {
            // Check if representative: 
            // 1. In metadata
            // 2. In customer_representatives table (more reliable after re-adds)
            const isRepMetadata = user.user_metadata?.role === 'representative';
            const { data: repRecord } = await adminSupabase
                .from('customer_representatives')
                .select('id')
                .eq('id', user.id)
                .maybeSingle();
            
            const isRep = isRepMetadata || !!repRecord;

            if (profile?.is_admin || isRep) return impId;
        }
        return profile?.company_id;
    } catch (e) {
        console.error("getEffectiveCompanyId Error:", e);
        return null;
    }
}

export async function POST(req) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data: profile } = await adminSupabase.from('profiles').select('is_admin, company_id').eq('id', user.id).maybeSingle();
        
        const cookieStore = await cookies();
        const impId = cookieStore.get('impersonate_company_id')?.value;
        const isImpersonating = impId && impId !== 'undefined' && impId !== '';

        const isRepMetadata = user.user_metadata?.role === 'representative';
        const { data: repRecord } = await adminSupabase
            .from('customer_representatives')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();
        const isRep = isRepMetadata || !!repRecord;
        const isPrivileged = profile?.is_admin || isRep;

        const companyId = (isImpersonating && isPrivileged) ? impId : profile?.company_id;
        if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { shippingAddress, note, totalAmount, items, bypassPrepayment, bypassRiskLimit } = body;

        const { data, error } = await adminSupabase.rpc('place_b2b_order', {
            p_company_id: companyId,
            p_shipping_address: shippingAddress,
            p_note: note,
            p_total_amount: totalAmount,
            p_items: items,
            p_bypass_prepayment: (isPrivileged && isImpersonating) ? !!bypassPrepayment : false,
            p_bypass_risk_limit: (isPrivileged && isImpersonating) ? !!bypassRiskLimit : false
        });

        if (error) throw error;

        // --- Mark Extra Discounts as USED ---
        try {
            const productIds = items.map(i => i.product_id);
            const { error: updErr } = await adminSupabase
                .from('company_extra_discounts')
                .update({ 
                    is_used: true, 
                    used_at: new Date().toISOString() 
                })
                .eq('company_id', companyId)
                .in('product_id', productIds)
                .eq('is_used', false);
            
            if (updErr) console.error("Error marking extra discounts used:", updErr);
        } catch (e) {
            console.error("Cleanup extra discounts error:", e);
        }

        // --- Send Admin Notification ---
        try {
            const { data: notifSetting } = await adminSupabase
                .from('site_settings')
                .select('setting_value')
                .eq('setting_key', 'admin_notifications')
                .maybeSingle();
            
            const settings = notifSetting?.setting_value;
            
            if (settings?.enabled && settings?.email) {
                const { data: company } = await adminSupabase
                    .from('companies')
                    .select('name, dealer_code')
                    .eq('id', companyId)
                    .maybeSingle();

                // Fetch product details for the email
                const productIds = items.map(i => i.product_id);
                const { data: products } = await adminSupabase
                    .from('products')
                    .select('id, name, code')
                    .in('id', productIds);
                
                const productMap = {};
                products?.forEach(p => { productMap[p.id] = p; });

                const itemsHtml = items.map(i => {
                    const p = productMap[i.product_id];
                    return `
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">
                                <strong>${p?.name || 'Bilinmeyen Ürün'}</strong><br/>
                                <small style="color: #666;">Kod: ${p?.code || i.product_id}</small>
                            </td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${i.quantity}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${Number(i.unit_price || i.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</td>
                        </tr>
                    `;
                }).join('');

                await sendEmail({
                    to: settings.email,
                    subject: `Yeni Sipariş: ${company?.name || 'Müşteri'} (#${data})`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                            <h2 style="color: #1e3a8a; margin-top: 0;">Yeni Sipariş Alındı!</h2>
                            <p style="font-size: 14px; color: #475569;">Sisteme yeni bir sipariş düştü. Detaylar aşağıdadır:</p>
                            
                            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <table style="width: 100%; font-size: 14px;">
                                    <tr><td><strong>Müşteri:</strong></td><td>${company?.name || 'Bilinmiyor'} (${company?.dealer_code || '-'})</td></tr>
                                    <tr><td><strong>Sipariş No:</strong></td><td>#${data}</td></tr>
                                    <tr><td><strong>Toplam Tutar:</strong></td><td style="color: #16a34a; font-weight: bold;">${Number(totalAmount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</td></tr>
                                    <tr><td><strong>Adres:</strong></td><td>${shippingAddress || 'Seçilmedi'}</td></tr>
                                    <tr><td><strong>Not:</strong></td><td>${note || '-'}</td></tr>
                                </table>
                            </div>

                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <thead style="background: #f1f5f9;">
                                    <tr>
                                        <th style="padding: 8px; text-align: left;">Ürün</th>
                                        <th style="padding: 8px; text-align: center;">Adet</th>
                                        <th style="padding: 8px; text-align: right;">Fiyat</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml}
                                </tbody>
                            </table>

                            <div style="margin-top: 30px; text-align: center;">
                                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin/orders" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">Siparişi Panelde Görüntüle</a>
                            </div>
                        </div>
                    `
                });
            }
        } catch (mailErr) {
            console.error("Error sending admin notification email:", mailErr);
        }

        return NextResponse.json(data);
    } catch (err) {
        console.error("CHECKOUT API ERROR:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
