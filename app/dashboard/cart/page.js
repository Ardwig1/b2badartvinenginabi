'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ShoppingCartIcon, CheckCircleIcon, MagnifyingGlassIcon, TrashIcon, PlusIcon, MinusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useCart } from '@/components/CartProvider';
import { createClient } from '@/lib/supabase/client';

const showCode = (code) => { if (!code) return null; const s = code.replace(/[a-zA-Z]/g, ''); return s || null; };

const getCircleStyle = (qty, size = 12) => {
    let bg, border, boxShadow;
    if (qty > 15) { bg = 'linear-gradient(135deg, #22c55e, #15803d)'; border = '1px solid #14532d'; boxShadow = `0 0 ${size / 2}px rgba(34, 197, 94, 0.8), inset 0 2px 4px rgba(255,255,255,0.4)`; }
    else if (qty > 0) { bg = 'linear-gradient(90deg, #22c55e 50%, #475569 50%)'; border = '1px solid #1e293b'; boxShadow = `0 0 ${size / 2}px rgba(34, 197, 94, 0.5), inset 0 2px 4px rgba(255,255,255,0.2)`; }
    else { bg = 'linear-gradient(135deg, #ef4444, #991b1b)'; border = '1px solid #7f1d1d'; boxShadow = `0 0 ${size / 2}px rgba(239, 68, 68, 0.8), inset 0 2px 4px rgba(255,255,255,0.4)`; }
    return { width: size, height: size, borderRadius: '50%', background: bg, border, boxShadow, display: 'inline-block', flexShrink: 0 };
};

