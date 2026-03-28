'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShoppingCartIcon, DocumentTextIcon, BellAlertIcon, BellSlashIcon } from '@heroicons/react/24/outline';

const statusLabels = { pending: 'Bekliyor', confirmed: 'Onaylandı', preparing: 'Hazırlanıyor', shipped: 'Kargoda', delivered: 'Teslim Edildi', cancelled: 'İptal' };

export default function AdminOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [itemShippingData, setItemShippingData] = useState({}); // { itemId: { company, tracking, origin } }
    const [filter, setFilter] = useState('all');
    const [isCancelling, setIsCancelling] = useState(false);
    const [cancelOrderId, setCancelOrderId] = useState(null);
    const [isShippingConfirm, setIsShippingConfirm] = useState(false);
    
    // When selected order changes, initialize item shipping data
    useEffect(() => {
        if (selected && selected.items) {
            const initialData = {};
            selected.items.forEach(item => {
                initialData[item.id] = {
                    company: item.shipping_company || '',
                    tracking: item.tracking_number || '',
                    origin: item.shipping_origin || 'İstanbul'
                };
            });
            setItemShippingData(initialData);
        }
    }, [selected]);

    const supabase = createClient();

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        let query = supabase.from('orders')
            .select('*, company:companies(name), items:order_items(*, product:products(name, code, oem_no, supplier_brand))')
            .order('created_at', { ascending: false });
        if (filter !== 'all') query = query.eq('status', filter);
        const { data } = await query;
        setOrders(data || []);
        setLoading(false);
    }, [filter, supabase]);

    // --- NOTIFICATION SYSTEM ---
    const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);
    const [lastCheck, setLastCheck] = useState(null);

    useEffect(() => {
        const saved = localStorage.getItem('admin_order_notifications');
        if (saved === 'true') setIsNotificationsEnabled(true);
        setLastCheck(new Date().toISOString());
    }, []);

    const playNotificationSound = useCallback(() => {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            const audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            
            const playTone = (freq, startTime, duration) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(startTime);
                osc.stop(startTime + duration);
            };

            const now = audioCtx.currentTime;
            playTone(600, now, 0.15);
            playTone(800, now + 0.15, 0.3);
        } catch(e) {
            console.error("Audio play failed:", e);
        }
    }, []);

    const toggleNotifications = async () => {
        const newValue = !isNotificationsEnabled;
        if (newValue && typeof Notification !== "undefined") {
            let perm = Notification.permission;
            if (perm !== "granted" && perm !== "denied") {
                perm = await Notification.requestPermission();
            }
            if (perm === "granted") {
                playNotificationSound();
                new Notification('B2B Bildirimleri Aktif!', {
                    body: 'Yeni sipariş düştüğünde sistem size bu şekilde haber verecek.',
                    icon: '/icon.png'
                });
            } else {
                alert("Uyarı: Tarayıcı bildirimlerine izin vermediniz, sadece ses duyabilirsiniz.");
            }
        }
        setIsNotificationsEnabled(newValue);
        localStorage.setItem('admin_order_notifications', newValue ? 'true' : 'false');
    };

    useEffect(() => {
        if (!isNotificationsEnabled || !lastCheck) return;
        const interval = setInterval(async () => {
            const { data, error } = await supabase.from('orders')
                .select('id, company:companies(name)')
                .gt('created_at', lastCheck)
                .order('created_at', { ascending: false });

            if (!error && data && data.length > 0) {
                setLastCheck(new Date().toISOString());
                playNotificationSound();
                if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                    data.forEach(order => {
                        new Notification('B2B: Yeni Sipariş Geldi!', {
                            body: `${order.company?.name || 'Bir firma'} an itibariyle sipariş oluşturdu.`,
                            icon: '/icon.png'
                        });
                    });
                }
                fetchOrders();
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [isNotificationsEnabled, lastCheck, supabase, fetchOrders, playNotificationSound]);
    // --- END NOTIFICATION SYSTEM ---

    useEffect(() => { fetchOrders(); }, [fetchOrders]);
    
    // Original status update function
    const executeStatusUpdate = async (id, status) => {
        try {
            const res = await fetch('/api/admin/orders/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    orderId: id, 
                    status,
                    itemShippingData // Send the whole object
                })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Statü güncellenemedi');
            
            if (selected?.id === id) setSelected(prev => ({ ...prev, status }));
            fetchOrders();
            setIsCancelling(false);
            setCancelOrderId(null);
            setIsShippingConfirm(false);
        } catch (e) {
            alert('Hata: ' + e.message);
        }
    };

    const updateStatus = (id, status) => {
        if (status === 'cancelled') {
            setCancelOrderId(id);
            setIsCancelling(true);
            return;
        }
        if (status === 'shipped' || status === 'delivered') {
            // Validation: Ensure all items have shipping details
            const items = selected?.items || [];
            const incomplete = items.some(item => {
                const data = itemShippingData[item.id];
                return !data || !data.company || !data.tracking || !data.origin;
            });

            if (incomplete) {
                alert('Lütfen tüm ürünler için kargo firması, takip numarası ve çıkış yerini doldurun.');
                return;
            }

            setIsShippingConfirm(true);
            return;
        }
        executeStatusUpdate(id, status);
    };

    const downloadOrderExcel = (order) => {
        if (!order || !order.items) return;
        
        const dateStr = new Date(order.created_at).toLocaleString('tr-TR');
        const companyName = order.company?.name || '';
        
        let html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <style>
                    table { border-collapse: collapse; }
                    th { background: #f3f4f6; font-weight: bold; border: 1px solid #ccc; text-align: left; }
                    td { border: 1px solid #ccc; }
                </style>
            </head>
            <body>
                <table>
                    <thead>
                        <tr>
                            <th width="150">Tarih</th>
                            <th width="200">Satın Alan Firma</th>
                            <th width="250">Ürün Adı</th>
                            <th width="120">Ürün Kodu</th>
                            <th width="120">OEM No</th>
                            <th width="120">Ürünün Alındığı Firma</th>
                            <th width="80">Miktar</th>
                            <th width="120">Birim Fiyat</th>
                            <th width="120">Toplam Fiyat</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.items.map(item => `
                            <tr>
                                <td>${dateStr}</td>
                                <td>${companyName}</td>
                                <td>${item.product?.name || ''}</td>
                                <td>${item.product?.code || ''}</td>
                                <td>${item.product?.oem_no || ''}</td>
                                <td>${item.product?.supplier_brand || '-'}</td>
                                <td>${item.quantity}</td>
                                <td>₺${Number(item.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                <td>₺${Number(item.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                        `).join('')}
                        <tr>
                            <td colspan="8" style="text-align: right; font-weight: bold;">GENEL TOPLAM</td>
                            <td style="font-weight: bold;">₺${Number(order.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                    </tbody>
                </table>
            </body>
            </html>
        `;
        
        let blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        let url = URL.createObjectURL(blob);
        let link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Siparis_${order.id.split('-')[0]}_${companyName}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Sipariş Yönetimi</h1>
                    <p className="page-subtitle">{orders.length} sipariş listeleniyor</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button 
                        className={`btn ${isNotificationsEnabled ? 'btn-primary' : 'btn-ghost'}`} 
                        onClick={toggleNotifications}
                        title={isNotificationsEnabled ? "Sipariş Bildirimleri Açık" : "Sipariş Bildirimlerini Aç"}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        {isNotificationsEnabled ? <BellAlertIcon style={{ width: 20, height: 20 }} /> : <BellSlashIcon style={{ width: 20, height: 20 }} />}
                        <span>Zil {isNotificationsEnabled ? 'Açık' : 'Kapalı'}</span>
                    </button>
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
                                        <td>{new Date(o.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                        <td><button className="btn btn-ghost btn-sm" onClick={() => setSelected(o)} id={`detail-${o.id}`}>Detay</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {selected && (
                    <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: 20 }}>
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="card-title">Sipariş Detayı</h3>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => downloadOrderExcel(selected)} title="Excel olarak indir">
                                    <DocumentTextIcon style={{ width: 18, height: 18, marginRight: 4 }} /> Excel
                                </button>
                                <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
                            </div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Firma</div>
                            <div style={{ fontWeight: 600 }}>{selected.company?.name}</div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Ürünler</div>
                            {selected.items?.map(item => (
                                <div key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{item.product?.name}</div>
                                            <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                                                {item.product?.oem_no && (
                                                    <div style={{ color: 'var(--primary)', fontSize: 11, fontFamily: 'monospace' }}>OEM: {item.product.oem_no}</div>
                                                )}
                                                {item.product?.supplier_brand && (
                                                    <div style={{ color: '#eab308', fontSize: 11, fontWeight: 600 }}>Firma: {item.product.supplier_brand}</div>
                                                )}
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{item.quantity} × ₺{Number(item.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                        </div>
                                        <div style={{ fontWeight: 700 }}>₺{Number(item.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                    
                                    {/* Per-item Shipping Inputs */}
                                    {(selected.status !== 'delivered' && selected.status !== 'cancelled') && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, padding: 8, background: 'rgba(37,99,235,0.03)', borderRadius: 8 }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <input 
                                                    className="form-input" 
                                                    style={{ height: 28, fontSize: 11, padding: '4px 8px' }} 
                                                    placeholder="Kargo Firması" 
                                                    value={itemShippingData[item.id]?.company || ''} 
                                                    onChange={e => setItemShippingData({
                                                        ...itemShippingData, 
                                                        [item.id]: { ...itemShippingData[item.id], company: e.target.value }
                                                    })} 
                                                />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <input 
                                                    className="form-input" 
                                                    style={{ height: 28, fontSize: 11, padding: '4px 8px' }} 
                                                    placeholder="Takip No" 
                                                    value={itemShippingData[item.id]?.tracking || ''} 
                                                    onChange={e => setItemShippingData({
                                                        ...itemShippingData, 
                                                        [item.id]: { ...itemShippingData[item.id], tracking: e.target.value }
                                                    })} 
                                                />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                                                <select 
                                                    className="form-input" 
                                                    style={{ height: 28, fontSize: 11, padding: '0 8px' }} 
                                                    value={itemShippingData[item.id]?.origin || 'İstanbul'} 
                                                    onChange={e => setItemShippingData({
                                                        ...itemShippingData, 
                                                        [item.id]: { ...itemShippingData[item.id], origin: e.target.value }
                                                    })}
                                                >
                                                    <option value="İstanbul">İstanbul (Merkez)</option>
                                                    <option value="Depo">Depo</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {/* Display saved shipping info if exists */}
                                    {(item.shipping_company || item.tracking_number) && (
                                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--primary)', fontWeight: 500 }}>
                                            🚚 {item.shipping_company} - {item.tracking_number} ({item.shipping_origin})
                                        </div>
                                    )}
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
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                {selected.status === 'cancelled' ? 'Sipariş İptal Edildi (Değiştirilemez)' : 'Durumu Güncelle'}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {Object.entries(statusLabels).map(([key, label]) => (
                                    <button 
                                        key={key} 
                                        className={`btn btn-sm ${selected.status === key ? 'btn-primary' : 'btn-ghost'}`}
                                        onClick={() => updateStatus(selected.id, key)} 
                                        id={`status-${key}`}
                                        disabled={selected.status === 'cancelled'}
                                        style={selected.status === 'cancelled' ? { cursor: 'not-allowed', opacity: selected.status === key ? 1 : 0.4 } : {}}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {selected.status === 'cancelled' && (
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                                    Bu sipariş iptal edildiği için tutar iade edilmiştir ve durumu tekrar değiştirilemez.
                                </p>
                            )}
                        </div>
                        
                        {selected.is_stock_reduced && (
                            <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-surface)', borderRadius: 8, fontSize: 12, border: '1px solid var(--border)' }}>
                                <div style={{ fontWeight: 600, color: 'var(--primary)' }}>Sipariş Onaylandı ve Sevk Edildi</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Ürün bazlı kargo bilgilerini yukarıdaki listede görebilirsiniz.</div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {/* Custom Cancellation Confirmation Modal */}
            {isCancelling && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div className="card" style={{
                        maxWidth: 400,
                        width: '90%',
                        padding: 32,
                        textAlign: 'center',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                    }}>
                        <div style={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            background: '#fef2f2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px'
                        }}>
                            <BellAlertIcon style={{ width: 32, height: 32, color: '#dc2626' }} />
                        </div>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 12 }}>Emin misiniz?</h2>
                        <p style={{ color: '#4b5563', fontSize: 15, marginBottom: 24, lineHeight: '1.5' }}>
                            Siparişi iptal etmek üzeresiniz. <br />
                            <strong style={{ color: '#dc2626' }}>Bu işlem geri alınamaz.</strong><br />
                            İptal durumunda sipariş tutarı müşterinin cari hesabına iade edilecektir.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <button 
                                className="btn btn-ghost" 
                                onClick={() => { setIsCancelling(false); setCancelOrderId(null); }}
                                style={{ justifyContent: 'center' }}
                            >
                                Vazgeç
                            </button>
                            <button 
                                className="btn" 
                                style={{ backgroundColor: '#dc2626', color: 'white', justifyContent: 'center' }}
                                onClick={() => executeStatusUpdate(cancelOrderId, 'cancelled')}
                            >
                                Evet, İptal Et
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Shipping Confirmation Modal */}
            {isShippingConfirm && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div className="card" style={{
                        maxWidth: 450,
                        width: '90%',
                        padding: 32,
                        textAlign: 'center',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                    }}>
                        <div style={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            background: 'rgba(37,99,235,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px'
                        }}>
                            <ShoppingCartIcon style={{ width: 32, height: 32, color: 'var(--primary)' }} />
                        </div>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 12 }}>Siparişi Onaylıyor Musunuz?</h2>
                        <div style={{ textAlign: 'left', background: 'var(--bg-surface)', padding: 16, borderRadius: 12, marginBottom: 24, fontSize: 14 }}>
                            <div style={{ color: '#b91c1c', fontWeight: 700, textAlign: 'center' }}>
                                ⚠️ Stoklar her ürün için seçilen birimlerden (İstanbul/Depo) düşülecektir.
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <button 
                                className="btn btn-ghost" 
                                onClick={() => setIsShippingConfirm(false)}
                                style={{ justifyContent: 'center' }}
                            >
                                Vazgeç
                            </button>
                            <button 
                                className="btn btn-primary" 
                                style={{ justifyContent: 'center' }}
                                onClick={() => executeStatusUpdate(selected.id, selected.status === 'preparing' ? 'shipped' : 'delivered')}
                            >
                                Onayla ve Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
