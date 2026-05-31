'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShoppingCartIcon, DocumentTextIcon, CheckCircleIcon, ClockIcon, TruckIcon, XCircleIcon, BeakerIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import OrderDetailsModal from '@/components/OrderDetailsModal';

const showCode = (code) => { if (!code) return null; const s = code.replace(/[a-zA-Z]/g, ''); return s || null; };

function OrdersContent() {
    const searchParams = useSearchParams();
    const [orders, setOrders] = useState([]);
    const [orderItems, setOrderItems] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'items' ? 'items' : 'orders');
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [selectedOrder, setSelectedOrder] = useState(null);

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

    const filteredItems = orderItems.filter(item => 
        !searchTerm || 
        item.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product?.code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Sipariş Yönetimi</h1>
                    <p className="page-subtitle">Siparişleriniz ve satın alma geçmişiniz</p>
                </div>
            </div>

            <div className="tab-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: '500px' }}>
                    <button className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('orders')} style={{ flex: 1, borderRadius: 12, fontSize: 13 }}>Siparişlerim</button>
                    <button className={`btn ${activeTab === 'items' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('items')} style={{ flex: 1, borderRadius: 12, fontSize: 13 }}>Ürün Geçmişi</button>
                </div>
                {activeTab === 'items' && (
                    <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
                        <MagnifyingGlassIcon style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, color: 'var(--text-muted)' }} />
                        <input type="text" placeholder="Ürün ara..." className="form-input" style={{ paddingLeft: 36, borderRadius: 12 }} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                )}
            </div>

            {activeTab === 'orders' ? (
                loading ? <div className="loading-center"><div className="loading-spinner" /></div> : 
                orders.length === 0 ? <div className="card"><div className="empty-state">Sipariş bulunamadı</div></div> : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Tarih</th>
                                    <th>Evrak No</th>
                                    <th style={{ textAlign: 'right' }}>Tutar</th>
                                    <th style={{ textAlign: 'center' }}>Durum</th>
                                    <th style={{ textAlign: 'right' }}>İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(order => {
                                    const status = statusLabels[order.status] || { text: order.status, color: '#666', bg: '#eee' };
                                    return (
                                        <tr key={order.id}>
                                            <td data-label="Tarih" style={{ fontWeight: 500 }}>{new Date(order.created_at).toLocaleString('tr-TR')}</td>
                                            <td data-label="Evrak No" style={{ fontWeight: 700, color: 'var(--primary)' }}>{order.document_no || order.id.slice(0, 8)}</td>
                                            <td data-label="Tutar" style={{ textAlign: 'right', fontWeight: 800 }}>₺{Number(order.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td data-label="Durum" style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: status.bg, color: status.color, fontSize: 11, fontWeight: 700 }}>
                                                    {status.text}
                                                </div>
                                            </td>
                                            <td data-label="İşlem" style={{ textAlign: 'right' }}>
                                                <button className="btn btn-primary btn-sm" onClick={() => setSelectedOrder(order)}>Detay</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            ) : (
                itemsLoading ? <div className="loading-center"><div className="loading-spinner" /></div> :
                filteredItems.length === 0 ? <div className="card"><div className="empty-state">Kayıt yok</div></div> : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Ürün</th>
                                    <th>Kod</th>
                                    <th>Tarih</th>
                                    <th style={{ textAlign: 'center' }}>Adet</th>
                                    <th style={{ textAlign: 'right' }}>Fiyat</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item, idx) => {
                                    const netUnitPrice = Number(item.unit_price) * 1.20;
                                    return (
                                        <tr key={item.id + idx}>
                                            <td data-label="Ürün Adı" style={{ fontWeight: 700 }}>{item.product?.name}</td>
                                            <td data-label="Ürün Kodu">{showCode(item.product?.code) || '-'}</td>
                                            <td data-label="Sipariş Tarihi">{new Date(item.orders?.created_at).toLocaleDateString('tr-TR')}</td>
                                            <td data-label="Miktar" style={{ textAlign: 'center', fontWeight: 600 }}>{item.quantity} {item.product?.unit || 'AD'}</td>
                                            <td data-label="Birim Fiyat" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>₺{netUnitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {selectedOrder && <OrderDetailsModal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} orderId={selectedOrder.id} isAdmin={false} />}
        </div>
    );
}

export default function DealerOrders() {
    return (
        <Suspense fallback={<div className="loading-spinner" />}>
            <OrdersContent />
        </Suspense>
    );
}