export default function DealerCart() {
    const { cartItems: contextCartItems, setQty: ctxSetQty, addToCart: ctxAddToCart, clearCart } = useCart();
    const supabase = createClient();

    const cartItems = useMemo(() => {
        return Object.values(contextCartItems || {})
            .filter(item => item && item.product && item.product.id && item.qty > 0);
    }, [contextCartItems]);

    // Refresh products when cart is opened to ensure latest prices/margins
    useEffect(() => {
        const refreshCartProducts = async () => {
            if (!cartItems || cartItems.length === 0) return;
            try {
                const ids = cartItems.map(i => i.product.id).filter(Boolean);
                if (ids.length === 0) return;
                const { data, error } = await supabase.from('products').select('*').in('id', ids);
                if (!error && data) {
                    data.forEach(p => {
                        const current = contextCartItems[p.id];
                        if (current && (current.product.cost_price !== p.cost_price || current.product.profit_margin !== p.profit_margin || current.product.list_price !== p.list_price)) {
                            ctxSetQty(p.id, p, current.qty, !!current.unselected);
                        }
                    });
                }
            } catch (e) { console.error("Refresh cart error:", e); }
        };
        refreshCartProducts();
    }, []);

    const isSelected = (id) => id && !(contextCartItems[id]?.unselected);

    const [discountPercent, setDiscountPercent] = useState(0);
    const [priceGroup, setPriceGroup] = useState(null);
    const [extraDiscounts, setExtraDiscounts] = useState([]);
    const [globalMargin, setGlobalMargin] = useState(0); // Default to 0 for dealers
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
    const [isShowroom, setIsShowroom] = useState(false);
    const [bypassPrepayment, setBypassPrepayment] = useState(false);
    const [bypassRiskLimit, setBypassRiskLimit] = useState(false);
    const [freeShippingThreshold, setFreeShippingThreshold] = useState(0);
    const [shippingCost, setShippingCost] = useState(0);
    const [isHavale, setIsHavale] = useState(false);
    const [rates, setRates] = useState({ USD: 1, EUR: 1 });
    const [searchProducts, setSearchProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [manualPrices, setManualPrices] = useState({});

    const fetchUser = useCallback(async () => {
        try {
            const infoRes = await fetch(`/api/user/info?t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
            if (infoRes.ok) {
                const infoData = await infoRes.json();
                setCompanyId(infoData.companyId || '');
                setCompanyBalance(Number(infoData.currentBalance) || 0);
                setDiscountPercent(Number(infoData.discountPercent) || 0);
                setPriceGroup(infoData.priceGroup || null);
                setExtraDiscounts(infoData.extraDiscounts || []);
                setIsPrepaymentLocked(infoData.isPrepaymentLocked || false);
                setCompanyRiskLimit(Number(infoData.riskLimit) || 0);
                setIsShowroom(!!infoData.isImpersonating);
            }
            const [ratesRes, usdRes] = await Promise.all([
                fetch('/api/rates'), fetch('/api/admin/usd-settings')
            ]);
            if (ratesRes.ok) { const data = await ratesRes.json(); setRates({ USD: data.USD || 1, EUR: data.EUR || 1 }); }
            if (usdRes.ok) { const usdData = await usdRes.json(); setGlobalUsdRate(usdData.usd_rate || 0); setGlobalUsdActive(usdData.is_active || false); setFreeShippingThreshold(Number(usdData.free_shipping_threshold) || 0); setShippingCost(Number(usdData.shipping_cost) || 0); }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchUser(); }, [fetchUser]);

    const getBaseTryPrice = useCallback((p) => {
        if (!p) return 0;
        let price = Number(p.list_price) || 0;
        // Apply globalMargin if showroom mode is on
        if (globalMargin > 0) {
            price = price * (1 + (globalMargin / 100));
        }

        if (globalUsdActive && globalUsdRate > 0 && p.currency === 'USD') price = price * globalUsdRate;
        else {
            if (p.currency === 'USD') price = price * (rates.USD || 1);
            else if (p.currency === 'EUR') price = price * (rates.EUR || 1);
        }
        return price;
    }, [globalMargin, globalUsdActive, globalUsdRate, rates]);

    const getDiscountedPrice = useCallback((p) => {
        if (!p) return 0;
        if (p.is_fixed_price && p.fixed_price_value > 0) {
            let price = Number(p.fixed_price_value);
            const cur = p.fixed_price_currency || 'TRY';
            if (cur === 'USD' && rates?.USD) price *= rates.USD;
            else if (cur === 'EUR' && rates?.EUR) price *= rates.EUR;
            return price / 1.20;
        }
        const base = getBaseTryPrice(p);
        const prodDiscount = Number(p.discount_rate || 0);
        
        let effectiveGroupDiscount = discountPercent || 0;
        if (priceGroup?.rules && p.supplier_brand) {
            const rule = priceGroup.rules[p.supplier_brand];
            if (rule !== undefined) effectiveGroupDiscount = Number(rule);
        }
        if (p.is_fixed_price) effectiveGroupDiscount = 0;

        const cartDiscount = Number(p.cart_discount_rate || 0);
        
        const afterProd = base * (1 - prodDiscount / 100);
        const afterGroup = afterProd * (1 - effectiveGroupDiscount / 100);
        const afterCart = afterGroup * (1 - cartDiscount / 100);
        
        return afterCart;
    }, [getBaseTryPrice, discountPercent, priceGroup, rates]);

    const totals = useMemo(() => {
        const selected = cartItems.filter(i => i.product && i.product.id && isSelected(i.product.id));
        let sub = 0, afterDisc = 0;
        selected.forEach(item => {
            const p = item.product, qty = item.qty;
            if (!p) return;
            sub += getBaseTryPrice(p) * qty;

            // Showroom Price Override Logic
            const manualVatIncl = isShowroom ? Number(manualPrices[p.id]) : 0;
            if (manualVatIncl > 0) {
                afterDisc += (manualVatIncl / 1.20) * qty;
            } else {
                const normalDiscPrice = getDiscountedPrice(p);
                const extra = extraDiscounts.find(d => d.product_id === p.id);
                if (extra) afterDisc += (normalDiscPrice * (1 - Number(extra.discount_rate) / 100)) * qty;
                else afterDisc += normalDiscPrice * qty;
            }
        });
        const disc = sub - afterDisc, v = afterDisc * 0.20, grand = afterDisc + v;

        // Havale iskontosu (%3)
        const havaleDiscountAmount = isHavale ? grand * 0.03 : 0;
        const grandAfterHavale = grand - havaleDiscountAmount;

        // Shipping (havale sonrası tutara göre hesapla)
        const hasShippingSettings = freeShippingThreshold > 0 && shippingCost > 0;
        const shippingFee = (hasShippingSettings && selected.length > 0 && grandAfterHavale < freeShippingThreshold) ? shippingCost : 0;
        const isShippingFree = hasShippingSettings && selected.length > 0 && grandAfterHavale >= freeShippingThreshold;
        const finalTotal = grandAfterHavale + shippingFee;
        const shippingProgress = hasShippingSettings ? Math.min((grandAfterHavale / freeShippingThreshold) * 100, 100) : 100;
        const remainingForFreeShipping = hasShippingSettings ? Math.max(freeShippingThreshold - grandAfterHavale, 0) : 0;

        const liability = finalTotal - companyBalance;
        const riskExc = companyRiskLimit > 0 && liability > companyRiskLimit;
        return {
            subtotal: sub, totalAfterDiscount: afterDisc, totalDiscount: disc, vat: v, grandTotal: grand,
            havaleDiscountAmount,
            shippingFee, isShippingFree, hasShippingSettings, finalTotal, shippingProgress, remainingForFreeShipping,
            isRiskExceeded: riskExc,
            exceededAmount: riskExc ? (liability - companyRiskLimit) : 0,
            needsPrepayment: (isPrepaymentLocked && companyBalance < finalTotal) || riskExc,
            selectedCount: selected.length
        };
    }, [cartItems, contextCartItems, getBaseTryPrice, getDiscountedPrice, extraDiscounts, companyBalance, companyRiskLimit, isPrepaymentLocked, isShowroom, manualPrices, freeShippingThreshold, shippingCost, isHavale]);

    const handleSetQty = (pid, p, q, unselected) => {
        ctxSetQty(pid, p, q, unselected);
        
        // Reset manual price if quantity changes (as requested: "bir adet daha eklerse gerçek fiyattan eklensin")
        if (manualPrices[pid]) {
            setManualPrices(prev => {
                const newState = { ...prev };
                delete newState[pid];
                return newState;
            });
        }
        
        // LOG ACTIVITY: CART REMOVE OR UPDATE
        if (q === 0) {
            fetch('/api/log-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action_type: 'cart_remove', details: { id: pid, name: p.name, code: p.code } })
            }).catch(e => console.error(e));
        }
    };

    const placeOrder = async () => {
        const selectedItems = cartItems.filter(i => isSelected(i.product.id));
        if (selectedItems.length === 0) return;

        setSubmitting(true);
        try {
            // 1. ANLIK STOK KONTROLÜ
            const stockCheckRes = await fetch('/api/products/stock-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: selectedItems.map(i => ({ id: i.product.id, qty: i.qty }))
                })
            });
            const stockData = await stockCheckRes.json();

            if (!stockData.success) {
                const failMsg = stockData.failures.map(f => `${f.name} (Kalan: ${f.available} adet)`).join('\n');
                alert(`Sepetinizdeki bazı ürünler için yeterli stok kalmamıştır:\n\n${failMsg}`);
                setSubmitting(false);
                return;
            }

            // 2. ÖDEME KONTROLÜ (EĞER STOK VARSA)
            // Admin bypass seçtiyse veya borç limiti/ön ödeme sorunu yoksa devam et
            const shouldRedirectToPayment = totals.needsPrepayment && !(bypassPrepayment || bypassRiskLimit);
            
            if (shouldRedirectToPayment) {
                const paymentAmount = totals.isRiskExceeded ? totals.exceededAmount : totals.finalTotal;
                window.location.href = `/dashboard/payment?amount=${paymentAmount.toFixed(2)}&context=cart`;
                return;
            }

            // 3. SİPARİŞİ OLUŞTUR
            const p_items = selectedItems.map(i => {
                const manual = isShowroom ? Number(manualPrices[i.product.id]) : 0;
                const unitPrice = manual > 0 ? (manual / 1.20) : getDiscountedPrice(i.product);
                return { 
                    product_id: i.product.id, 
                    quantity: i.qty, 
                    unit_price: unitPrice, 
                    total_price: unitPrice * i.qty 
                };
            });
            const response = await fetch('/api/user/checkout', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({
                    companyId,
                    shippingAddress: isDifferentAddress ? shipping : 'Sistem Kayıtlı Firma Adresi',
                    note: `[${shippingMethod}] ${note}`,
                    paymentType: isHavale ? 'havale satış' : 'kart satış',
                    totalAmount: totals.finalTotal,
                    items: p_items,
                    bypassPrepayment: bypassPrepayment,
                    bypassRiskLimit: bypassRiskLimit
                }) 
            });
            
            if (response.ok) {
                const resData = await response.json();
                // LOG ACTIVITY: ORDER PLACED
                fetch('/api/log-activity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action_type: 'order_placed',
                        details: { total: totals.grandTotal, itemCount: selectedItems.length, note }
                    })
                }).catch(e => console.error('Log order error:', e));

                selectedItems.forEach(item => ctxSetQty(item.product.id, item.product, 0));
                setSuccess(true);
            } else {
                const errorData = await response.json();
                alert(`Sipariş oluşturulamadı: ${errorData.error || 'Bilinmeyen bir hata oluştu.'}`);
            }
        } catch (error) { 
            console.error("Order error:", error);
            alert("Sipariş sırasında teknik bir hata oluştu."); 
        } finally { setSubmitting(false); }
    };

    if (loading) return <div className="page-wrapper loading-center"><div className="loading-spinner" /></div>;

    if (success) {
        return (
            <div className="page-wrapper" style={{ textAlign: 'center', paddingTop: 80 }}>
                <CheckCircleIcon style={{ width: 72, height: 72, color: 'var(--success)', margin: '0 auto 20px' }} />
                <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Sipariş Alındı!</h2>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}><a href="/dashboard/orders" className="btn btn-primary">Siparişlerim</a><a href="/dashboard/catalog" className="btn btn-ghost">Devam Et</a></div>
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div><h1 className="page-title">Sepetim & Sipariş Ver</h1><p className="page-subtitle">{cartItems.length} ürün çeşidi</p></div>
                <a href="/dashboard/catalog" className="btn btn-ghost desktop-only">← Kataloğa Dön</a>
            </div>

            <div className="cart-grid-container">
                <div className="cart-left-col">
                    <div className="card" style={{ marginBottom: 20, position: 'relative' }}>
                        <div className="card-title" style={{ marginBottom: 12 }}>Katalogdan Ekle</div>
                        <div className="search-bar" style={{ width: '100%' }}>
                            <span className="search-icon"><MagnifyingGlassIcon style={{ width: 14 }} /></span>
                            <input placeholder="Ürün adı veya kodu..." value={productSearch} onChange={e => {
                                setProductSearch(e.target.value);
                                if (e.target.value.length < 2) { setSearchProducts([]); return; }
                                fetch('/api/products/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filterText: e.target.value }) }).then(r => r.json()).then(data => setSearchProducts((data || []).slice(0, 6)));
                            }} />
                        </div>
                        {searchProducts.length > 0 && (
                            <div className="search-results-overlay" style={{ top: 'calc(100% - 10px)', left: 24, right: 24, width: 'auto' }}>
                                {searchProducts.map(p => (
                                    <div key={p.id} className="search-item" onClick={() => { 
                                        ctxAddToCart(p); 
                                        // LOG ACTIVITY: CART ADD (FROM CART PAGE)
                                        fetch('/api/log-activity', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ company_id: companyId, action_type: 'cart_add', details: { id: p.id, name: p.name, code: p.code, oem_no: p.oem_no, qty: 1, source: 'cart_page' } })
                                        }).catch(e => console.error(e));
                                        
                                        // Close search results
                                        setProductSearch(''); 
                                        setSearchProducts([]); 
                                    }}>
                                        <div><div style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</div>{showCode(p.code) && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.code}</div>}</div>
                                        <div style={{ color: 'var(--primary)', fontWeight: 600 }}>₺{getDiscountedPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {cartItems.length === 0 ? (
                        <div className="card"><div className="empty-state">Sepetiniz boş</div></div>
                    ) : (
                        <div className="cart-items-wrapper">
                            <div className="cart-controls">
                                <button className="btn btn-ghost btn-sm" onClick={() => cartItems.forEach(i => handleSetQty(i.product.id, i.product, i.qty, false))}>☑ Tümünü Seç</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => cartItems.forEach(i => handleSetQty(i.product.id, i.product, i.qty, true))}>☐ Kaldır</button>
                                <span className="selection-count">{totals.selectedCount} / {cartItems.length} seçili</span>
                            </div>

                            {/* FULL DESKTOP TABLE */}
                            <div className="table-wrapper desktop-only">
                                <table>
                                    <thead><tr><th>Ürün</th><th>Marka</th><th style={{ textAlign: 'center' }}>İstanbul</th><th style={{ textAlign: 'center' }}>Depo</th><th style={{ textAlign: 'right' }}>Birim (KDVsiz)</th><th style={{ textAlign: 'right' }}>Birim (KDVli)</th><th style={{ textAlign: 'center' }}>Miktar</th><th style={{ textAlign: 'right' }}>Toplam</th><th style={{ textAlign: 'center' }}>Seç</th><th></th></tr></thead>
                                    <tbody>
                                        {cartItems.map(({ product: p, qty }) => {
                                            const itemSelected = isSelected(p.id);
                                            const extra = extraDiscounts.find(d => d.product_id === p.id);
                                            const manualVal = isShowroom ? manualPrices[p.id] : null;
                                            const unitPriceIncVat = manualVal ? Number(manualVal) : (getDiscountedPrice(p) * 1.20);
                                            const unitPriceExVat = getDiscountedPrice(p);
                                            
                                            return (
                                                <tr key={p.id} style={{ opacity: itemSelected ? 1 : 0.5 }}>
                                                    <td>
                                                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{showCode(p.code)} {extra && !manualVal && <span className="extra-badge-sm">EK İSKONTO %{extra.discount_rate}</span>}</div>
                                                    </td>
                                                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.brand || '-'}</td>
                                                    <td style={{ textAlign: 'center' }}><div style={getCircleStyle(p.stock_merkez, 12)} /></td>
                                                    <td style={{ textAlign: 'center' }}><div style={getCircleStyle(p.stock_depo, 12)} /></td>
                                                    <td style={{ textAlign: 'right', fontSize: 13 }}>₺{unitPriceExVat.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {isShowroom ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                                                <input 
                                                                    type="number" 
                                                                    step="0.01" 
                                                                    placeholder={(getDiscountedPrice(p) * 1.20).toFixed(2)}
                                                                    value={manualPrices[p.id] || ''} 
                                                                    onChange={(e) => setManualPrices(prev => ({...prev, [p.id]: e.target.value}))}
                                                                    style={{ width: 90, textAlign: 'right', padding: '4px 8px', borderRadius: 8, border: '2px solid var(--primary)', fontSize: 13, fontWeight: 700, outline: 'none' }}
                                                                />
                                                                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>KDV DAHİL EDİT</span>
                                                            </div>
                                                        ) : (
                                                            `₺${unitPriceIncVat.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                        )}
                                                    </td>
                                                    <td><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><button className="btn btn-ghost btn-sm" onClick={() => handleSetQty(p.id, p, qty - 1)}>−</button><span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>{qty}</span><button className="btn btn-ghost btn-sm" onClick={() => handleSetQty(p.id, p, qty + 1)}>+</button></div></td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>₺{(unitPriceIncVat * qty).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'center' }}><input type="checkbox" checked={itemSelected} onChange={() => handleSetQty(p.id, p, qty, itemSelected)} style={{ width: 18, height: 18 }} /></td>
                                                    <td style={{ textAlign: 'center' }}><button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleSetQty(p.id, p, 0)}>✕</button></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* CLEAN MOBILE CARDS */}
                            <div className="mobile-only cart-mobile-list">
                                {cartItems.map(({ product: p, qty }) => {
                                    const selected = isSelected(p.id);
                                    const extra = extraDiscounts.find(d => d.product_id === p.id);
                                    const manualVal = isShowroom ? manualPrices[p.id] : null;
                                    const unitPriceIncVat = manualVal ? Number(manualVal) : (getDiscountedPrice(p) * 1.20);
                                    const unitPriceExVat = manualVal ? (Number(manualVal) / 1.20) : getDiscountedPrice(p);

                                    return (
                                        <div key={p.id} className={`cart-card ${selected ? '' : 'unselected'}`}>
                                            <div className="cart-card-top">
                                                <input type="checkbox" checked={selected} onChange={() => handleSetQty(p.id, p, qty, selected)} />
                                                <div className="cart-card-info">
                                                    <div className="cart-card-name">{p.name}</div>
                                                    <div className="cart-card-sub">{showCode(p.code)}{showCode(p.code) && p.brand ? ' | ' : ''}{p.brand || ''}</div>
                                                    <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={getCircleStyle(p.stock_merkez, 10)} /> İstanbul</span>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={getCircleStyle(p.stock_depo, 10)} /> Depo</span>
                                                    </div>
                                                    {extra && !manualVal && <div style={{ marginTop: 6 }}><span className="extra-badge-sm" style={{ marginLeft: 0 }}>EK İSKONTO %{extra.discount_rate}</span></div>}
                                                </div>
                                                <button className="cart-card-delete" onClick={() => handleSetQty(p.id, p, 0)}><XMarkIcon style={{ width: 20 }} /></button>
                                            </div>
                                            <div className="cart-card-bottom">
                                                <div className="cart-qty-picker">
                                                    <button onClick={() => handleSetQty(p.id, p, qty - 1)}><MinusIcon style={{ width: 16 }} /></button>
                                                    <span>{qty}</span>
                                                    <button onClick={() => handleSetQty(p.id, p, qty + 1)}><PlusIcon style={{ width: 16 }} /></button>
                                                </div>
                                                <div className="cart-card-price">
                                                    <div className="unit" style={{ fontSize: 10, color: 'var(--text-muted)' }}>KDVsiz: ₺{getDiscountedPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                    {isShowroom ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, marginTop: 4, marginBottom: 4 }}>
                                                            <input 
                                                                type="number" 
                                                                step="0.01" 
                                                                placeholder={(getDiscountedPrice(p) * 1.20).toFixed(2)}
                                                                value={manualPrices[p.id] || ''} 
                                                                onChange={(e) => setManualPrices(prev => ({...prev, [p.id]: e.target.value}))}
                                                                style={{ width: 85, textAlign: 'right', padding: '4px 6px', borderRadius: 8, border: '2px solid var(--primary)', fontSize: 12, fontWeight: 700, outline: 'none' }}
                                                            />
                                                            <div className="unit" style={{ fontSize: 8, fontWeight: 600 }}>KDV DAHİL EDİT</div>
                                                        </div>
                                                    ) : (
                                                        <div className="unit">KDVli: ₺{(getDiscountedPrice(p) * 1.20).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                    )}
                                                    <div className="total">₺{(unitPriceIncVat * qty).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="cart-summary-wrapper">
                    <div className="card summary-card">
                        <div className="summary-grid">
                            <div className="summary-details">
                                <div className="card-title" style={{ marginBottom: 16 }}>Sipariş Özeti</div>
                                <div className="summary-row"><span>Ara Toplam</span><span>₺{totals.subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="summary-row discount"><span>Toplam İskonto</span><span>-₺{totals.totalDiscount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="summary-row"><span>KDV (%20)</span><span>₺{totals.vat.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                {isHavale && totals.havaleDiscountAmount > 0 && (
                                    <div className="summary-row discount"><span>Havale İskontosu (%3)</span><span>-₺{totals.havaleDiscountAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                )}
                                {totals.hasShippingSettings && (
                                    <div className="summary-row" style={{ alignItems: 'center' }}>
                                        <span>Kargo Ücreti</span>
                                        <span>
                                            {totals.isShippingFree ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                                                    <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: 12 }}>
                                                        ₺{shippingCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                    <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 11, background: '#dcfce7', padding: '2px 8px', borderRadius: 6 }}>ÜCRETSİZ</span>
                                                </span>
                                            ) : (
                                                `₺${totals.shippingFee.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                            )}
                                        </span>
                                    </div>
                                )}
                                <hr className="divider" />
                                <div className="summary-row grand">
                                    <span>Toplam</span>
                                    {totals.isShippingFree && shippingCost > 0 ? (
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                                ₺{(totals.grandTotal + shippingCost).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a' }}>
                                                ₺{totals.finalTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    ) : (
                                        <span>₺{totals.finalTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    )}
                                </div>
                                {/* Havale promosyon banner + checkbox */}
                                <div style={{ marginTop: 20, padding: '14px 16px', background: 'linear-gradient(135deg, #fefce8, #fef9c3)', borderRadius: 14, border: '1px solid #fde047' }}>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: '#854d0e', marginBottom: 12, lineHeight: 1.4 }}>
                                        💳 Havale ile ödeme yaparsanız<br />
                                        <span style={{ fontSize: 18, color: '#16a34a' }}>%3 iskonto kazanırsınız!</span>
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                                        <input
                                            type="checkbox"
                                            checked={isHavale}
                                            onChange={e => setIsHavale(e.target.checked)}
                                            style={{ width: 20, height: 20, accentColor: '#16a34a', cursor: 'pointer', flexShrink: 0 }}
                                        />
                                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Havale ile ödeme yapacağım</span>
                                    </label>
                                </div>
                            </div>

                            <div className="summary-actions-form">
                                {isShowroom && (
                                    <div style={{ marginBottom: 15, padding: 12, background: 'rgba(37, 99, 235, 0.05)', borderRadius: 10, border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 8, textTransform: 'uppercase' }}>Admin Bypass Yetkileri</div>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', marginBottom: 6, color: 'var(--text-primary)' }}>
                                            <input type="checkbox" checked={bypassPrepayment} onChange={e => setBypassPrepayment(e.target.checked)} style={{ width: 16, height: 16 }} />
                                            Ön Ödeme Denetimini Atla
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
                                            <input type="checkbox" checked={bypassRiskLimit} onChange={e => setBypassRiskLimit(e.target.checked)} style={{ width: 16, height: 16 }} />
                                            Risk Limiti Denetimini Atla
                                        </label>
                                    </div>
                                )}
                                <div className="form-group"><label className="form-label">Gönderim Metodu</label><select className="form-input" value={shippingMethod} onChange={e => setShippingMethod(e.target.value)}><option value="Kargo">Kargo</option><option value="Kurye">Kurye</option><option value="Elden">Elden</option></select></div>
                                <div className="form-group"><textarea className="form-textarea" placeholder="Sipariş notu ekleyin..." value={note} onChange={e => setNote(e.target.value)} style={{ height: 80 }} /></div>
                                <button className="btn btn-primary btn-lg checkout-btn" disabled={totals.selectedCount === 0 || submitting} onClick={placeOrder} style={{ backgroundColor: (totals.needsPrepayment && !(bypassPrepayment || bypassRiskLimit)) ? 'var(--danger)' : undefined }}>
                                    {submitting ? '...' : (totals.needsPrepayment && !(bypassPrepayment || bypassRiskLimit)) ? `ÖDEME YAP ₺${totals.finalTotal.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}` : `${totals.selectedCount} Ürünü Sipariş Et`}
                                </button>

                                {/* Kargo İlerleme Çubuğu */}
                                {totals.hasShippingSettings && (
                                    <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                            {totals.isShippingFree ? (
                                                <span style={{ color: '#16a34a', fontWeight: 800, fontSize: 18 }}>🎉 Kargo Ücretsiz!</span>
                                            ) : (
                                                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                    Ücretsiz kargoya <strong style={{ color: 'var(--primary)', fontSize: 17 }}>₺{totals.remainingForFreeShipping.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</strong> kaldı
                                                </span>
                                            )}
                                            <span style={{ color: '#dc2626', fontSize: 15, fontWeight: 800 }}>
                                                ₺{freeShippingThreshold.toLocaleString('tr-TR')} üzeri
                                            </span>
                                        </div>
                                        <div style={{ height: 80, background: 'var(--bg-card)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${totals.shippingProgress}%`,
                                                background: totals.isShippingFree
                                                    ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                                                    : 'linear-gradient(90deg, var(--primary), #60a5fa)',
                                                borderRadius: 16,
                                                transition: 'width 0.5s ease, background 0.3s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'flex-end',
                                                paddingRight: totals.shippingProgress > 15 ? 14 : 0
                                            }}>
                                                {totals.shippingProgress > 15 && (
                                                    <span style={{ fontSize: 16, fontWeight: 800, color: 'white', whiteSpace: 'nowrap' }}>
                                                        %{Math.round(totals.shippingProgress)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .stock-warning { background: linear-gradient(90deg, rgba(185,28,28,0.1), rgba(220,38,38,0.1)); border: 1px solid rgba(220,38,38,0.2); color: #b91c1c; padding: 12px; border-radius: 12px; text-align: center; font-weight: 800; font-size: 14px; margin-bottom: 20px; }
                .cart-grid-container { display: flex; flex-direction: column; gap: 24px; }
                .cart-summary-wrapper { margin-top: 10px; }
                .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
                .cart-controls { display: flex; gap: 10px; margin-bottom: 12px; align-items: center; }
                .selection-count { marginLeft: auto; fontSize: 13px; color: var(--text-muted); }
                .extra-badge-sm { background: #dcfce7; color: #16a34a; padding: 1px 6px; borderRadius: 4px; fontSize: 10px; fontWeight: 700; margin-left: 8px; }
                .summary-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
                .summary-row.discount { color: var(--danger); font-weight: 600; }
                .summary-row.grand { font-size: 28px; font-weight: 800; color: var(--primary); margin-top: 12px; }
                .checkout-btn { width: 100%; justify-content: center; height: 54px; margin-top: 16px; font-weight: 700; font-size: 18px; }
                .search-results-overlay { position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; z-index: 100; margin-top: 4px; box-shadow: var(--shadow-xl); }
                .search-item { padding: 12px 16px; display: flex; justify-content: space-between; cursor: pointer; border-bottom: 1px solid var(--border-light); }
                .search-item:hover { background: var(--bg-surface); }

                .mobile-only { display: none; }
                @media (max-width: 768px) {
                    .summary-grid { grid-template-columns: 1fr; gap: 20px; }
                    .desktop-only { display: none !important; }
                    .mobile-only { display: block !important; }
                    .cart-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 16px; margin-bottom: 12px; box-shadow: var(--shadow-sm); }
                    .cart-card.unselected { opacity: 0.6; }
                    .cart-card-top { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px; }
                    .cart-card-info { flex: 1; }
                    .cart-card-name { font-weight: 700; font-size: 14px; line-height: 1.3; margin-bottom: 4px; }
                    .cart-card-sub { font-size: 12px; color: var(--text-muted); }
                    .cart-card-delete { color: var(--danger); background: none; border: none; padding: 4px; }
                    .cart-card-bottom { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid var(--border-light); padding-top: 12px; }
                    .cart-qty-picker { display: flex; align-items: center; background: var(--bg-surface); border-radius: 10px; border: 1px solid var(--border); }
                    .cart-qty-picker button { padding: 8px 12px; border: none; background: none; color: var(--primary); }
                    .cart-qty-picker span { min-width: 30px; text-align: center; font-weight: 700; }
                    .cart-card-price { text-align: right; }
                    .cart-card-price .unit { font-size: 11px; color: var(--text-muted); }
                    .cart-card-price .total { font-size: 16px; font-weight: 800; color: var(--primary); }
                }
            `}</style>
        </div>
    );
}

