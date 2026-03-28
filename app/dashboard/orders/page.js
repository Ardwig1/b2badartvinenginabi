'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShoppingCartIcon, DocumentTextIcon, CheckCircleIcon, ClockIcon, TruckIcon, XCircleIcon, BeakerIcon } from '@heroicons/react/24/outline';
import OrderDetailsModal from '@/components/OrderDetailsModal';

const statusConfig = {
    pending: { label: 'Bekliyor', color: 'var(--warning)', bg: '#fef9c3', icon: ClockIcon },
    confirmed: { label: 'Onaylandı', color: '#16a34a', bg: '#dcfce7', icon: CheckCircleIcon },
    preparing: { label: 'Hazırlanıyor', color: 'var(--primary)', bg: 'var(--primary-light)', icon: BeakerIcon },
    shipped: { label: 'Kargoda', color: '#7c3aed', bg: '#ede9fe', icon: TruckIcon },
    delivered: { label: 'Teslim Edildi', color: '#059669', bg: '#ecfdf5', icon: CheckCircleIcon },
    cancelled: { label: 'İptal Edildi', color: 'var(--danger)', bg: '#fee2e2', icon: XCircleIcon },
};

export default function DealerOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const supabase = createClient();

    useEffect(() => {
        async function fetchOrders() {
            setLoading(true);
            try {
                const res = await fetch('/api/user/orders');
                if (res.ok) {
                    const data = await res.json();
                    setOrders(data || []);
                }
            } catch (err) {
                console.error('Fetch orders error:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchOrders();
    }, []);

    if (loading) {
        return (
            <div className="page-wrapper">
                <div className="page-header">
                    <h1 className="page-title">Siparişlerim</h1>
                </div>
                <div className="card" style={{ padding: '60px 0', textAlign: 'center' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto' }} />
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Siparişlerim</h1>
                    <p className="page-subtitle">{orders.length} adet sipariş bulundu</p>
                </div>
            </div>

            {orders.length === 0 ? (
                <div className="card" style={{ padding: '60px 0', textAlign: 'center' }}>
                    <div className="empty-state-icon" style={{ margin: '0 auto 20px' }}><ShoppingCartIcon style={{ width: 48, height: 48 }} /></div>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Henüz Siparişiniz Yok</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Burası biraz sessiz... İlk siparişinizi vermek için kataloğa göz atın.</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-wrapper">
                        <table style={{ margin: 0 }}>
                            <thead>
                                <tr>
                                    <th>Evrak No</th>
                                    <th>Tarih</th>
                                    <th>Ödeme Tipi</th>
                                    <th>Toplam Tutar</th>
                                    <th>Durum</th>
                                    <th style={{ width: 100 }}>İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(order => {
                                    const status = statusConfig[order.status] || statusConfig.pending;
                                    const StatusIcon = status.icon;
                                    return (
                                        <tr key={order.id}>
                                            <td style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', fontSize: 14 }}>
                                                {order.document_no || 'Bekleniyor...'}
                                            </td>
                                            <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                                {new Date(order.created_at).toLocaleString('tr-TR')}
                                            </td>
                                            <td style={{ fontSize: 13 }}>
                                                {order.payment_type === 'credit_card' ? 'Kredi Kartı' : 'Havale/EFT'}
                                            </td>
                                            <td style={{ fontWeight: 700, fontSize: 14 }}>
                                                ₺{Number(order.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td>
                                                <div style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    padding: '4px 10px',
                                                    borderRadius: 20,
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    background: status.bg,
                                                    color: status.color
                                                }}>
                                                    <StatusIcon style={{ width: 14, height: 14 }} />
                                                    {status.label}
                                                </div>
                                            </td>
                                            <td>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}
                                                    onClick={() => setSelectedOrder(order)}
                                                >
                                                    <DocumentTextIcon style={{ width: 16, height: 16 }} /> Detay
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {selectedOrder && (
                <OrderDetailsModal
                    isOpen={!!selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    orderId={selectedOrder.id}
                    isAdmin={false}
                />
            )}
        </div>
    );
}
