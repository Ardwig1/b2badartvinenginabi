'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const statusLabels = { pending: 'Bekliyor', confirmed: 'Onaylandı', preparing: 'Hazırlanıyor', shipped: 'Kargoda', delivered: 'Teslim Edildi', cancelled: 'İptal' };

export default function DealerOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const supabase = createClient();

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
        const { data } = await supabase.from('orders')
            .select('*, items:order_items(*, product:products(name, code, oem_no))')
            .eq('company_id', profile.company_id)
            .order('created_at', { ascending: false });
        setOrders(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const statusSteps = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered'];

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Siparişlerim</h1>
                    <p className="page-subtitle">{orders.length} sipariş</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
                <div className="table-wrapper">
                    {loading ? (
                        <div className="loading-center"><div className="loading-spinner" /></div>
                    ) : orders.length === 0 ? (
                        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
                            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Henüz sipariş yok</div>
                            <a href="/dashboard/catalog" className="btn btn-primary" style={{ marginTop: 8, display: 'inline-flex' }}>Alışverişe Başla</a>
                        </div>
                    ) : (
                        <table>
                            <thead><tr><th>Sipariş No</th><th>Tutar</th><th>Durum</th><th>Tarih</th><th></th></tr></thead>
                            <tbody>
                                {orders.map(o => (
                                    <tr key={o.id} style={{ cursor: 'pointer', background: selected?.id === o.id ? 'rgba(37,99,235,0.08)' : undefined }}>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{o.id.slice(0, 8).toUpperCase()}</td>
                                        <td style={{ fontWeight: 600 }}>₺{Number(o.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                        <td><span className={`badge badge-${o.status}`}>{statusLabels[o.status]}</span></td>
                                        <td>{new Date(o.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                        <td><button className="btn btn-ghost btn-sm" onClick={() => setSelected(o)} id={`order-detail-${o.id}`}>Detay</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {selected && (
                    <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: 20 }}>
                        <div className="card-header">
                            <h3 className="card-title">Sipariş Detayı</h3>
                            <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
                        </div>

                        {/* Status Progress */}
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>Sipariş Durumu</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {statusSteps.map((step, i) => {
                                    const currentIdx = statusSteps.indexOf(selected.status);
                                    const isDone = i <= currentIdx && selected.status !== 'cancelled';
                                    return (
                                        <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < statusSteps.length - 1 ? 1 : 'auto' }}>
                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: isDone ? 'var(--primary)' : 'var(--border)', flexShrink: 0, border: `2px solid ${isDone ? 'var(--primary)' : 'var(--border)'}` }} title={statusLabels[step]} />
                                            {i < statusSteps.length - 1 && <div style={{ flex: 1, height: 2, background: i < currentIdx && selected.status !== 'cancelled' ? 'var(--primary)' : 'var(--border)', margin: '0 2px' }} />}
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                {statusSteps.map(s => <div key={s} style={{ fontSize: 10, color: 'var(--text-muted)' }}>{statusLabels[s].split(' ')[0]}</div>)}
                            </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            {selected.items?.map(item => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13 }}>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{item.product?.name}</div>
                                        {item.product?.oem_no && (
                                            <div style={{ color: 'var(--primary)', fontSize: 11, fontFamily: 'monospace', marginTop: 1 }}>OEM: {item.product.oem_no}</div>
                                        )}
                                        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.quantity} × ₺{Number(item.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                    <div style={{ fontWeight: 600 }}>₺{Number(item.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>
                            <span>Toplam</span>
                            <span>₺{Number(selected.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {selected.note && (
                            <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-surface)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-secondary)' }}>
                                📝 {selected.note}
                            </div>
                        )}

                        {(selected.status === 'shipped' || selected.status === 'delivered') && selected.shipping_company && (
                            <div style={{ marginTop: 12, padding: 16, background: 'rgba(37,99,235,0.05)', borderRadius: 12, border: '1px solid rgba(37,99,235,0.1)', fontSize: 13 }}>
                                <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>🚚 Kargo Detayları</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Kargo Firması:</span>
                                        <span style={{ fontWeight: 600 }}>{selected.shipping_company}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Takip No:</span>
                                        <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selected.tracking_number || '-'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Çıkış:</span>
                                        <span style={{ fontWeight: 600 }}>{selected.shipping_origin}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
