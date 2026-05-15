import { createClient } from '@/lib/supabase/server';
import { BuildingOfficeIcon, ClockIcon, CubeIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import AdminBannerManager from '@/components/AdminBannerManager';

export default async function AdminDashboard() {
    const supabase = await createClient();

    const [
        { count: totalCompanies },
        { count: pendingCompanies },
        { count: totalProducts },
        { count: totalOrders },
        { data: recentOrders }
    ] = await Promise.all([
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        supabase.from('companies').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders')
            .select('id, total_amount, status, created_at, company:companies(name)')
            .order('created_at', { ascending: false })
            .limit(5),
    ]);

    const stats = [
        { label: 'Toplam Firma', value: totalCompanies ?? 0, icon: <BuildingOfficeIcon style={{ width: 24, height: 24 }} />, color: '#2563eb' },
        { label: 'Onay Bekleyen', value: pendingCompanies ?? 0, icon: <ClockIcon style={{ width: 24, height: 24 }} />, color: '#d97706' },
        { label: 'Aktif Ürün', value: totalProducts ?? 0, icon: <CubeIcon style={{ width: 24, height: 24 }} />, color: '#16a34a' },
        { label: 'Toplam Sipariş', value: totalOrders ?? 0, icon: <ShoppingCartIcon style={{ width: 24, height: 24 }} />, color: '#7c3aed' },
    ];

    const statusMap = {
        pending: 'Bekliyor', confirmed: 'Onaylandı', preparing: 'Hazırlanıyor',
        shipped: 'Kargoda', delivered: 'Teslim Edildi', cancelled: 'İptal'
    };

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Ana Sayfa</h1>
                    <p className="page-subtitle">Yönetim paneline hoş geldiniz</p>
                </div>
            </div>

            <AdminBannerManager />

            <div className="stats-grid">
                {stats.map(s => (
                    <div key={s.label} className="stat-card">
                        <div className="stat-icon" style={{ background: `${s.color}20`, color: s.color }}>
                            {s.icon}
                        </div>
                        <div className="stat-label">{s.label}</div>
                        <div className="stat-value">{s.value}</div>
                    </div>
                ))}
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Son Siparişler</h2>
                    <a href="/admin/orders" className="btn btn-ghost btn-sm">Tümünü Gör →</a>
                </div>
                {recentOrders && recentOrders.length > 0 ? (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Firma</th>
                                    <th>Tutar</th>
                                    <th>Durum</th>
                                    <th>Tarih</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map(o => (
                                    <tr key={o.id}>
                                        <td>{o.company?.name || '-'}</td>
                                        <td>₺{Number(o.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                        <td><span className={`badge badge-${o.status}`}>{statusMap[o.status] || o.status}</span></td>
                                        <td>{new Date(o.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon"><ShoppingCartIcon style={{ width: 32, height: 32 }} /></div>
                        <div className="empty-state-title">Henüz sipariş yok</div>
                    </div>
                )}
            </div>
        </div>
    );
}
