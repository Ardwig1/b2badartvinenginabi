'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { CreditCardIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useCart } from '@/components/CartProvider';

export default function PaymentPage() {
    const { cartItems: contextCartItems } = useCart();
    
    // Convert cartItems object to array
    const cartItemsArr = useMemo(() => {
        return Object.values(contextCartItems || {}).filter(item => item && item.qty > 0);
    }, [contextCartItems]);

    const isSelected = (id) => !(contextCartItems[id]?.unselected);

    const [amount, setAmount] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expireMonth, setExpireMonth] = useState('');
    const [expireYear, setExpireYear] = useState('');
    const [cvv, setCvv] = useState('');

    const [isCartLoading, setIsCartLoading] = useState(true);
    const [isCartChecked, setIsCartChecked] = useState(false);
    const [isDebtChecked, setIsDebtChecked] = useState(false);

    const [loading, setLoading] = useState(false);
    const [isInfoLoading, setIsInfoLoading] = useState(true);
    const [toslaData, setToslaData] = useState(null);
    const [buyerInfo, setBuyerInfo] = useState({ email: '', phone: '', companyId: '', companyName: '', currentBalance: 0, discountPercent: 0, extraDiscounts: [] });
    const [context, setContext] = useState('');
    const [globalSettings, setGlobalSettings] = useState({ margin: 36, usdRate: 0, usdActive: false, rates: { USD: 1, EUR: 1 } });

    const fetchData = useCallback(async () => {
        setIsInfoLoading(true);
        try {
            const infoRes = await fetch(`/api/user/info?t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
            if (infoRes.ok) {
                const data = await infoRes.json();
                setBuyerInfo({
                    email: data.email || '',
                    phone: data.phone || '',
                    companyId: data.companyId || '',
                    companyName: data.companyName || '',
                    currentBalance: Number(data.currentBalance) || 0,
                    discountPercent: Number(data.discountPercent) || 0,
                    extraDiscounts: data.extraDiscounts || []
                });
            }

            const [marginRes, usdRes, ratesRes] = await Promise.all([
                fetch('/api/admin/margin'),
                fetch('/api/admin/usd-settings'),
                fetch('/api/rates')
            ]);
            
            const m = await marginRes.json();
            const u = await usdRes.json();
            const r = await ratesRes.json();

            setGlobalSettings({
                margin: m?.margin ?? 36,
                usdRate: u?.usd_rate ?? 0,
                usdActive: u?.is_active ?? false,
                rates: r ?? { USD: 1, EUR: 1 }
            });
        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setIsInfoLoading(false);
            setIsCartLoading(false);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const amt = params.get('amount');
            const ctx = params.get('context');
            if (amt && amt !== '0.00' && amt !== '0') setAmount(amt);
            if (ctx) setContext(ctx);
        }
        fetchData();
    }, [fetchData]);

    // EXACT PRICING LOGIC FROM UPDATED CART PAGE
    const getBaseTryPrice = useCallback((p) => {
        if (!p) return 0;
        let initialPrice = Number(p.list_price) || 0;
        let marginBase = (Number(p.profit_margin) || 36) / 100;
        let rawCost = initialPrice / (1 + marginBase);
        let price = rawCost * (1 + (globalSettings.margin / 100));

        if (globalSettings.usdActive && globalSettings.usdRate > 0 && p.currency === 'USD') {
            price = price * globalSettings.usdRate;
        } else {
            if (p.currency === 'USD') price = price * (globalSettings.rates.USD || 1);
            else if (p.currency === 'EUR') price = price * (globalSettings.rates.EUR || 1);
        }
        return price;
    }, [globalSettings]);

    const getDiscountedPrice = useCallback((p) => {
        if (!p) return 0;
        const base = getBaseTryPrice(p);
        const prodDiscount = Number(p.discount_rate || 0);
        const groupDiscount = buyerInfo.discountPercent || 0;
        return base * (1 - prodDiscount / 100) * (1 - groupDiscount / 100);
    }, [getBaseTryPrice, buyerInfo.discountPercent]);

    const cartTotal = useMemo(() => {
        const selected = cartItemsArr.filter(i => isSelected(i.product.id));
        let afterDisc = 0;

        selected.forEach(item => {
            const p = item.product;
            const qty = item.qty;
            const normalPrice = getDiscountedPrice(p);
            const extra = buyerInfo.extraDiscounts.find(d => d.product_id === p.id);
            
            if (extra) {
                // APPLY EXTRA DISCOUNT TO ALL QUANTITY (Matching new Cart Logic)
                const extraDiscPrice = normalPrice * (1 - Number(extra.discount_rate) / 100);
                afterDisc += (extraDiscPrice * qty);
            } else {
                afterDisc += normalPrice * qty;
            }
        });

        return afterDisc * 1.20; // 20% VAT
    }, [cartItemsArr, contextCartItems, buyerInfo, globalSettings, getDiscountedPrice]);

    // Sync amount with cartTotal when checked
    useEffect(() => {
        if (isCartChecked && cartTotal > 0 && !isInfoLoading && (context === 'cart' || !amount)) {
            setAmount(cartTotal.toFixed(2));
        }
    }, [cartTotal, isCartChecked, isInfoLoading, context, amount]);

    const handleAmountChange = (val) => {
        setAmount(val.replace(',', '.').replace(/[^0-9.]/g, ''));
        setIsCartChecked(false);
        setIsDebtChecked(false);
    };

    const handlePayment = async (e) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) { alert('Geçerli bir tutar girin.'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/payment/tosla/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: numericAmount.toFixed(2),
                    cardHolderName: buyerInfo.companyName,
                    cardNumber: cardNumber.replace(/\s/g, ''),
                    expireMonth, expireYear, cvv,
                    buyerEmail: buyerInfo.email,
                    buyerPhone: buyerInfo.phone,
                    companyId: buyerInfo.companyId,
                    companyName: buyerInfo.companyName,
                    context: context
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setToslaData({ ...data, cardNumber: cardNumber.replace(/\s/g, ''), expireDate: `${expireMonth}/${expireYear}` });
            } else alert('Hata: ' + (data.error || 'Bilinmeyen hata'));
        } catch (error) { alert('Hata oluştu.'); } finally { setLoading(false); }
    };

    if (toslaData) {
        return (
            <div className="page-wrapper"><div style={{ padding: 40, textAlign: 'center' }}><h2>Yönlendiriliyorsunuz...</h2>
                <form id="tosla3dForm" method="POST" action={toslaData.processUrl} style={{ display: 'none' }}>
                    <input type="hidden" name="ThreeDSessionId" value={toslaData.threeDSessionId} /><input type="hidden" name="CardHolderName" value={buyerInfo.companyName} /><input type="hidden" name="CardNo" value={toslaData.cardNumber} /><input type="hidden" name="ExpireDate" value={toslaData.expireDate} /><input type="hidden" name="Cvv" value={cvv} /><input type="hidden" name="CustomerEmail" value={buyerInfo.email} /><input type="hidden" name="CustomerPhone" value={buyerInfo.phone} /><input type="hidden" name="CustomerName" value={buyerInfo.companyName} />
                </form>
                <script dangerouslySetInnerHTML={{ __html: 'document.getElementById("tosla3dForm").submit();' }} />
            </div></div>
        );
    }

    return (
        <div className="page-wrapper">
            <div className="page-header"><div><h1 className="page-title">Online Ödeme (Sanal POS)</h1><p className="page-subtitle">Kredi kartınızla anında bakiye yükleyin veya fatura ödeyin</p></div></div>

            <div className="payment-layout" style={{ display: 'flex', gap: 24, maxWidth: 900, margin: '0 auto', alignItems: 'stretch' }}>
                <div className="payment-main" style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="tosla-banner" style={{ padding: '20px 24px', background: 'linear-gradient(90deg, rgba(227, 24, 55, 0.1) 0%, rgba(227, 24, 55, 0.02) 100%)', border: '1px solid rgba(227, 24, 55, 0.2)', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-primary)' }}>
                        <div style={{ background: '#e31837', color: 'white', padding: '4px 10px', borderRadius: '6px', fontWeight: 900, fontSize: '14px' }}>AKBANK</div>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}><strong style={{ color: '#e31837' }}>TOSLA</strong> altyapısı ile güvenli ödeme.</div>
                        <div style={{ marginLeft: 'auto', background: '#10b981', color: 'white', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }}>GÜVENLİ</div>
                    </div>

                    <div className="card payment-form-card" style={{ padding: 30 }}>
                        <h2 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>Ödeme Bilgileri</h2>
                        <form onSubmit={handlePayment}>
                            <div className="form-group"><label className="form-label">Ödenecek Tutar (₺)</label><input type="text" inputMode="decimal" className="form-input" style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--primary)', background: 'var(--bg-input)' }} value={amount} onChange={e => handleAmountChange(e.target.value)} required /></div>
                            <div className="form-group"><label className="form-label">Referans Firma</label><input type="text" className="form-input" value={buyerInfo.companyName || 'Yükleniyor...'} disabled style={{ background: 'var(--bg-surface)' }} /></div>
                            <div className="form-group"><label className="form-label">Kredi Kartı Numarası</label><input type="text" className="form-input" value={cardNumber} onChange={e => { let val = e.target.value.replace(/\D/g, ''); let parts = val.match(/.{1,4}/g); setCardNumber(parts ? parts.join(' ') : val); }} placeholder="0000 0000 0000 0000" maxLength="19" required style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }} /></div>
                            <div style={{ display: 'flex', gap: 15, marginBottom: 20 }}>
                                <div style={{ flex: 1 }}><label className="form-label">Ay</label><input className="form-input" value={expireMonth} onChange={e => setExpireMonth(e.target.value.replace(/\D/g, ''))} placeholder="AA" maxLength="2" required autoComplete="off" style={{ background: '#0f172a !important', backgroundColor: '#0f172a !important', color: 'var(--text-primary)', border: '1px solid var(--border)' }} /></div>
                                <div style={{ flex: 1 }}><label className="form-label">Yıl</label><input className="form-input" value={expireYear} onChange={e => setExpireYear(e.target.value.replace(/\D/g, ''))} placeholder="YY" maxLength="2" required autoComplete="off" style={{ background: '#0f172a !important', backgroundColor: '#0f172a !important', color: 'var(--text-primary)', border: '1px solid var(--border)' }} /></div>
                                <div style={{ flex: 1 }}><label className="form-label">CVV</label><input type="password" className="form-input" value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, ''))} placeholder="***" maxLength="4" required autoComplete="new-password" style={{ background: '#0f172a !important', backgroundColor: '#0f172a !important', color: 'var(--text-primary)', border: '1px solid var(--border)' }} /></div>
                            </div>
                            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} disabled={loading || !amount || amount === '0.00'}>{loading ? 'İşleniyor...' : 'Güvenli Ödeme Yap'}</button>
                        </form>
                    </div>
                </div>

                <div className="payment-side" style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {(cartTotal > 0 || isCartLoading) && (
                        <div className="card" style={{ padding: 24, border: isCartChecked ? '2px solid var(--primary)' : '1px solid var(--border)', cursor: 'pointer' }} onClick={() => { setIsCartChecked(true); setIsDebtChecked(false); setAmount(cartTotal.toFixed(2)); }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Sepet Ödemesi</h3>
                            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)', marginBottom: 12 }}>
                                {isCartLoading ? '...' : `₺${cartTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </div>
                            <label style={{ display: 'flex', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={isCartChecked} readOnly /> Bu tutarı öde</label>
                        </div>
                    )}
                    {buyerInfo.currentBalance < 0 && (
                        <div className="card" style={{ padding: 24, border: isDebtChecked ? '2px solid var(--danger)' : '1px solid var(--border)', cursor: 'pointer' }} onClick={() => { setIsDebtChecked(true); setIsCartChecked(false); setAmount(Math.abs(buyerInfo.currentBalance).toFixed(2)); }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Cari Borç</h3>
                            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--danger)', marginBottom: 12 }}>₺{Math.abs(buyerInfo.currentBalance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                            <label style={{ display: 'flex', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={isDebtChecked} readOnly /> Borcumu öde</label>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                @media (max-width: 768px) {
                    .payment-layout { flex-direction: column !important; }
                    .payment-main { display: contents; }
                    .tosla-banner { order: 1 !important; padding: 16px !important; gap: 12px !important; }
                    .payment-side { order: 2 !important; flex: none !important; width: 100% !important; gap: 16px !important; }
                    .payment-form-card { order: 3 !important; padding: 20px !important; }
                }
            `}</style>
        </div>
    );
}
