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
        const { shippingAddress, note, totalAmount, items, bypassPrepayment, bypassRiskLimit, paymentType } = body;

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

        // --- Payment Type kaydet ---
        try {
            const effectivePaymentType = paymentType || 'kart satış';
            // RPC'nin döndürdüğü order_id varsa direkt kullan, yoksa en son siparişi güncelle
            const orderId = data?.order_id || data?.id;
            if (orderId) {
                await adminSupabase.from('orders').update({ payment_type: effectivePaymentType }).eq('id', orderId);
            } else {
                // Fallback: şirketin en son siparişini güncelle
                const { data: latestOrder } = await adminSupabase
                    .from('orders')
                    .select('id')
                    .eq('company_id', companyId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (latestOrder?.id) {
                    await adminSupabase.from('orders').update({ payment_type: effectivePaymentType }).eq('id', latestOrder.id);
                }
            }
        } catch (ptErr) {
            console.error("Payment type kaydetme hatası (non-fatal):", ptErr);
        }

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
            console.log("🔔 Starting Admin Notification process...");
            const { data: notifSetting, error: settingErr } = await adminSupabase
                .from('site_settings')
                .select('setting_value')
                .eq('setting_key', 'admin_notifications')
                .maybeSingle();
            
            if (settingErr) console.error("❌ Database Error (Notification Setting):", settingErr);
            
            const settings = notifSetting?.setting_value;
            console.log("🛠️ Notification Settings:", settings);
            
            if (settings?.enabled && settings?.email) {
                console.log("📤 Preparing to send email to:", settings.email);
                const { data: company } = await adminSupabase
                    .from('companies')
                    .select('name, dealer_code')
                    .eq('id', companyId)
                    .maybeSingle();

                const { sendEmail } = await import('@/lib/mail');
                
                // Fetch product details for the email
                const productIds = items.map(i => i.product_id);
                const { data: products } = await adminSupabase
                    .from('products')
                    .select('id, name, code, oem_no')
                    .in('id', productIds);
                
                const productMap = {};
                products?.forEach(p => { productMap[p.id] = p; });

                const itemsHtml = items.map(i => {
                    const p = productMap[i.product_id];
                    return `
                        <tr>
                            <td style="padding: 10px 8px; border-bottom: 1px solid #eee;">
                                <div style="font-weight: 700; color: #1e293b; font-size: 14px;">${p?.name || 'Bilinmeyen Ürün'}</div>
                                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                                    Kod: ${p?.code || i.product_id} ${p?.oem_no ? `| OEM: ${p.oem_no}` : ''}
                                </div>
                            </td>
                            <td style="padding: 10px 8px; border-bottom: 1px solid #eee; text-align: center; color: #1e293b; font-weight: 600;">${i.quantity}</td>
                            <td style="padding: 10px 8px; border-bottom: 1px solid #eee; text-align: right; color: #1e293b; font-weight: 600;">${Number(i.unit_price || i.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</td>
                        </tr>
                    `;
                }).join('');

                const result = await sendEmail({
                    to: settings.email,
                    subject: `📢 Yeni Sipariş: ${company?.name || 'Müşteri'}`,
                    html: `
                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                            <div style="text-align: center; marginBottom: 20px;">
                                <h2 style="color: #1e3a8a; margin-top: 0; font-size: 24px;">Yeni Sipariş Alındı!</h2>
                                <div style="height: 4px; width: 60px; background: #2563eb; margin: 10px auto; border-radius: 2px;"></div>
                            </div>
                            
                            <p style="font-size: 15px; color: #475569; line-height: 1.5; text-align: center;">Sisteme yeni bir sipariş düştü. Detaylar aşağıdadır:</p>
                            
                            <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px solid #f1f5f9;">
                                <table style="width: 100%; font-size: 14px; border-spacing: 0 8px;">
                                    <tr><td style="color: #64748b; width: 120px;"><strong>Müşteri:</strong></td><td style="color: #1e293b; font-weight: 600;">${company?.name || 'Bilinmiyor'} (${company?.dealer_code || '-'})</td></tr>
                                    <tr><td style="color: #64748b;"><strong>Toplam Tutar:</strong></td><td style="color: #16a34a; font-weight: 800; font-size: 18px;">${Number(totalAmount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</td></tr>
                                    <tr><td style="color: #64748b; vertical-align: top;"><strong>Adres:</strong></td><td style="color: #1e293b;">${shippingAddress || 'Seçilmedi'}</td></tr>
                                    <tr><td style="color: #64748b;"><strong>Not:</strong></td><td style="color: #1e293b; font-style: italic;">${note || '-'}</td></tr>
                                </table>
                            </div>

                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <thead style="background: #f1f5f9;">
                                    <tr>
                                        <th style="padding: 12px 8px; text-align: left; color: #475569; border-top-left-radius: 8px; border-bottom-left-radius: 8px;">Ürün Detayı</th>
                                        <th style="padding: 12px 8px; text-align: center; color: #475569;">Adet</th>
                                        <th style="padding: 12px 8px; text-align: right; color: #475569; border-top-right-radius: 8px; border-bottom-right-radius: 8px;">Fiyat</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml}
                                </tbody>
                            </table>

                            <div style="margin-top: 40px; text-align: center;">
                                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin/orders" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.2);">Siparişleri Yönet</a>
                            </div>

                            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 12px;">
                                Bu e-posta B2B sisteminiz tarafından otomatik olarak gönderilmiştir.
                            </div>
                        </div>
                    `
                });
                
                console.log("📨 sendEmail Result:", result);
            } else {
                console.log("⏩ Notifications are disabled or email not set.");
            }
        } catch (mailErr) {
            console.error("❌ Fatal Error in Admin Notification process:", mailErr);
        }

        return NextResponse.json(data);
    } catch (err) {
        console.error("CHECKOUT API ERROR:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
