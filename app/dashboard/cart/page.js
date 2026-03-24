'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/components/CartProvider';
import { ShoppingCartIcon, TrashIcon, CheckCircleIcon, ExclamationTriangleIcon, CreditCardIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

export default function CartPage() {
    const { cartItems, setQty, clearCart } = useCart();
    const [loading, setLoading] = useState(false);
    const [orderNote, setOrderNote] = useState('');
    const [paymentType, setPaymentType] = useState('bank_transfer'); // bank_transfer, credit_card
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [globalMargin, setGlobalMargin] = useState(36);
    const [rates, setRates] = useState({ USD: 1, EUR: 1 });
    const [globalUsdRate, setGlobalUsdRate] = useState(null);
    const [globalUsdActive, setGlobalUsdActive] = useState(false);
    const [discountPercent, setDiscount] = useState(0);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        async function fetchData() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('price_group_id').eq('id', user.id).single();
                if (profile?.price_group_id) {
                    const { data: pg } = await supabase.from('price_groups').select('discount_percent').eq('id', profile.price_group_id).single();
                    if (pg) setDiscount(pg.discount_percent);
                }
            }
            try {
                const [r, m, u] = await Promise.all([
                    fetch('/api/rates').then(res => res.json()),
                    fetch('/api/admin/margin').then(res => res.json()),
                    fetch('/api/admin/usd-settings').then(res => res.json())
                ]);
                if (r.USD) setRates(r);
                if (m.margin !== undefined) setGlobalMargin(m.margin);
                if (u.usd_rate !== undefined) setGlobalUsdRate(u.usd_rate);
                if (u.is_active !== undefined) setGlobalUsdActive(u.is_active);
            } catch (e) { console.error('Settings fetch error:', e); }
        }
        fetchData();
    }, [supabase]);

    const items = Object.values(cartItems || {});

    const getBaseTryPrice = (p) => {
        let initialPrice = Number(p.list_price) || 0;
        let rawCost = initialPrice / 1.36;
        let currentPrice = rawCost * (1 + (globalMargin / 100));

        if (globalUsdActive && globalUsdRate !== null && p.currency === 'USD') {
            currentPrice = currentPrice * globalUsdRate;
        } else {
            if (p.currency === 'USD') currentPrice = currentPrice * rates.USD;
            else if (p.currency === 'EUR') currentPrice = currentPrice * rates.EUR;
        }
        return currentPrice;
    };

    const getFinalPrice = (p) => {
        const base = getBaseTryPrice(p);
        const prodDisc = Number(p.discount_rate) || 0;
        const groupDisc = discountPercent || 0;
        return base * (1 - prodDisc / 100) * (1 - groupDisc / 100);
    };

    const subtotal = items.reduce((acc, item) => acc + (getFinalPrice(item.product) * item.qty), 0);
    const kdvAmount = subtotal * 0.20;
    const total = subtotal + kdvAmount;

    const handlePlaceOrder = async () => {
        if (items.length === 0) return;
        setLoading(true);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Oturum bulunamadı');

            const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
            if (!profile?.company_id) throw new Error('Şirket kaydı bulunamadı');

            // rpc call to create order properly
            const { data: orderResponse, error: orderError } = await supabase.rpc('place_b2b_order', {
                p_company_id: profile.company_id,
                p_user_id: user.id,
                p_items: items.map(item => ({
                    product_id: item.product.id,
                    qty: item.qty,
                    price: getFinalPrice(item.product),
                    currency: 'TRY'
                })),
                p_total: total,
                p_note: orderNote,
                p_payment_type: paymentType
            });

            if (orderError) throw orderError;

            if (orderResponse.success) {
                // Log order placement
                const cid = typeof window !== 'undefined' ? localStorage.getItem('b2b_company_id') : null;
                if (cid) {
                    fetch('/api/log-activity', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            company_id: cid,
                            action_type: 'order_placed',
                            details: { order_id: orderResponse.id, total: cartTotal }
                        })
                    }).catch(e => console.error(e));
                }

                setSuccess(true);
                clearCart();
                setTimeout(() => router.push('/dashboard/orders'), 2000);
            }
        } catch (err) {
            console.error('Order error:', err);
            setError(err.message || 'Sipariş oluşturulurken bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div className="card" style={{ maxWidth: 400, textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ background: '#dcfce7', color: '#16a34a', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <CheckCircleIcon style={{ width: 40, height: 40 }} />
                    </div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Siparişiniz Alındı!</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Siparişiniz başarıyla oluşturuldu. Siparişlerim sayfasına yönlendiriliyorsunuz...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Alışveriş Sepeti</h1>
                    <p className="page-subtitle">{items.length} ürün var</p>
                </div>
                <button className="btn btn-ghost" onClick={() => router.push('/dashboard/catalog')}>← Alışverişe Devam Et</button>
            </div>

            {items.length === 0 ? (
                <div className="card" style={{ padding: '60px 0', textAlign: 'center' }}>
                    <div className="empty-state-icon" style={{ margin: '0 auto 20px' }}><ShoppingCartIcon style={{ width: 48, height: 48 }} /></div>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Sepetiniz Boş</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Henüz sepetinize ürün eklemediniz.</p>
                    <button className="btn btn-primary" onClick={() => router.push('/dashboard/catalog')}>Ürünleri İncele</button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24 }}>
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="table-wrapper">
                            <table style={{ margin: 0 }}>
                                <thead>
                                    <tr>
                                        <th>Ürün Bilgisi</th>
                                        <th style={{ textAlign: 'center' }}>Miktar</th>
                                        <th style={{ textAlign: 'right' }}>Birim Fiyat</th>
                                        <th style={{ textAlign: 'right' }}>Toplam</th>
                                        <th style={{ width: 50 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(item => (
                                        <tr key={item.product.id}>
                                            <td>
                                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                    <div style={{ width: 50, height: 50, background: '#f8fafc', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                                        {item.product.image_url ? (
                                                            <img src={item.product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                        ) : (
                                                            <ShoppingCartIcon style={{ width: 24, height: 24, color: '#cbd5e1' }} />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.product.code}</div>
                                                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.product.name}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                                                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', minWidth: 28 }} onClick={() => setQty(item.product.id, item.product, Math.max(1, item.qty - 1))}>-</button>
                                                    <input
                                                        type="number"
                                                        value={item.qty}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value);
                                                            if (!isNaN(val) && val > 0) setQty(item.product.id, item.product, val);
                                                        }}
                                                        style={{ width: 45, textAlign: 'center', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600 }}
                                                    />
                                                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', minWidth: 28 }} onClick={() => setQty(item.product.id, item.product, item.qty + 1)}>+</button>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 14 }}>₺{getFinalPrice(item.product).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>₺{(getFinalPrice(item.product) * item.qty).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: 6 }} onClick={() => setQty(item.product.id, item.product, 0)}>
                                                    <TrashIcon style={{ width: 18, height: 18 }} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="card">
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Sipariş Özeti</h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Ara Toplam</span>
                                    <span style={{ fontWeight: 600 }}>₺{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>KDV (%20)</span>
                                    <span style={{ fontWeight: 600 }}>₺{kdvAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>
                                    <span>Toplam</span>
                                    <span>₺{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Ödeme Yöntemi</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <button
                                        onClick={() => setPaymentType('bank_transfer')}
                                        style={{
                                            padding: '10px',
                                            borderRadius: 8,
                                            border: '1px solid',
                                            borderColor: paymentType === 'bank_transfer' ? 'var(--primary)' : 'var(--border)',
                                            background: paymentType === 'bank_transfer' ? 'var(--primary-light)' : '#fff',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: 4,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <BanknotesIcon style={{ width: 24, height: 24, color: paymentType === 'bank_transfer' ? 'var(--primary)' : 'var(--text-muted)' }} />
                                        <span style={{ fontSize: 12, fontWeight: 600, color: paymentType === 'bank_transfer' ? 'var(--primary)' : 'var(--text-secondary)' }}>Havale/EFT</span>
                                    </button>
                                    <button
                                        onClick={() => setPaymentType('credit_card')}
                                        style={{
                                            padding: '10px',
                                            borderRadius: 8,
                                            border: '1px solid',
                                            borderColor: paymentType === 'credit_card' ? 'var(--primary)' : 'var(--border)',
                                            background: paymentType === 'credit_card' ? 'var(--primary-light)' : '#fff',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: 4,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <CreditCardIcon style={{ width: 24, height: 24, color: paymentType === 'credit_card' ? 'var(--primary)' : 'var(--text-muted)' }} />
                                        <span style={{ fontSize: 12, fontWeight: 600, color: paymentType === 'credit_card' ? 'var(--primary)' : 'var(--text-secondary)' }}>Kredi Kartı</span>
                                    </button>
                                </div>
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Sipariş Notu</label>
                                <textarea
                                    className="form-control"
                                    placeholder="Siparişle ilgili özel bir isteğiniz var mı?"
                                    rows={3}
                                    style={{ fontSize: 13, resize: 'none' }}
                                    value={orderNote}
                                    onChange={(e) => setOrderNote(e.target.value)}
                                />
                            </div>

                            {error && (
                                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                    <ExclamationTriangleIcon style={{ width: 18, height: 18, color: '#dc2626', flexShrink: 0 }} />
                                    <span style={{ fontSize: 12, color: '#991b1b', fontWeight: 500 }}>{error}</span>
                                </div>
                            )}

                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', height: 48, fontSize: 16, fontWeight: 700 }}
                                disabled={loading}
                                onClick={handlePlaceOrder}
                            >
                                {loading ? (
                                    <><span className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2, marginRight: 8 }} /> Sipariş İşleniyor...</>
                                ) : (
                                    'Siparişi Tamamla'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
