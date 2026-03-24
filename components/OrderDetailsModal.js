'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { XMarkIcon, DocumentTextIcon, ShoppingCartIcon, CheckCircleIcon, ClockIcon, TruckIcon, XCircleIcon, BeakerIcon } from '@heroicons/react/24/outline';

const statusConfig = {
    pending: { label: 'Bekliyor', color: 'var(--warning)', bg: '#fef9c3', icon: ClockIcon },
    confirmed: { label: 'Onaylandı', color: '#16a34a', bg: '#dcfce7', icon: CheckCircleIcon },
    preparing: { label: 'Hazırlanıyor', color: 'var(--primary)', bg: 'var(--primary-light)', icon: BeakerIcon },
    shipped: { label: 'Kargoda', color: '#7c3aed', bg: '#ede9fe', icon: TruckIcon },
    delivered: { label: 'Teslim Edildi', color: '#059669', bg: '#ecfdf5', icon: CheckCircleIcon },
    cancelled: { label: 'İptal Edildi', color: 'var(--danger)', bg: '#fee2e2', icon: XCircleIcon },
};

export default function OrderDetailsModal({ isOpen, onClose, orderId, isAdmin = false }) {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        if (!isOpen || !orderId) return;

        async function fetchOrderDetail() {
            setLoading(true);
            const { data, error } = await supabase
                .from('orders')
                .select('*, items:order_items(*, product:products(name, code, oem_no, image_url))')
                .eq('id', orderId)
                .single();

            if (!error) setOrder(data);
            setLoading(false);
        }

        fetchOrderDetail();
    }, [isOpen, orderId, supabase]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 600, width: '95%' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">Sipariş Detayı</h3>
                    <button className="modal-close" onClick={onClose}><XMarkIcon style={{ width: 24, height: 24 }} /></button>
                </div>

                {loading ? (
                    <div style={{ padding: '40px 0', textAlign: 'center' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : !order ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Sipariş detayları yüklenemedi.
                    </div>
                ) : (
                    <div style={{ padding: '0 4px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24, background: 'var(--bg-secondary)', padding: 16, borderRadius: 12 }}>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Evrak No</div>
                                <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 16, color: 'var(--primary)' }}>{order.document_no || 'Bekleniyor...'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Tarih</div>
                                <div style={{ fontWeight: 600 }}>{new Date(order.created_at).toLocaleString('tr-TR')}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Ödeme Tipi</div>
                                <div style={{ fontWeight: 600 }}>{order.payment_type === 'credit_card' ? 'Kredi Kartı' : 'Havale/EFT'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Durum</div>
                                {(() => {
                                    const status = statusConfig[order.status] || statusConfig.pending;
                                    const StatusIcon = status.icon;
                                    return (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: status.bg, color: status.color }}>
                                            <StatusIcon style={{ width: 14, height: 14 }} />
                                            {status.label}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        <div style={{ marginBottom: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                <ShoppingCartIcon style={{ width: 20, height: 20, color: 'var(--primary)' }} />
                                <h4 style={{ fontSize: 15, fontWeight: 700 }}>Ürünler</h4>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {order.items?.map(item => (
                                    <div key={item.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                                        <div style={{ width: 50, height: 50, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                            {item.product?.image_url ? (
                                                <img src={item.product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            ) : (
                                                <ShoppingCartIcon style={{ width: 24, height: 24, color: '#eee' }} />
                                            )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700 }}>{item.product?.name}</div>
                                            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                                                <span style={{ fontSize: 11, color: 'var(--primary)', fontFamily: 'monospace' }}>KOD: {item.product?.code}</span>
                                                {item.product?.oem_no && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>OEM: {item.product.oem_no}</span>}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 }}>
                                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                                    {item.quantity} adet × ₺{Number(item.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                </div>
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                                    ₺{Number(item.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {order.note && (
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <DocumentTextIcon style={{ width: 20, height: 20, color: 'var(--primary)' }} />
                                    <h4 style={{ fontSize: 15, fontWeight: 700 }}>Sipariş Notu</h4>
                                </div>
                                <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                    "{order.note}"
                                </div>
                            </div>
                        )}

                        <div style={{ borderTop: '2px solid var(--border)', paddingTop: 16, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 16, fontWeight: 600 }}>Genel Toplam</span>
                            <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>₺{Number(order.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                )}

                <div className="modal-footer" style={{ marginTop: 20 }}>
                    <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onClose}>Kapat</button>
                </div>
            </div>
        </div>
    );
}
