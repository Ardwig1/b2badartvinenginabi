import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js'; // Admin client for RLS bypass
import { getExchangeRates } from '@/lib/tcmb';
import { cookies } from 'next/headers';
import {
    UserIcon, ChatBubbleBottomCenterTextIcon, CurrencyDollarIcon, PresentationChartLineIcon,
    ShieldCheckIcon, TagIcon, ShoppingCartIcon, ChatBubbleLeftEllipsisIcon
} from '@heroicons/react/24/outline';
import Image from 'next/image';
import HomeBanner from '@/components/HomeBanner';

export const dynamic = 'force-dynamic';

export default async function DealerDashboard() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Use Admin Client for profile to ensure we get roles correctly
    const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('full_name, is_admin, company_id, company:companies(id, name, current_balance, risk_limit, price_group:price_groups(name, discount_percent))')
        .eq('id', user.id)
        .maybeSingle();

    // Impersonation Support (Include Reps) - Robust Version
    const cookieStore = await cookies();
    const impersonatedId = cookieStore.get('impersonate_company_id')?.value;
    
    // Identify Rep (Metadata or missing company_id)
    const isRep = user.user_metadata?.role === 'representative' || (profile && !profile.is_admin && !profile.company_id);
    const isImpersonating = (profile?.is_admin || isRep) && impersonatedId && impersonatedId !== 'undefined' && impersonatedId !== '';

    let effectiveCompanyId = profile?.company_id;
    let company = profile?.company;
    let queryClient = adminSupabase; // Default to admin client for server-side safety in dashboard

    if (isImpersonating) {
        effectiveCompanyId = impersonatedId;
        const { data: impCompany } = await queryClient
            .from('companies')
            .select('name, contact_person, current_balance, risk_limit, price_group:price_groups(name, discount_percent)')
            .eq('id', effectiveCompanyId)
            .single();
        if (impCompany) {
            company = impCompany;
        }
    }

    const companyId = effectiveCompanyId;
    if (!companyId && !profile?.is_admin && !isRep) return <div>Erişim Yetkiniz Yok.</div>;

    let rates = await getExchangeRates();

    const [
        { count: pendingOrders },
        { count: totalOrders },
        { data: recentOrders },
    ] = await Promise.all([
        queryClient.from('orders').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pending'),
        queryClient.from('orders').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        queryClient.from('orders').select('id, total_amount, status, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(3),
    ]);

    const pg = company?.price_group;
    const orderStatusMap = { pending: 'Bekliyor', confirmed: 'Onaylandı', preparing: 'Hazırlanıyor', shipped: 'Kargoda', delivered: 'Teslim Edildi', cancelled: 'İptal' };

    return (
        <div className="page-wrapper">
            <div className="page-header" style={{ alignItems: 'flex-start' }}>
                <div>
                    <h1 className="page-title">Hoş Geldiniz, {company?.name || 'Değerli İş Ortağımız'} 👋</h1>
                    <div className="page-subtitle" style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <UserIcon style={{ width: 16, height: 16 }} /> 
                            Yetkili: {isImpersonating ? (company?.contact_person || 'Firma Yetkilisi') : (profile?.full_name || 'Standart Kullanıcı')}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ChatBubbleBottomCenterTextIcon style={{ width: 16, height: 16 }} /> 
                            M. Temsilcisi: B2B Destek Ekibi
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', padding: '8px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: 13, fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: '#16a34a' }}>USD</span>
                            <span>{rates.USD ? `₺${rates.USD}` : '-'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: '#2563eb' }}>EUR</span>
                            <span>{rates.EUR ? `₺${rates.EUR}` : '-'}</span>
                        </div>
                    </div>
                    <a href="/dashboard/catalog" className="btn btn-primary" id="go-catalog" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ShoppingCartIcon style={{ width: 16, height: 16 }} /> Yeni Sipariş</a>
                </div>
            </div>

            {/* Sliding Announcements */}
            <HomeBanner />

            {/* Brands Area */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Markalarımız</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
                    {[
                        '/logo1.webp', '/logo2.png', '/logo3.jpg', '/logo4.png', '/logo5.png',
                        '/logo6.png', '/logo7.jpg', '/logo8.png', '/logo9.png', '/logo10.png',
                        '/logo11.png', '/logo12.png', '/logo13.png', '/logo14.png', '/logo15.png',
                        '/logo16.png', '/logo17.png', '/logo18.png', '/logo19.png', '/logo20.png',
                        '/logo21.png', '/logo22.png', '/logo23.jpeg'
                    ].map((logo, idx) => (
                        <div key={idx} style={{
                            background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                            height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 8, textAlign: 'center'
                        }}>
                            <img 
                                src={logo} 
                                alt={`Brand ${idx + 1}`} 
                                style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} 
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}><CurrencyDollarIcon style={{ width: 24, height: 24 }} /></div>
                    <div className="stat-label">Güncel Bakiye</div>
                    <div className="stat-value" style={{ color: company?.current_balance < 0 ? 'var(--danger)' : 'var(--success)' }}>
                        ₺{Math.abs(company?.current_balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        <span style={{ fontSize: 13, marginLeft: 4 }}>{company?.current_balance < 0 ? '(B)' : '(A)'}</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#fef3c720', color: '#d97706' }}><ShieldCheckIcon style={{ width: 24, height: 24 }} /></div>
                    <div className="stat-label">Kalan Risk Limiti</div>
                    <div className="stat-value">
                        {(() => {
                            const riskLimit = Number(company?.risk_limit || 0);
                            if (riskLimit === 0) return 'Sınırsız';
                            const debt = (Number(company?.current_balance) || 0) < 0 ? Math.abs(Number(company?.current_balance)) : 0;
                            const remaining = Math.max(0, riskLimit - debt);
                            return `₺${remaining.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
                        })()}
                    </div>
                    {Number(company?.risk_limit || 0) > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            Toplam Limit: ₺{Number(company?.risk_limit).toLocaleString('tr-TR')}
                        </div>
                    )}
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#dbeafe', color: '#2563eb' }}><TagIcon style={{ width: 24, height: 24 }} /></div>
                    <div className="stat-label">Fiyat Grubunuz</div>
                    <div className="stat-value" style={{ fontSize: 20 }}>{pg?.name || '-'}</div>
                    {pg && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>%{pg.discount_percent} iskonto</div>}
                </div>
            </div>

            <div className="content-grid">
                {/* Recent Orders */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Son Siparişler</h2>
                        <a href="/dashboard/orders" className="btn btn-ghost btn-sm">Tümü →</a>
                    </div>
                    {recentOrders && recentOrders.length > 0 ? (
                        recentOrders.map(o => (
                            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: 14 }}>₺{Number(o.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(o.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                                <span className={`badge badge-${o.status}`}>{orderStatusMap[o.status]}</span>
                            </div>
                        ))
                    ) : (
                        <div className="empty-state" style={{ padding: '30px 0' }}>
                            <div className="empty-state-icon"><ShoppingCartIcon style={{ width: 32, height: 32 }} /></div>
                            <div className="empty-state-title">Henüz sipariş yok</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
