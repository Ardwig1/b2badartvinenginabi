'use client';
import { useState, useEffect } from 'react';
import { CreditCardIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/components/CartProvider';
import { calculateCartTotals } from '@/lib/pricing';

export default function PaymentPage() {
    const [amount, setAmount] = useState('');
    const [cardHolderName, setCardHolderName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expireMonth, setExpireMonth] = useState('');
    const [expireYear, setExpireYear] = useState('');
    const [cvv, setCvv] = useState('');

    const [cartTotal, setCartTotal] = useState(null);
    const [isCartLoading, setIsCartLoading] = useState(false);
    const [isCartChecked, setIsCartChecked] = useState(true);
    const [isDebtChecked, setIsDebtChecked] = useState(false);

    const [loading, setLoading] = useState(false);
    const [isInfoLoading, setIsInfoLoading] = useState(true);
    const [infoError, setInfoError] = useState(null);
    const [toslaData, setToslaData] = useState(null);
    const [buyerInfo, setBuyerInfo] = useState({ email: '', phone: '', companyId: '', companyName: '', currentBalance: 0 });
    const [context, setContext] = useState('');

    const { cartItems } = useCart();
    const [pricingSettings, setPricingSettings] = useState({
        margin: 36,
        usdRate: 0,
        isUsdActive: false,
        rates: { USD: 1, EUR: 1 },
        discountPercent: 0
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const amt = params.get('amount');
            const ctx = params.get('context');
            if (amt) setAmount(amt);
            if (ctx) setContext(ctx);

            const cTot = sessionStorage.getItem('pendingCartTotal');
            if (cTot) {
                setCartTotal(cTot);
                setAmount(parseFloat(cTot).toFixed(2));
            }
        }

        const fetchUser = async () => {
            let backupName = '';
            if (typeof window !== 'undefined') {
                backupName = localStorage.getItem('storedCompanyName') || '';
                if (backupName) {
                    setBuyerInfo(prev => ({ ...prev, companyName: backupName }));
                    setIsInfoLoading(false);
                } else {
                    setIsInfoLoading(true);
                }
            }

            setInfoError(null);
            try {
                const res = await fetch('/api/user/info', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    setBuyerInfo({
                        email: data.email || '',
                        phone: data.phone || '',
                        companyId: data.companyId || '',
                        companyName: data.companyName || backupName || '',
                        currentBalance: Number(data.currentBalance) || 0
                    });
                    if (data.companyName && typeof window !== 'undefined') {
                        localStorage.setItem('storedCompanyName', data.companyName);
                    }
                } else {
                    const errData = await res.json().catch(() => ({}));
                    if (!backupName) {
                        setInfoError(errData.error || 'Bilgiler alınamadı.');
                    }
                }
            } catch (err) {
                console.error('Error fetching user info:', err);
                if (!backupName) {
                    setInfoError('Bağlantı hatası: Lütfen internetinizi kontrol edin.');
                }
            } finally {
                setIsInfoLoading(false);
            }
        };

        const fetchSettings = async () => {
            try {
                const [marginRes, usdRes, ratesRes] = await Promise.all([
                    fetch('/api/admin/margin'),
                    fetch('/api/admin/usd-settings'),
                    fetch('/api/rates')
                ]);
                const marginData = await marginRes.json();
                const usdData = await usdRes.json();
                const ratesData = await ratesRes.json();

                setPricingSettings(prev => ({
                    ...prev,
                    margin: marginData?.margin ?? prev.margin,
                    usdRate: usdData?.usd_rate ?? prev.usdRate,
                    isUsdActive: usdData?.is_active ?? prev.isUsdActive,
                    rates: ratesData ?? prev.rates
                }));
            } catch (e) {
                console.error('Settings fetch error:', e);
            }
        };

        fetchUser();
        fetchSettings();
        window._retryFetchUser = fetchUser;
    }, []);

    // Recalculate cart total whenever items or settings change
    useEffect(() => {
        const hasItems = Object.values(cartItems).some(i => i.qty > 0);
        if (hasItems) {
            setIsCartLoading(true);
            const fetchDiscount = async () => {
                try {
                    const res = await fetch('/api/user/info');
                    if (res.ok) {
                        const data = await res.json();
                        const disc = data.discountPercent || 0;
                        
                        const totals = calculateCartTotals(
                            cartItems, 
                            disc, 
                            pricingSettings.margin, 
                            pricingSettings.isUsdActive, 
                            pricingSettings.usdRate, 
                            pricingSettings.rates
                        );
                        
                        setCartTotal(totals.grandTotal);
                        if (!amount || amount === '0.00' || context === 'cart') {
                            if (isCartChecked) {
                                setAmount(totals.grandTotal.toFixed(2));
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error calculating cart totals:', e);
                } finally {
                    setIsCartLoading(false);
                }
            };
            fetchDiscount();
        } else {
            setCartTotal(null);
            setIsCartLoading(false);
            if (isCartChecked && !context) setAmount('');
        }
    }, [cartItems, pricingSettings, isCartChecked, context]);

    useEffect(() => {
        if (toslaData) {
            document.getElementById("tosla3dForm")?.submit();
        }
    }, [toslaData]);

    const handleCartCheck = (e) => {
        const checked = e.target.checked;
        setIsCartChecked(checked);
        if (checked) {
            setIsDebtChecked(false);
            if (cartTotal) {
                setAmount(parseFloat(cartTotal).toFixed(2));
            }
        } else {
            setAmount('');
        }
    };

    const handleDebtCheck = (e) => {
        const checked = e.target.checked;
        setIsDebtChecked(checked);
        if (checked) {
            setIsCartChecked(false);
            if (buyerInfo?.currentBalance < 0) {
                setAmount(Math.abs(buyerInfo.currentBalance).toFixed(2));
            }
        } else {
            setAmount('');
        }
    };

    const handleAmountChange = (val) => {
        let normalized = val.replace(',', '.');
        normalized = normalized.replace(/[^0-9.]/g, '');
        const dots = normalized.split('.');
        if (dots.length > 2) {
            normalized = dots[0] + '.' + dots.slice(1).join('');
        }
        setAmount(normalized);
        setIsCartChecked(false);
        setIsDebtChecked(false);
    };

    const handlePayment = async (e) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount.replace(',', '.'));
        if (isNaN(numericAmount) || numericAmount <= 0) {
            alert('Lütfen geçerli bir tutar giriniz.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/payment/tosla/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: numericAmount.toFixed(2),
                    cardHolderName: buyerInfo.companyName || 'MUSTERI',
                    cardNumber: cardNumber.replace(/\s/g, ''),
                    expireMonth,
                    expireYear,
                    cvv,
                    buyerEmail: buyerInfo.email,
                    buyerPhone: buyerInfo.phone,
                    companyId: buyerInfo.companyId,
                    companyName: buyerInfo.companyName,
                    context: context
                })
            });
            const data = await res.json();

            if (res.ok && data.success && data.threeDSessionId) {
                setToslaData({
                    threeDSessionId: data.threeDSessionId,
                    cardHolderName,
                    cardNumber: cardNumber.replace(/\s/g, ''),
                    expireDate: `${String(expireMonth).padStart(2, '0')}/${String(expireYear).slice(-2)}`,
                    cvv,
                    buyerEmail: buyerInfo.email,
                    buyerPhone: buyerInfo.phone,
                    companyName: data.companyName || buyerInfo.companyName || '',
                    processUrl: data.processUrl || 'https://entegrasyon.tosla.com/api/Payment/ProcessCardForm'
                });
            } else {
                alert('Ödeme oturumu başlatılamadı: ' + (data.error || 'Bilinmeyen hata'));
            }
        } catch (error) {
            console.error('Payment Error:', error);
            alert('Ödeme işlemi sırasında bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    if (toslaData) {
        let formattedName = `${toslaData.companyName || ''}`.trim();
        let safeName = formattedName
            .replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/Ş/g, 'S').replace(/ş/g, 's')
            .replace(/Ğ/g, 'G').replace(/ğ/g, 'g').replace(/Ü/g, 'U').replace(/ü/g, 'u')
            .replace(/Ö/g, 'O').replace(/ö/g, 'o').replace(/Ç/g, 'C').replace(/ç/g, 'c')
            .replace(/[^a-zA-Z0-9\s]/g, '').trim().toUpperCase();
        if (!safeName) safeName = 'MUSTERI';

        return (
            <div className="page-wrapper">
                <div style={{ padding: 40, textAlign: 'center' }}>
                    <h2>Güvenli Ödeme Sayfasına Yönlendiriliyorsunuz...</h2>
                    <p>Lütfen bekleyin.</p>
                    <form id="tosla3dForm" method="POST" action={toslaData.processUrl} encType="multipart/form-data" style={{ display: 'none' }}>
                        <input type="hidden" name="ThreeDSessionId" value={toslaData.threeDSessionId} />
                        <input type="hidden" name="CardHolderName" value={safeName} />
                        <input type="hidden" name="CardNo" value={toslaData.cardNumber} />
                        <input type="hidden" name="ExpireDate" value={toslaData.expireDate} />
                        <input type="hidden" name="Cvv" value={toslaData.cvv} />
                        <input type="hidden" name="CustomerEmail" value={toslaData.buyerEmail} />
                        <input type="hidden" name="CustomerPhone" value={toslaData.buyerPhone} />
                        <input type="hidden" name="CustomerName" value={safeName} />
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Online Ödeme (Sanal POS)</h1>
                    <p className="page-subtitle">Kredi kartınızla anında bakiye yükleyin veya fatura ödeyin</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 24, maxWidth: 900, margin: '0 auto', alignItems: 'stretch', flexWrap: 'wrap' }}>
                <div className="card" style={{ flex: '1 1 500px', padding: 30 }}>
                    <h2 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>Ödeme Bilgileri</h2>
                    <form onSubmit={handlePayment}>
                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label">{context === 'cart' ? 'Sepet Tutarı (Değiştirilemez)' : 'Ödenecek Tutar (₺)'}</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="form-input"
                                style={{ fontSize: 24, padding: '12px 16px', fontWeight: 'bold', color: 'var(--primary)' }}
                                value={amount}
                                onChange={e => handleAmountChange(e.target.value)}
                                placeholder="0.00"
                                disabled={context === 'cart' || Boolean(cartTotal && isCartChecked) || isDebtChecked}
                                required
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 15 }}>
                            <label className="form-label">İşlem Yapan Firma</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={infoError ? 'Hata oluştu!' : (buyerInfo.companyName || (isInfoLoading ? 'Yükleniyor...' : 'FİRMA BİLGİSİ EKSİK!'))}
                                    disabled
                                    style={{
                                        backgroundColor: infoError || (!isInfoLoading && !buyerInfo.companyName) ? '#fff1f2' : '#f8f9fa',
                                        cursor: 'not-allowed',
                                        color: infoError || (!isInfoLoading && !buyerInfo.companyName) ? '#dc2626' : (isInfoLoading ? '#6c757d' : '#1e293b'),
                                        fontWeight: 'bold'
                                    }}
                                />
                                {isInfoLoading && (
                                    <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                                        <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 15 }}>
                            <label className="form-label">Kredi Kartı Numarası</label>
                            <input type="text" className="form-input" value={cardNumber} onChange={e => {
                                let val = e.target.value.replace(/\D/g, '');
                                let parts = val.match(/.{1,4}/g);
                                setCardNumber(parts ? parts.join(' ') : val);
                            }} placeholder="0000 0000 0000 0000" maxLength="19" required />
                        </div>

                        <div style={{ display: 'flex', gap: 15, marginBottom: 20 }}>
                            <div className="form-group" style={{ flex: 1 }}><label className="form-label">Ay</label><input type="text" className="form-input" value={expireMonth} onChange={e => setExpireMonth(e.target.value.replace(/\D/g, ''))} placeholder="AA" maxLength="2" required /></div>
                            <div className="form-group" style={{ flex: 1 }}><label className="form-label">Yıl</label><input type="text" className="form-input" value={expireYear} onChange={e => setExpireYear(e.target.value.replace(/\D/g, ''))} placeholder="YY" maxLength="2" required /></div>
                            <div className="form-group" style={{ flex: 1 }}><label className="form-label">CVV</label><input type="password" placeholder="***" className="form-input" value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, ''))} maxLength="4" required /></div>
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', gap: 10 }} disabled={loading || isInfoLoading || infoError || !buyerInfo.companyName}>
                            {loading ? <><div className="loading-spinner" style={{ width: 18, height: 18, borderTopColor: 'white' }} /> İşleniyor...</> : <><CreditCardIcon style={{ width: 20, height: 20 }} /> Güvenli Ödeme Yap (Tosla)</>}
                        </button>
                    </form>
                </div>

                <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {(cartTotal !== null || isCartLoading) && (
                        <div className="card" style={{ 
                            padding: 24, 
                            border: isCartChecked ? '2px solid var(--primary)' : '1px solid var(--border)', 
                            opacity: (isDebtChecked || isCartLoading) ? 0.6 : 1,
                            cursor: isCartLoading ? 'wait' : 'pointer'
                        }} onClick={() => !isCartChecked && !isCartLoading && handleCartCheck({ target: { checked: true } })}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: isCartChecked ? 'var(--primary)' : 'inherit' }}>Sepet Ödemesi</h3>
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16, minHeight: 64, display: 'flex', alignItems: 'center' }}>
                                {isCartLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Hesaplanıyor...</span>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Ödenecek Tutar:</div>
                                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>₺{parseFloat(cartTotal || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                )}
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: isCartLoading ? 'wait' : 'pointer' }}>
                                <input type="checkbox" checked={isCartChecked} onChange={handleCartCheck} disabled={isCartLoading} style={{ width: 20, height: 20 }} />
                                <span style={{ fontWeight: 600, fontSize: 14 }}>Bu tutarı öde</span>
                            </label>
                        </div>
                    )}

                    {!isInfoLoading && buyerInfo.currentBalance < 0 && (
                        <div className="card" style={{ 
                            padding: 24, 
                            border: isDebtChecked ? '2px solid var(--danger)' : '1px solid var(--border)', 
                            opacity: isCartChecked ? 0.6 : 1,
                            cursor: 'pointer'
                        }} onClick={() => !isDebtChecked && handleDebtCheck({ target: { checked: true } })}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: isDebtChecked ? 'var(--danger)' : 'inherit' }}>Cari Borç Ödemesi</h3>
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Güncel Cari Borcunuz:</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--danger)' }}>₺{Math.abs(buyerInfo.currentBalance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                <input type="checkbox" checked={isDebtChecked} onChange={handleDebtCheck} style={{ width: 20, height: 20 }} />
                                <span style={{ fontWeight: 600, fontSize: 14 }}>Tüm borcumu öde</span>
                            </label>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
