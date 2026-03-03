'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShoppingCartIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

const statusLabels = { pending: 'Bekliyor', confirmed: 'Onaylandı', preparing: 'Hazırlanıyor', shipped: 'Kargoda', delivered: 'Teslim Edildi', cancelled: 'İptal' };

export default function AdminOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [filter, setFilter] = useState('all');
    const supabase = createClient();

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        let query = supabase.from('orders')
            .select('*, company:companies(name), items:order_items(*, product:products(name, code))')
            .order('created_at', { ascending: false });
        if (filter !== 'all') query = query.eq('status', filter);
        const { data } = await query;
        setOrders(data || []);
        setLoading(false);
    }, [filter]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const updateStatus = async (id, status) => {
        await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
        if (selected?.id === id) setSelected(prev => ({ ...prev, status }));
        fetchOrders();
    };

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Sipariş Yönetimi</h1>
                    <p className="page-subtitle">{orders.length} sipariş listeleniyor</p>
                </div>
            </div>

            <div className="tabs">
                {['all', ...Object.keys(statusLabels)].map(f => (
                    <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                        {f === 'all' ? 'Tümü' : statusLabels[f]}
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
                <div className="table-wrapper">
                    {loading ? (
                        <div className="loading-center"><div className="loading-spinner" /></div>
                    ) : orders.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><ShoppingCartIcon style={{ width: 48, height: 48 }} /></div>
                            <div>Bu filtrede sipariş bulunamadı</div>
                        </div>
                    ) : (
                        <table>
                            <thead><tr><th>Firma</th><th>Tutar</th><th>Durum</th><th>Tarih</th><th></th></tr></thead>
                            <tbody>
                                {orders.map(o => (
                                    <tr key={o.id} style={{ cursor: 'pointer', background: selected?.id === o.id ? 'rgba(37,99,235,0.08)' : undefined }}>
                                        <td style={{ fontWeight: 600 }}>{o.company?.name}</td>
                                        <td>₺{Number(o.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                        <td><span className={`badge badge-${o.status}`}>{statusLabels[o.status]}</span></td>
                                        <td>{new Date(o.created_at).toLocaleDateString('tr-TR')}</td>
                                        <td><button className="btn btn-ghost btn-sm" onClick={() => setSelected(o)} id={`detail-${o.id}`}>Detay</button></td>
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
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Firma</div>
                            <div style={{ fontWeight: 600 }}>{selected.company?.name}</div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Ürünler</div>
                            {selected.items?.map(item => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13 }}>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{item.product?.name}</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.quantity} × ₺{Number(item.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                    <div style={{ fontWeight: 600 }}>₺{Number(item.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>
                                <span>Toplam</span>
                                <span>₺{Number(selected.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        {selected.note && (
                            <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-secondary)' }}>
                                <DocumentTextIcon style={{ width: 14, height: 14, display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />
                                <span style={{ verticalAlign: 'middle' }}>{selected.note}</span>
                            </div>
                        )}
                        <div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Durumu Güncelle</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {Object.entries(statusLabels).map(([key, label]) => (
                                    <button key={key} className={`btn btn-sm ${selected.status === key ? 'btn-primary' : 'btn-ghost'}`}
                                        onClick={() => updateStatus(selected.id, key)} id={`status-${key}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
