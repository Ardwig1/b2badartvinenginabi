import { createClient } from '@/lib/supabase/server';

export default async function DealerDashboard() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, company:companies(name, current_balance, credit_limit, price_group:price_groups(name, discount_percent))')
        .eq('id', user.id)
        .single();

    const companyId = profile?.company_id;

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
        supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'unpaid'),
    ]);

    const company = profile?.company;
    const pg = company?.price_group;

    const orderStatusMap = { pending: 'Bekliyor', confirmed: 'Onaylandı', preparing: 'Hazırlanıyor', shipped: 'Kargoda', delivered: 'Teslim Edildi', cancelled: 'İptal' };
    const quoteStatusMap = { pending: 'Değerlendiriliyor', sent: 'Teklif Geldi', accepted: 'Kabul Edildi', rejected: 'Reddedildi' };

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Hoş Geldiniz, {company?.name} 👋</h1>
                    <p className="page-subtitle">Bayi panelinize genel bakış</p>
                </div>
                <a href="/dashboard/catalog" className="btn btn-primary" id="go-catalog">📦 Kataloga Git</a>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#fef3c720', color: '#d97706' }}>⏳</div>
                    <div className="stat-label">Bekleyen Sipariş</div>
                    <div className="stat-value">{pendingOrders ?? 0}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>📋</div>
                    <div className="stat-label">Toplam Sipariş</div>
                    <div className="stat-value">{totalOrders ?? 0}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>🧾</div>
                    <div className="stat-label">Ödenmemiş Fatura</div>
                    <div className="stat-value">{unpaidInvoices ?? 0}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>🏷️</div>
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
