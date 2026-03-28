'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShoppingCartIcon, DocumentTextIcon, CheckCircleIcon, ClockIcon, TruckIcon, XCircleIcon, BeakerIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import OrderDetailsModal from '@/components/OrderDetailsModal';

function OrdersContent() {
    const searchParams = useSearchParams();
    const [orders, setOrders] = useState([]);
    const [orderItems, setOrderItems] = useState([]); // For Product History tab
    const [loading, setLoading] = useState(true);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'items' ? 'items' : 'orders');
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const supabase = createClient();

    const fetchOrders = useCallback(async () => {
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
    }, []);

    const fetchOrderItems = useCallback(async () => {
        setItemsLoading(true);
        try {
            const res = await fetch('/api/user/order-items');
            if (res.ok) {
                const data = await res.json();
                setOrderItems(data || []);
            }
        } catch (err) {
            console.error('Fetch items history error:', err);
        } finally {
            setItemsLoading(false);
        }
    }, []);

    useEffect(() => { 
        if (activeTab === 'orders') fetchOrders();
        else fetchOrderItems();
    }, [activeTab, fetchOrders, fetchOrderItems]);

    const statusLabels = {
        pending: { text: 'Onay Bekliyor', color: '#ca8a04', bg: '#fef9c3', icon: <ClockIcon style={{width:16}} /> },
        confirmed: { text: 'Onaylandı', color: '#2563eb', bg: '#dbeafe', icon: <CheckCircleIcon style={{width:16}} /> },
        preparing: { text: 'Hazırlanıyor', color: '#7c3aed', bg: '#f3e8ff', icon: <BeakerIcon style={{width:16}} /> },
        shipped: { text: 'Kargoya Verildi', color: '#db2777', bg: '#fce7f3', icon: <TruckIcon style={{width:16}} /> },
        delivered: { text: 'Teslim Edildi', color: '#16a34a', bg: '#dcfce7', icon: <CheckCircleIcon style={{width:16}} /> },
        cancelled: { text: 'İptal Edildi', color: '#dc2626', bg: '#fee2e2', icon: <XCircleIcon style={{width:16}} /> }
    };

    // Filter order items based on search term
    const filteredItems = orderItems.filter(item => 
        !searchTerm || 
        item.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product?.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product?.oem_no?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Sipariş Yönetimi</h1>
                    <p className="page-subtitle">Siparişleriniz ve ürün bazlı satın alma geçmişiniz</p>
                </div>
            </div>

            {/* Tab Switcher & Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button 
                        className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-ghost'}`} 
                        onClick={() => setActiveTab('orders')}
                        style={{ borderRadius: 12, padding: '10px 24px', border: activeTab === 'orders' ? 'none' : '1px solid var(--border)' }}
                    >
                        <ShoppingCartIcon style={{ width: 18, height: 18, marginRight: 8 }} />
                        Siparişlerim
                    </button>
                    <button 
                        className={`btn ${activeTab === 'items' ? 'btn-primary' : 'btn-ghost'}`} 
                        onClick={() => setActiveTab('items')}
                        style={{ borderRadius: 12, padding: '10px 24px', border: activeTab === 'items' ? 'none' : '1px solid var(--border)' }}
                    >
                        <DocumentTextIcon style={{ width: 18, height: 18, marginRight: 8 }} />
                        Ürün Geçmişi (A-Z)
                    </button>
                </div>

                {activeTab === 'items' && (
                    <div style={{ position: 'relative', width: '300px' }}>
                        <MagnifyingGlassIcon style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-muted)' }} />
                        <input 
                            type="text" 
                            placeholder="Ürün adı veya kodu ile ara..." 
                            className="form-input"
                            style={{ paddingLeft: 36, borderRadius: 12, height: 42 }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                )}
            </div>

            {activeTab === 'orders' ? (
                loading ? (
                    <div className="loading-center"><div className="loading-spinner" /></div>
                ) : orders.length === 0 ? (
                    <div className="card">
                        <div className="empty-state" style={{ padding: '60px 0' }}>
                            <div className="empty-state-icon"><ShoppingCartIcon style={{ width: 48, height: 48 }} /></div>
                            <div className="empty-state-title">Henüz siparişiniz bulunmuyor</div>
                            <p className="empty-state-desc">Ürün kataloğuna giderek ilk siparişinizi verebilirsiniz.</p>
                            <a href="/dashboard/catalog" className="btn btn-primary" style={{ marginTop: 24 }}>Ürünleri İncele</a>
                        </div>
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Tarih</th>
                                    <th>Evrak No</th>
                                    <th style={{ textAlign: 'right' }}>Toplam Tutar</th>
                                    <th style={{ textAlign: 'center' }}>Durum</th>
                                    <th>Not</th>
                                    <th style={{ textAlign: 'right' }}>İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(order => {
                                    const status = statusLabels[order.status] || { text: order.status, color: '#666', bg: '#eee' };
                                    return (
                                        <tr key={order.id}>
                                            <td style={{ fontWeight: 500 }}>{new Date(order.created_at).toLocaleString('tr-TR')}</td>
                                            <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{order.document_no || order.id.slice(0, 8)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 15 }}>₺{Number(order.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: status.bg, color: status.color, fontSize: 12, fontWeight: 700 }}>
                                                    {status.icon}
                                                    {status.text}
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.note || '-'}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOrder(order)}>Detaylar</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            ) : (
                /* Product History Tab */
                itemsLoading ? (
                    <div className="loading-center"><div className="loading-spinner" /></div>
                ) : filteredItems.length === 0 ? (
                    <div className="card">
                        <div className="empty-state" style={{ padding: '60px 0' }}>
                            <div className="empty-state-icon"><DocumentTextIcon style={{ width: 48, height: 48 }} /></div>
                            <div className="empty-state-title">{searchTerm ? 'Aranan ürün geçmişte bulunamadı' : 'Satın alma geçmişi yok'}</div>
                        </div>
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Ürün Adı</th>
                                    <th>Stok Kodu / OEM</th>
                                    <th>Sipariş Tarihi</th>
                                    <th style={{ textAlign: 'center' }}>Miktar</th>
                                    <th style={{ textAlign: 'right' }}>Net Birim Fiyat (KDV Dahil)</th>
                                    <th style={{ textAlign: 'center' }}>Sipariş Durumu</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item, idx) => {
                                    const status = statusLabels[item.orders?.status] || { text: item.orders?.status, color: '#666', bg: '#eee' };
                                    // Net Price: unit_price is already discounted, add VAT
                                    const netUnitPrice = Number(item.unit_price) * 1.20;
                                    return (
                                        <tr key={item.id + idx}>
                                            <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.product?.name || 'Bilinmeyen Ürün'}</td>
                                            <td>
                                                <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{item.product?.code}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.product?.oem_no}</div>
                                            </td>
                                            <td style={{ fontSize: 13 }}>{new Date(item.orders?.created_at).toLocaleDateString('tr-TR')}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.quantity} {item.product?.unit || 'AD'}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>₺{netUnitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 12, background: status.bg, color: status.color, fontSize: 11, fontWeight: 600 }}>
                                                    {status.text}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
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

export default function DealerOrders() {
    return (
        <Suspense fallback={<div className="loading-center"><div className="loading-spinner" /></div>}>
            <OrdersContent />
        </Suspense>
    );
}
