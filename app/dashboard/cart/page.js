'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getUserDiscount } from '../actions';
import { ShoppingCartIcon, CheckCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useCart } from '@/components/CartProvider';

export default function DealerCart() {
    const { cartItems: contextCartItems, setQty: ctxSetQty, addToCart: ctxAddToCart, clearCart } = useCart();

    // Convert cartItems object to array for rendering
    const cartItems = useMemo(() => {
        return Object.values(contextCartItems).filter(item => item.qty > 0);
    }, [contextCartItems]);

    const isSelected = (id) => !(contextCartItems[id]?.unselected);

    const [products, setProducts] = useState([]);
    const [discountPercent, setDiscountPercent] = useState(0);
    const [globalMargin, setGlobalMargin] = useState(36);
    const [globalUsdRate, setGlobalUsdRate] = useState(0);
    const [globalUsdActive, setGlobalUsdActive] = useState(false);
    const [companyId, setCompanyId] = useState('');
    const [companyData, setCompanyData] = useState({});
    const [shipping, setShipping] = useState('');
    const [shippingMethod, setShippingMethod] = useState('Kargo');
    const [isDifferentAddress, setIsDifferentAddress] = useState(false);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(true);
    const [rates, setRates] = useState({ USD: 1, EUR: 1 });
    const [stockError, setStockError] = useState('');
    const supabase = createClient();

    const fetchUser = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
            .from('profiles')
            .select('company_id, companies(current_balance, is_prepayment_locked, risk_limit)')
            .eq('id', user.id)
            .single();
        setCompanyId(profile?.company_id || '');
        setCompanyData(profile?.companies || {});

        if (user?.id) {
            const disc = await getUserDiscount(user.id);
            setDiscountPercent(disc || 0);
        }

        try {
            const res = await fetch('/api/rates');
            const data = await res.json();
            if (data?.USD && data?.EUR) setRates({ USD: data.USD, EUR: data.EUR });
        } catch (e) {
            console.error('Rates fetch error:', e);
        }

        try {
            const [marginRes, usdRes] = await Promise.all([
                fetch('/api/admin/margin'),
                fetch('/api/admin/usd-settings')
            ]);
            const marginData = await marginRes.json();
            const usdData = await usdRes.json();

            if (marginData?.margin !== undefined) {
                setGlobalMargin(marginData.margin);
            }
            if (usdData?.usd_rate !== undefined) {
                setGlobalUsdRate(usdData.usd_rate);
            }
            if (usdData?.is_active !== undefined) {
                setGlobalUsdActive(usdData.is_active);
            }
        } catch (e) {
            console.error('Settings fetch error:', e);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchUser(); }, [fetchUser]);

    const getBaseTryPrice = (p) => {
        let initialPrice = Number(p.list_price) || 0;
        let rawCost = initialPrice / 1.36;
        let price = rawCost * (1 + (globalMargin / 100));

        if (globalUsdActive && globalUsdRate !== null && globalUsdRate >= 0 && p.currency === 'USD') {
            price = price * globalUsdRate;
        } else {
            if (p.currency === 'USD') price = price * rates.USD;
            else if (p.currency === 'EUR') price = price * rates.EUR;
        }
        return price;
    };
    const getDiscountedPrice = (p) => {
        const base = getBaseTryPrice(p);
        const prodDiscount = Number(p.discount_rate || 0);
        const groupDiscount = discountPercent || 0;

        const afterProd = base * (1 - prodDiscount / 100);
        const afterGroup = afterProd * (1 - groupDiscount / 100);
        return afterGroup;
    };

    const addProduct = async (productId) => {
        if (!productId) return;
        const { data: prod } = await supabase.from('products').select('*').eq('id', productId).single();
        if (prod) ctxAddToCart(prod);
    };

    const [searchProducts, setSearchProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');

    const searchProds = async (q) => {
        setProductSearch(q);
        if (q.length < 2) { setSearchProducts([]); return; }
        const { data } = await supabase.from('products').select('*').eq('is_active', true).or(`name.ilike.%${q}%,code.ilike.%${q}%`).limit(6);
        setSearchProducts(data || []);
    };

    const updateQty = (p, delta) => {
        const currentQty = contextCartItems[p.id]?.qty || 0;
        const newQty = currentQty + delta;
        if (newQty > (p.stock_quantity ?? Infinity)) return; // block exceeding stock
        ctxSetQty(p.id, p, newQty, contextCartItems[p.id]?.unselected);
    };
    const removeItem = (p) => {
        ctxSetQty(p.id, p, 0);
    };

    const toggleSelect = (id) => {
        const item = contextCartItems[id];
        if (item) {
            ctxSetQty(id, item.product, item.qty, !item.unselected);
        }
    };
    const selectAll = () => {
        cartItems.forEach(i => ctxSetQty(i.product.id, i.product, i.qty, false));
    };
    const deselectAll = () => {
        cartItems.forEach(i => ctxSetQty(i.product.id, i.product, i.qty, true));
    };

    useEffect(() => {
        if (!loading && companyData && typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('autoSubmit') === 'true') {
                if (cartItems.length > 0) {
                    window.history.replaceState(null, '', window.location.pathname);
                    try {
                        const saved = localStorage.getItem('b2b_cart_shipping');
                        if (saved) {
                            const p = JSON.parse(saved);
                            if (p.shipping) setShipping(p.shipping);
                            if (p.shippingMethod) setShippingMethod(p.shippingMethod);
                            if (p.isDifferentAddress !== undefined) setIsDifferentAddress(p.isDifferentAddress);
                            if (p.note) setNote(p.note);
                        }
                    } catch (e) {}
                    setTimeout(() => { document.getElementById('place-order-btn')?.click(); }, 600);
                }
            }
        }
    }, [loading, companyData, cartItems.length]);

    const selectedCartItems = cartItems.filter(i => isSelected(i.product.id));
    const subtotal = selectedCartItems.reduce((acc, i) => acc + (getBaseTryPrice(i.product) * i.qty), 0);
    const totalDiscount = selectedCartItems.reduce((acc, i) => acc + (getBaseTryPrice(i.product) * (discountPercent / 100) * i.qty), 0);
    const totalAfterDiscount = subtotal - totalDiscount;
    const vat = totalAfterDiscount * 0.20;
    const grandTotal = Number((totalAfterDiscount + vat).toFixed(2));

    const placeOrder = async () => {
        if (selectedCartItems.length === 0) return;
        
        // Prepayment lock is now handled in the button onClick
        
        setSubmitting(true);
        const finalAddress = isDifferentAddress ? shipping : 'Sistem Kayıtlı Firma Adresi';
        const finalNote = `[${shippingMethod}] ${note}`;

        try {
            const orderItemsJson = selectedCartItems.map(i => ({
                product_id: i.product.id,
                quantity: i.qty,
                unit_price: getDiscountedPrice(i.product),
                total_price: getDiscountedPrice(i.product) * i.qty,
            }));

            const { data: result, error: orderError } = await supabase.rpc('place_b2b_order', {
                p_company_id: companyId,
                p_shipping_address: finalAddress,
                p_note: finalNote,
                p_total_amount: grandTotal,
                p_items: orderItemsJson
            });

            if (orderError) throw orderError;

            // Only remove ordered (selected) items from cart, keep the rest
            for (const item of selectedCartItems) {
                ctxSetQty(item.product.id, item.product, 0);
            }
            setStockError('');
            setSuccess(true);

        } catch (error) {
            console.error("Order placement failed:", error);
            const msg = error.message || '';
            if (msg.includes('Stok yetersiz')) {
                setStockError(msg);
            } else {
                alert("Sipariş verilirken bir hata oluştu: " + (msg || "Lütfen tekrar deneyin."));
            }
        } finally {
            setSubmitting(false);
        }
    };

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
                    {/* Product search & add */}
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-title" style={{ marginBottom: 12 }}>Katalogdan Ekle</div>
                        <div style={{ position: 'relative' }}>
                            <div className="search-bar" style={{ width: '100%' }}>
                                <span className="search-icon"><MagnifyingGlassIcon style={{ width: 14, height: 14 }} /></span>
                                <input placeholder="Ürün adı veya kodunu yazın..." value={productSearch} onChange={e => searchProds(e.target.value)} id="cart-product-search" />
                            </div>
                            {searchProducts.length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', zIndex: 100, marginTop: 4 }}>
                                    {searchProducts.map(p => (
                                        <div key={p.id} style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)' }}
                                            onClick={() => { addProduct(p.id); setProductSearch(''); setSearchProducts([]); }}>
                                            <div>
                                                <div style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.code}</div>
                                            </div>
                                            <div style={{ color: 'var(--primary)', fontWeight: 600 }}>₺{getDiscountedPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart items */}
                    {cartItems.length === 0 ? (
                        <div className="card"><div className="empty-state"><div className="empty-state-icon"><ShoppingCartIcon style={{ width: 32, height: 32 }} /></div><div className="empty-state-title">Sepetiniz boş</div><div className="empty-state-text">Katalogdan ürün ekleyin</div></div></div>
                    ) : (
                        <div>
                            {/* Select all / Deselect all */}
                            <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
                                <button className="btn btn-ghost btn-sm" onClick={selectAll} style={{ fontSize: 13 }}>☑ Tümünü Seç</button>
                                <button className="btn btn-ghost btn-sm" onClick={deselectAll} style={{ fontSize: 13 }}>☐ Seçimi Kaldır</button>
                                <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>{selectedCartItems.length} / {cartItems.length} ürün seçili</span>
                            </div>
                            <div className="table-wrapper">
                                <table>
                                    <thead><tr><th>Ürün</th><th>Marka</th><th>Stok</th><th>Birim Fiyat</th><th>Miktar</th><th>Toplam</th><th style={{ textAlign: 'center' }}>Seç</th><th></th></tr></thead>
                                    <tbody>
                                        {cartItems.map(({ product: p, qty }) => {
                                            const itemSelected = isSelected(p.id);
                                            return (
                                                <tr key={p.id} style={{ opacity: itemSelected ? 1 : 0.5, transition: 'opacity 0.15s', background: qty > (p.stock_quantity ?? qty) ? 'rgba(220,38,38,0.05)' : 'transparent' }}>
                                                    <td>
                                                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.code}</div>
                                                    </td>
                                                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{p.brand || '-'}</td>
                                                    <td>
                                                        <span style={{ fontWeight: 600, color: (p.stock_quantity ?? 1) === 0 ? 'var(--danger)' : (p.stock_quantity ?? 99) < 5 ? '#f59e0b' : 'var(--success)', fontSize: 13 }}>
                                                            {p.stock_quantity ?? '?'}
                                                        </span>
                                                    </td>
                                                    <td>₺{getDiscountedPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <button className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }} onClick={() => updateQty(p, -1)} disabled={qty <= 1}>−</button>
                                                            <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>{qty}</span>
                                                            <button className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }} onClick={() => updateQty(p, 1)} disabled={qty >= (p.stock_quantity ?? Infinity)} title={qty >= (p.stock_quantity ?? Infinity) ? 'Mevcut stok bu kadar' : ''}>+</button>
                                                        </div>
                                                        {qty > (p.stock_quantity ?? qty) && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>Stok yetersiz!</div>}
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>₺{(getDiscountedPrice(p) * qty).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={itemSelected}
                                                            onChange={() => toggleSelect(p.id)}
                                                            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--primary)', margin: '0 auto', display: 'block' }}
                                                        />
                                                    </td>
                                                    <td><button className="btn btn-danger btn-sm" onClick={() => removeItem(p)}>✕</button></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Order summary */}
                <div className="card" style={{ position: 'sticky', top: 20 }}>
                    <div className="card-title" style={{ marginBottom: 16 }}>Sipariş Özeti</div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">Gönderim Şekli</label>
                        <select className="form-input" value={shippingMethod} onChange={e => setShippingMethod(e.target.value)}>
                            <option value="Kargo">Kargo</option>
                            <option value="Kurye">Kurye</option>
                            <option value="Elden Teslim">Elden Teslim</option>
                        </select>
                    </div>

                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <input type="checkbox" id="diff-address" checked={isDifferentAddress} onChange={e => setIsDifferentAddress(e.target.checked)} />
                        <label htmlFor="diff-address" style={{ margin: 0, fontWeight: 500, cursor: 'pointer' }}>Farklı Sevk Adresi Kullan</label>
                    </div>

                    {isDifferentAddress && (
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label">Farklı Teslimat Adresi</label>
                            <textarea className="form-textarea" style={{ minHeight: 70 }} value={shipping} onChange={e => setShipping(e.target.value)} placeholder="Teslimat adresi..." id="shipping-address" />
                        </div>
                    )}

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">Sepet Notu (opsiyonel)</label>
                        <textarea className="form-textarea" style={{ minHeight: 70 }} value={note} onChange={e => setNote(e.target.value)} placeholder="Siparişle ilgili notunuz..." id="order-note" />
                    </div>

                    <hr className="divider" style={{ margin: '16px 0' }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                            <span>Ara Toplam</span>
                            <span>₺{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {discountPercent > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                                <span>İskonto (%{discountPercent})</span>
                                <span>-₺{totalDiscount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                            <span>KDV (%20)</span>
                            <span>₺{vat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 800, color: 'var(--primary)', fontFamily: 'Outfit, sans-serif', marginBottom: 16 }}>
                        <span>Genel Toplam</span>
                        <span>₺{grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                    </div>

                    {stockError && (
                        <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 12, fontSize: 13, color: 'var(--danger)', lineHeight: 1.5 }}>
                            ⚠️ {stockError}
                        </div>
                    )}
                    {(() => {
                        const debt = (Number(companyData.current_balance) || 0) < 0 ? Math.abs(Number(companyData.current_balance)) : 0;
                        const riskLimit = Number(companyData.risk_limit) || 0;
                        const exceedsRisk = riskLimit > 0 && (debt + grandTotal) > riskLimit;
                        const isPrepaymentNeeded = companyData?.is_prepayment_locked && (Number(companyData.current_balance) || 0) < grandTotal;

                        return (
                            <button
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%', justifyContent: 'center' }}
                                disabled={selectedCartItems.length === 0 || submitting || selectedCartItems.some(i => i.qty > (i.product.stock_quantity ?? i.qty)) || exceedsRisk}
                                onClick={() => { 
                                    setStockError(''); 
                                    if (isPrepaymentNeeded) {
                                        sessionStorage.setItem('pendingCartTotal', grandTotal);
                                        window.location.href = `/dashboard/payment`;
                                    } else {
                                        placeOrder(); 
                                    }
                                }}
                                id="place-order-btn"
                            >
                                {submitting ? 'İşleniyor...' : 
                                 selectedCartItems.length === 0 ? 'Ürün seçin' : 
                                 selectedCartItems.some(i => i.qty > (i.product.stock_quantity ?? i.qty)) ? '⚠️ Stok yetersiz' : 
                                 exceedsRisk ? `Yetersiz Bakiye (Limit: ₺${riskLimit.toLocaleString('tr-TR')})` :
                                 isPrepaymentNeeded ? 'Yetersiz Bakiye (Ön Ödeme Gerekli)' : 
                                 `✓ ${selectedCartItems.length} Ürün Sipariş Et`}
                            </button>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}
