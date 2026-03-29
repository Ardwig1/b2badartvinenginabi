'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ShoppingCartIcon, CheckCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useCart } from '@/components/CartProvider';

export default function DealerCart() {
    const { cartItems: contextCartItems, setQty: ctxSetQty, addToCart: ctxAddToCart, clearCart } = useCart();

    // Convert cartItems object to array for rendering
    const cartItems = useMemo(() => {
        return Object.values(contextCartItems || {}).filter(item => item && item.qty > 0);
    }, [contextCartItems]);

    const isSelected = (id) => !(contextCartItems[id]?.unselected);

    const [discountPercent, setDiscountPercent] = useState(0);
    const [globalMargin, setGlobalMargin] = useState(36);
    const [globalUsdRate, setGlobalUsdRate] = useState(0);
    const [globalUsdActive, setGlobalUsdActive] = useState(false);
    const [companyId, setCompanyId] = useState('');
    const [shipping, setShipping] = useState('');
    const [shippingMethod, setShippingMethod] = useState('Kargo');
    const [isDifferentAddress, setIsDifferentAddress] = useState(false);
    const [note, setNote] = useState('');
    const [isPrepaymentLocked, setIsPrepaymentLocked] = useState(false);
    const [companyBalance, setCompanyBalance] = useState(0);
    const [companyRiskLimit, setCompanyRiskLimit] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(true);
    const [rates, setRates] = useState({ USD: 1, EUR: 1 });
    const [searchProducts, setSearchProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');

    const fetchUser = useCallback(async () => {
        try {
            // Force no-cache and include credentials for showroom sync
            const infoRes = await fetch(`/api/user/info?t=${Date.now()}`, { 
                cache: 'no-store',
                credentials: 'include'
            });
            if (infoRes.ok) {
                const infoData = await infoRes.json();
                setCompanyId(infoData.companyId || '');
                setCompanyBalance(Number(infoData.currentBalance) || 0);
                setDiscountPercent(Number(infoData.discountPercent) || 0);
                setIsPrepaymentLocked(infoData.isPrepaymentLocked || false);
                setCompanyRiskLimit(Number(infoData.riskLimit) || 0);
            }

            const [ratesRes, marginRes, usdRes] = await Promise.all([
                fetch('/api/rates'),
                fetch('/api/admin/margin'),
                fetch('/api/admin/usd-settings')
            ]);

            if (ratesRes.ok) {
                const data = await ratesRes.json();
                if (data?.USD && data?.EUR) setRates({ USD: data.USD, EUR: data.EUR });
            }
            if (marginRes.ok) {
                const marginData = await marginRes.json();
                if (marginData?.margin !== undefined) setGlobalMargin(marginData.margin);
            }
            if (usdRes.ok) {
                const usdData = await usdRes.json();
                if (usdData?.usd_rate !== undefined) setGlobalUsdRate(usdData.usd_rate);
                if (usdData?.is_active !== undefined) setGlobalUsdActive(usdData.is_active);
            }
        } catch (e) {
            console.error('Fetch user/settings error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchUser(); }, [fetchUser]);

    const getBaseTryPrice = useCallback((p) => {
        if (!p) return 0;
        let initialPrice = Number(p.list_price) || 0;
        let marginBase = (Number(p.profit_margin) || 36) / 100;
        let rawCost = initialPrice / (1 + marginBase);
        let price = rawCost * (1 + (globalMargin / 100));

        if (globalUsdActive && globalUsdRate > 0 && p.currency === 'USD') {
            price = price * globalUsdRate;
        } else {
            if (p.currency === 'USD') price = price * (rates.USD || 1);
            else if (p.currency === 'EUR') price = price * (rates.EUR || 1);
        }
        return price;
    }, [globalMargin, globalUsdActive, globalUsdRate, rates]);

    const getDiscountedPrice = useCallback((p) => {
        if (!p) return 0;
        const base = getBaseTryPrice(p);
        const prodDiscount = Number(p.discount_rate || 0);
        const groupDiscount = discountPercent || 0;
        const afterProd = base * (1 - prodDiscount / 100);
        const afterGroup = afterProd * (1 - groupDiscount / 100);
        return afterGroup;
    }, [getBaseTryPrice, discountPercent]);

    // Totals Calculation (Safe Version)
    const totals = useMemo(() => {
        const selected = cartItems.filter(i => isSelected(i.product.id));
        const sub = selected.reduce((acc, i) => acc + (getBaseTryPrice(i.product) * i.qty), 0);
        const afterDisc = selected.reduce((acc, i) => acc + (getDiscountedPrice(i.product) * i.qty), 0);
        const disc = sub - afterDisc;
        const v = afterDisc * 0.20;
        const grand = afterDisc + v;
        const liability = grand - companyBalance;
        const riskExc = companyRiskLimit > 0 && liability > companyRiskLimit;
        const excAmt = riskExc ? (liability - companyRiskLimit) : 0;
        const prepay = (isPrepaymentLocked && companyBalance < grand) || riskExc;

        return { subtotal: sub, totalAfterDiscount: afterDisc, totalDiscount: disc, vat: v, grandTotal: grand, isRiskExceeded: riskExc, exceededAmount: excAmt, needsPrepayment: prepay, selectedCount: selected.length };
    }, [cartItems, contextCartItems, getBaseTryPrice, getDiscountedPrice, companyBalance, companyRiskLimit, isPrepaymentLocked]);

    const placeOrder = async () => {
        const selectedItems = cartItems.filter(i => isSelected(i.product.id));
        if (selectedItems.length === 0) return;

        if (totals.needsPrepayment) {
            const paymentAmount = totals.isRiskExceeded ? totals.exceededAmount : totals.grandTotal;
            sessionStorage.setItem('pendingCartTotal', totals.grandTotal.toString());
            window.location.href = `/dashboard/payment?amount=${paymentAmount.toFixed(2)}&context=cart`;
            return;
        }

        setSubmitting(true);
        const finalAddress = isDifferentAddress ? shipping : 'Sistem Kayıtlı Firma Adresi';
        const finalNote = `[${shippingMethod}] ${note}`;

        try {
            const p_items = selectedItems.map(i => ({
                product_id: i.product.id,
                quantity: i.qty,
                unit_price: getDiscountedPrice(i.product),
                total_price: getDiscountedPrice(i.product) * i.qty
            }));

            const response = await fetch('/api/user/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: companyId,
                    shippingAddress: finalAddress,
                    note: finalNote,
                    totalAmount: totals.grandTotal,
                    items: p_items
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Sipariş oluşturulamadı');

            if (data?.success) {
                await fetch('/api/log-activity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        company_id: companyId, 
                        action_type: 'order_placed', 
                        details: { order_id: data.order_id, total_amount: totals.grandTotal, items_count: selectedItems.length } 
                    })
                }).catch(e => console.error("Log error", e));

                for (const item of selectedItems) {
                    ctxSetQty(item.product.id, item.product, 0);
                }
                setSuccess(true);
            }
        } catch (error) {
            alert("HATA: " + (error.message || "Sipariş verilirken bir sorun oluştu."));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div className="loading-spinner" style={{ width: 48, height: 48, border: '4px solid var(--border)', borderTopColor: 'var(--primary)' }} />
                <div style={{ marginTop: 20, fontWeight: 600, color: 'var(--text-secondary)', fontSize: 15 }}>Sepet Hesaplanıyor...</div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="page-wrapper" style={{ textAlign: 'center', paddingTop: 80 }}>
                <div style={{ color: '#16a34a', marginBottom: 20, display: 'flex', justifyContent: 'center' }}><CheckCircleIcon style={{ width: 72, height: 72 }} /></div>
                <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Sipariş Alındı!</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>Siparişiniz oluşturuldu. Siparişlerim sayfasından takip edebilirsiniz.</p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <a href="/dashboard/orders" className="btn btn-primary">Siparişlerimə Git</a>
                    <a href="/dashboard/catalog" className="btn btn-ghost">Alışverişe Devam</a>
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Sepetim & Sipariş Ver</h1>
                    <p className="page-subtitle">{cartItems.length} ürün çeşidi</p>
                </div>
                <a href="/dashboard/catalog" className="btn btn-ghost">← Kataloğa Dön</a>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
                <div>
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-title" style={{ marginBottom: 12 }}>Katalogdan Ekle</div>
                        <div style={{ position: 'relative' }}>
                            <div className="search-bar" style={{ width: '100%' }}>
                                <span className="search-icon"><MagnifyingGlassIcon style={{ width: 14, height: 14 }} /></span>
                                <input placeholder="Ürün adı veya kodunu yazın..." value={productSearch} onChange={e => {
                                    setProductSearch(e.target.value);
                                    if (e.target.value.length < 2) { setSearchProducts([]); return; }
                                    fetch('/api/products/search', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ filterText: e.target.value })
                                    }).then(r => r.json()).then(data => setSearchProducts((data || []).slice(0, 6))).catch(err => console.error(err));
                                }} id="cart-product-search" />
                            </div>
                            {searchProducts.length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', zIndex: 100, marginTop: 4 }}>
                                    {searchProducts.map(p => (
                                        <div key={p.id} style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)' }}
                                            onClick={() => { ctxAddToCart(p); setProductSearch(''); setSearchProducts([]); }}>
                                            <div><div style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.code}</div></div>
                                            <div style={{ color: 'var(--primary)', fontWeight: 600 }}>₺{getDiscountedPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {cartItems.length === 0 ? (
                        <div className="card"><div className="empty-state"><div className="empty-state-icon"><ShoppingCartIcon style={{ width: 32, height: 32 }} /></div><div className="empty-state-title">Sepetiniz boş</div><div className="empty-state-text">Katalogdan ürün ekleyin</div></div></div>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => cartItems.forEach(i => ctxSetQty(i.product.id, i.product, i.qty, false))}>☑ Tümünü Seç</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => cartItems.forEach(i => ctxSetQty(i.product.id, i.product, i.qty, true))}>☐ Seçimi Kaldır</button>
                                <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>{totals.selectedCount} / {cartItems.length} ürün seçili</span>
                            </div>
                            <div className="table-wrapper">
                                <table>
                                    <thead><tr><th>Ürün</th><th>Marka</th><th>Birim Fiyat (KDV'siz)</th><th>Miktar</th><th>Toplam (KDV'siz)</th><th style={{ textAlign: 'center' }}>Seç</th><th></th></tr></thead>
                                    <tbody>
                                        {cartItems.map(({ product: p, qty }) => {
                                            const itemSelected = isSelected(p.id);
                                            return (
                                                <tr key={p.id} style={{ opacity: itemSelected ? 1 : 0.5 }}>
                                                    <td><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.code}</div></td>
                                                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{p.brand || '-'}</td>
                                                    <td>₺{getDiscountedPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><button className="btn btn-ghost btn-sm" onClick={() => ctxSetQty(p.id, p, qty - 1, !itemSelected)}>−</button><span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>{qty}</span><button className="btn btn-ghost btn-sm" onClick={() => ctxSetQty(p.id, p, qty + 1, !itemSelected)}>+</button></div></td>
                                                    <td style={{ fontWeight: 600 }}>₺{(getDiscountedPrice(p) * qty).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'center' }}><input type="checkbox" checked={itemSelected} onChange={() => ctxSetQty(p.id, p, qty, itemSelected)} style={{ width: 18, height: 18, cursor: 'pointer' }} /></td>
                                                    <td><button className="btn btn-danger btn-sm" onClick={() => ctxSetQty(p.id, p, 0)}>✕</button></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="card" style={{ position: 'sticky', top: 20 }}>
                    <div className="card-title" style={{ marginBottom: 16 }}>Sipariş Özeti</div>
                    <div className="form-group"><label className="form-label">Gönderim Şekli</label><select className="form-input" value={shippingMethod} onChange={e => setShippingMethod(e.target.value)}><option value="Kargo">Kargo</option><option value="Kurye">Kurye</option><option value="Elden Teslim">Elden Teslim</option></select></div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" id="diff-address" checked={isDifferentAddress} onChange={e => setIsDifferentAddress(e.target.checked)} /><label htmlFor="diff-address" style={{ cursor: 'pointer' }}>Farklı Sevk Adresi</label></div>
                    {isDifferentAddress && <div className="form-group"><textarea className="form-textarea" value={shipping} onChange={e => setShipping(e.target.value)} placeholder="Teslimat adresi..." /></div>}
                    <div className="form-group"><label className="form-label">Sepet Notu</label><textarea className="form-textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="Siparişle ilgili notunuz..." /></div>
                    <hr className="divider" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', gap: 20 }}><span>Ara Toplam</span><span>₺{totals.subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span></div>
                        {discountPercent > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)', gap: 20 }}><span>İskonto (%{discountPercent})</span><span>-₺{totals.totalDiscount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span></div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', gap: 20 }}><span>KDV (%20)</span><span>₺{totals.vat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 800, color: 'var(--primary)', marginBottom: 16, gap: 20 }}><span>Genel Toplam</span><span>₺{totals.grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span></div>
                    {totals.isRiskExceeded && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '10px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 16, border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center' }}>Risk limitini ₺{totals.exceededAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} aşıyorsunuz</div>}
                    <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', backgroundColor: totals.needsPrepayment && !submitting ? 'var(--danger)' : undefined }} disabled={totals.selectedCount === 0 || submitting} onClick={placeOrder}>{submitting ? 'Sipariş veriliyor...' : totals.selectedCount === 0 ? 'Ürün seçin' : totals.isRiskExceeded ? 'LİMİT AŞILDI (ÖDEME YAP)' : totals.needsPrepayment ? 'YETERSİZ BAKİYE (ÖN ÖDEME)' : `✓ ${totals.selectedCount} Ürün Sipariş Et`}</button>
                </div>
            </div>
        </div>
    );
}
