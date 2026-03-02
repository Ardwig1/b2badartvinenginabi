import { createClient } from '@/lib/supabase/server';

export default async function DealerDashboard() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, company_id, company:companies(name, current_balance, credit_limit, price_group:price_groups(name, discount_percent))')
        .eq('id', user.id)
        .single();

    const companyId = profile?.company_id;

    let rates = { USD: null, EUR: null };
    try {
        const resUsd = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY', { cache: 'no-store' });
        if (resUsd.ok) { const d = await resUsd.json(); rates.USD = d.rates.TRY.toFixed(2); }
        const resEur = await fetch('https://api.frankfurter.app/latest?from=EUR&to=TRY', { cache: 'no-store' });
        if (resEur.ok) { const d = await resEur.json(); rates.EUR = d.rates.TRY.toFixed(2); }
    } catch (e) { console.error("Kur yüklenemedi", e); }

    const [
        { count: pendingOrders },
        { count: totalOrders },
        { data: recentOrders },
        { data: recentQuotes },
        { count: unpaidInvoices },
    ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pending'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('orders').select('id, total_amount, status, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(3),
        supabase.from('quotes').select('id, status, total_amount, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(3),
        supabase.from('invoices').select('total_amount').eq('company_id', companyId).neq('status', 'paid'),
    ]);

    const totalUnpaidAmount = unpaidInvoices?.reduce((acc, inv) => acc + Number(inv.total_amount), 0) || 0;

    const company = profile?.company;
    const pg = company?.price_group;

    const orderStatusMap = { pending: 'Bekliyor', confirmed: 'Onaylandı', preparing: 'Hazırlanıyor', shipped: 'Kargoda', delivered: 'Teslim Edildi', cancelled: 'İptal' };
    const quoteStatusMap = { pending: 'Değerlendiriliyor', sent: 'Teklif Geldi', accepted: 'Kabul Edildi', rejected: 'Reddedildi' };

    return (
        <div className="page-wrapper">
            <div className="page-header" style={{ alignItems: 'flex-start' }}>
                <div>
                    <h1 className="page-title">Hoş Geldiniz, {company?.name} 👋</h1>
                    <div className="page-subtitle" style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 16 }}>👤</span> Yetkili: {profile?.full_name || 'Standart Kullanıcı'}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 16 }}>🎧</span> M. Temsilcisi: B2B Destek Ekibi</span>
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
                    <a href="/dashboard/catalog" className="btn btn-primary" id="go-catalog">📦 Yeni Sipariş</a>
                </div>
            </div>

            {/* Announcements (Image supported) */}
            <div style={{ marginBottom: 20 }}>
                {/* Visual Banner Placeholder */}
                <div style={{ position: 'relative', width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', minHeight: 120, background: 'var(--bg-surface)' }}>
                    <img
                        src="/banner.jpg"
                        alt="Güncel Kampanyalar"
                        style={{ width: '100%', display: 'block', objectFit: 'cover', minHeight: 120 }}
                        onError={(e) => {
                            e.target.style.display = 'none';
                            if (document.getElementById('fallback-announcement')) {
                                document.getElementById('fallback-announcement').style.display = 'block';
                            }
                        }}
                    />
                    <div id="fallback-announcement" className="card" style={{ display: 'none', background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: 'white', border: 'none', margin: 0, height: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <span style={{ fontSize: 24 }}>📢</span>
                            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'white' }}>Önemli Duyurular</h2>
                        </div>
                        <p style={{ color: '#cbd5e1', margin: 0, lineHeight: 1.5, fontSize: 14 }}>
                            Değerli iş ortaklarımız, <strong>Yaz Kampanyası</strong> kapsamında tüm filtre gruplarında ekstra %5 iskonto tanımlanmıştır. (Not: /public/banner.jpg eklendiğinde görsel çıkacaktır.)
                        </p>
                    </div>
                </div>
            </div>

            {/* Brands Area */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Markalarımız</h2>
                </div>
                {/* Brands Grid (Placeholder styling to match reference image) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
                    {['YEKSAN', 'HYUNDAI MOBIS', 'PHC Valeo', 'GOETZE', 'Hanna', 'JERİKO', 'CEKO', 'yavuzsan', 'satf', 'KT GASKET', 'GROS'].map((brand) => (
                        <div key={brand} style={{
                            background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                            height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 10, fontWeight: 700, color: '#334155', fontSize: 12, textAlign: 'center'
                        }}>
                            {/* In production, use standard <img> tags pointing to their public files here */}
                            {brand}
                        </div>
                    ))}
                </div>
            </div>

            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>💰</div>
                    <div className="stat-label">Güncel Bakiye</div>
                    <div className="stat-value" style={{ color: company?.current_balance < 0 ? 'var(--danger)' : 'var(--success)' }}>
                        ₺{Math.abs(company?.current_balance || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        <span style={{ fontSize: 13, marginLeft: 4 }}>{company?.current_balance < 0 ? '(B)' : '(A)'}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>📉</div>
                    <div className="stat-label">Açık Faturalar (Borç)</div>
                    <div className="stat-value">₺{totalUnpaidAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#fef3c720', color: '#d97706' }}>🛡️</div>
                    <div className="stat-label">Risk Limiti</div>
                    <div className="stat-value">₺{Number(company?.credit_limit || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>🏷️</div>
                    <div className="stat-label">Fiyat Grubunuz</div>
                    <div className="stat-value" style={{ fontSize: 20 }}>{pg?.name || '-'}</div>
                    {pg && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>%{pg.discount_percent} iskonto</div>}
                </div>
            </div>

            <div className="content-grid two-col">
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
                                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(o.created_at).toLocaleDateString('tr-TR')}</div>
                                </div>
                                <span className={`badge badge-${o.status}`}>{orderStatusMap[o.status]}</span>
                            </div>
                        ))
                    ) : (
                        <div className="empty-state" style={{ padding: '30px 0' }}>
                            <div className="empty-state-icon">🛒</div>
                            <div className="empty-state-title">Henüz sipariş yok</div>
                        </div>
                    )}
                </div>

                {/* Recent Quotes */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Son Teklifler</h2>
                        <a href="/dashboard/quotes" className="btn btn-ghost btn-sm">Tümü →</a>
                    </div>
                    {recentQuotes && recentQuotes.length > 0 ? (
                        recentQuotes.map(q => (
                            <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: 14 }}>{q.total_amount ? `₺${Number(q.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : 'Fiyat Bekleniyor'}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(q.created_at).toLocaleDateString('tr-TR')}</div>
                                </div>
                                <span className={`badge badge-${q.status}`}>{quoteStatusMap[q.status]}</span>
                            </div>
                        ))
                    ) : (
                        <div className="empty-state" style={{ padding: '30px 0' }}>
                            <div className="empty-state-icon">💬</div>
                            <div className="empty-state-title">Teklif bulunamadı</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
