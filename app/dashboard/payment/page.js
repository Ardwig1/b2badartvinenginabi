'use client';
import { useState, useEffect } from 'react';
import { CreditCardIcon, ArrowLeftIcon, RefreshIcon } from '@heroicons/react/24/outline'; // Note: Heroicons 2.0 might use ArrowPathIcon for Refresh
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
            // Priority 1: Check localStorage for instant display (from Sidebar)
            let backupName = '';
            if (typeof window !== 'undefined') {
                backupName = localStorage.getItem('storedCompanyName') || '';
                if (backupName) {
                    setBuyerInfo(prev => ({ ...prev, companyName: backupName }));
                    setIsInfoLoading(false); // We have enough to show the UI
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
                        companyName: data.companyName || backupName || '', // Keep backup if API empty
                        currentBalance: Number(data.currentBalance) || 0
                    });
                    // Update backup
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
        // Expose fetchUser for retry
        window._retryFetchUser = fetchUser;
    }, []);

    // Recalculate cart total whenever items or settings change
    useEffect(() => {
        const hasItems = Object.values(cartItems).some(i => i.qty > 0);
        if (hasItems) {
            // We need the discount percent from the profile
            const fetchDiscount = async () => {
                const { data: { user } } = await createClient().auth.getUser();
                if (user) {
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
                        // Only set amount if nothing else is set yet or we came from cart
                        if (!amount || amount === '0.00' || context === 'cart' || sessionStorage.getItem('pendingCartTotal')) {
                            // If user is already typing or has debt checked, don't overwrite unless coming from cart
                            if (isCartChecked) {
                                setAmount(totals.grandTotal.toFixed(2));
                            }
                        }
                    }
                }
            };
            fetchDiscount();
        } else {
            setCartTotal(null);
            if (isCartChecked) setAmount('');
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
            setIsDebtChecked(false); // Exclusive
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
            setIsCartChecked(false); // Exclusive
            if (buyerInfo?.currentBalance < 0) {
                setAmount(Math.abs(buyerInfo.currentBalance).toFixed(2));
            }
        } else {
            setAmount('');
        }
    };

    const handleAmountChange = (val) => {
        // Normalize comma to dot
        let normalized = val.replace(',', '.');
        // Allow only numbers and one dot
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

        // Final normalization and validation
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
                    amount: numericAmount.toFixed(2), // Ensure consistent format for API
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
                // Submit via React lifecycle instead of dangerouslySetInnerHTML script execution
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
        // Format the customer name for Tosla: SADECE FIRMA ADI
        let formattedName = `${toslaData.companyName || ''}`.trim();
        let safeName = formattedName
            .replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/Ş/g, 'S').replace(/ş/g, 's')
            .replace(/Ğ/g, 'G').replace(/ğ/g, 'g').replace(/Ü/g, 'U').replace(/ü/g, 'u')
            .replace(/Ö/g, 'O').replace(/ö/g, 'o').replace(/Ç/g, 'C').replace(/ç/g, 'c')
            .replace(/[^a-zA-Z0-9\s]/g, '').trim().toUpperCase();
        if (!safeName) safeName = 'MUSTERI'; // emergency fallback

        // Render a native React form and let useEffect submit it
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

    const showCartBox = (buyerInfo.currentBalance >= 0) || (buyerInfo.currentBalance < 0 && cartTotal && parseFloat(cartTotal) > 0);
    const showDebtBox = (buyerInfo.currentBalance < 0);

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
                            <small style={{ color: '#6c757d', display: 'block', marginTop: 4 }}>
                                {amount.includes(',') || amount.includes('.') ? 'Ondalık ayracı otomatik olarak ayarlanır.' : 'Virgül (,) veya Nokta (.) kullanabilirsiniz.'}
                            </small>
                        </div>

                        <div className="form-group" style={{ marginBottom: 15 }}>
                            <label className="form-label">İşlem Yapan Firma (Tosla'ya gönderilecek referans)</label>
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
                                        fontWeight: 'bold',
                                        border: infoError || (!isInfoLoading && !buyerInfo.companyName) ? '1px solid #fda4af' : '1px solid var(--border)'
                                    }}
                                />
                                {(infoError || (!isInfoLoading && !buyerInfo.companyName)) && (
                                    <button
                                        type="button"
                                        onClick={() => window._retryFetchUser?.()}
                                        style={{
                                            position: 'absolute',
                                            right: 12,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            fontSize: 12,
                                            color: '#dc2626',
                                            border: '1px solid #dc2626',
                                            background: '#fff',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontWeight: 700
                                        }}
                                    >
                                        YENİDEN DENE
                                    </button>
                                )}
                                {isInfoLoading && (
                                    <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                                        <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                    </div>
                                )}
                            </div>
                            <small style={{ color: infoError ? '#dc2626' : '#6c757d', marginTop: 4, display: 'block' }}>
                                {infoError || "Güvenlik gereği kart sahibi ismi yerine sadece firma adınız Tosla'ya iletilir."}
                            </small>
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
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Son Kullanma (Ay)</label>
                                <input type="text" className="form-input" value={expireMonth} onChange={e => setExpireMonth(e.target.value.replace(/\D/g, ''))} placeholder="AA" maxLength="2" required />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Son Kullanma (Yıl)</label>
                                <input type="text" className="form-input" value={expireYear} onChange={e => setExpireYear(e.target.value.replace(/\D/g, ''))} placeholder="YY" maxLength="2" required />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">CVV</label>
                                <input type="password" placeholder="***" className="form-input" value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, ''))} maxLength="4" required />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            style={{
                                width: '100%',
                                justifyContent: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                opacity: (loading || isInfoLoading || infoError || !buyerInfo.companyName) ? 0.6 : 1,
                                transition: 'all 0.2s'
                            }}
                            disabled={loading || isInfoLoading || infoError || !buyerInfo.companyName}
                        >
                            {loading ? (
                                <><div className="loading-spinner" style={{ width: 18, height: 18, borderTopColor: 'white' }} /> İşleniyor...</>
                            ) : (
                                <><CreditCardIcon style={{ width: 20, height: 20 }} /> Güvenli Ödeme Yap (Tosla)</>
                            )}
                        </button>
                    </form>

                    <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                        <p style={{ marginBottom: 16 }}>Ödemeleriniz <strong style={{ color: 'var(--text-primary)' }}>Tosla</strong> güvencesiyle 256-bit SSL ile şifrelenmektedir.</p>

                        {/* Payment Logos Block - Styled like the reference image */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '24px',
                            padding: '16px 24px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '12px',
                            marginBottom: '20px'
                        }}>
                            <img src="/user_logo3.png" alt="Troy" style={{ height: 32, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} onError={(e) => { e.target.style.display = 'none'; e.target.insertAdjacentHTML('afterend', '<span style="color:#0ea5e9; font-weight:900; font-size:18px; font-style: italic;">troy</span>'); }} />
                            <img src="/user_logo2.png" alt="Visa" style={{ height: 24, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} onError={(e) => { e.target.style.display = 'none'; e.target.insertAdjacentHTML('afterend', '<span style="color:#1d4ed8; font-weight:900; font-size:22px; font-style: italic;">VISA</span>'); }} />
                            <img src="/user_logo1.png" alt="Mastercard" style={{ height: 32, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} onError={(e) => { e.target.style.display = 'none'; e.target.insertAdjacentHTML('afterend', '<span style="color:#dc2626; font-weight:bold; font-size:16px;">mastercard</span>'); }} />

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                paddingLeft: '24px',
                                borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                                height: '32px'
                            }}>
                                <div style={{ width: 28, height: 28, background: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                </div>
                                <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#10b981', letterSpacing: '0.5px' }}>256 BIT SSL</div>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>GÜVENLİ ÖDEME</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                             <Link href="/mesafeli-satis-sozlesmesi" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Mesafeli Satış Sözleşmesi</Link>
                            <span style={{ color: 'var(--border)' }}>|</span>
                            <Link href="/iptal-ve-iade-kosullari" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>İptal ve İade Koşulları</Link>
                            <span style={{ color: 'var(--border)' }}>|</span>
                            <Link href="/gizlilik-ve-guvenlik" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Gizlilik Politikası</Link>
                        </div>
                        <p style={{ marginTop: 16, fontSize: 12 }}>Ödeme yaparak yukarıdaki sözleşme ve koşulları kabul etmiş sayılırsınız.</p>
                    </div>
                </div>

                <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {cartTotal && (
                            <div className="card" style={{ 
                                padding: 24, 
                                border: isCartChecked ? '2px solid var(--primary)' : '1px solid var(--border)', 
                                opacity: isDebtChecked ? 0.6 : 1,
                                transition: 'all 0.2s',
                                cursor: 'pointer'
                            }} onClick={() => !isCartChecked && handleCartCheck({ target: { checked: true } })}>
                                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: isCartChecked ? 'var(--primary)' : 'inherit' }}>Sepet Ödemesi</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>Siparişinizi tamamlamak için mevcut sepet tutarı kadar bakiye yükleyerek devam edebilirsiniz.</p>
                                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Ödenecek Tutar:</div>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>₺{parseFloat(cartTotal).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', background: isCartChecked ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent', borderRadius: 8, transition: 'all 0.2s' }}>
                                    <input
                                        type="checkbox"
                                        checked={isCartChecked}
                                        onChange={handleCartCheck}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ width: 20, height: 20, accentColor: 'var(--primary)', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontWeight: 600, fontSize: 14, color: isCartChecked ? 'var(--primary)' : 'inherit' }}>Bu tutarı öde</span>
                                </label>
                            </div>
                        )}

                        {(buyerInfo.currentBalance !== undefined && buyerInfo.currentBalance < 0) && (
                            <div className="card" style={{ 
                                padding: 24, 
                                border: isDebtChecked ? '2px solid var(--danger)' : '1px solid var(--border)', 
                                opacity: isCartChecked ? 0.6 : 1,
                                transition: 'all 0.2s',
                                cursor: 'pointer'
                            }} onClick={() => !isDebtChecked && handleDebtCheck({ target: { checked: true } })}>
                                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: isDebtChecked ? 'var(--danger)' : 'inherit' }}>Cari Borç Ödemesi</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>Cari hesabınızda bulunan güncel borç tutarınızı anında kolayca ödeyebilirsiniz.</p>
                                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Güncel Cari Borcunuz:</div>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--danger)' }}>₺{Math.abs(buyerInfo.currentBalance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', background: isDebtChecked ? 'rgba(220, 38, 38, 0.1)' : 'transparent', borderRadius: 8, transition: 'all 0.2s' }}>
                                    <input
                                        type="checkbox"
                                        checked={isDebtChecked}
                                        onChange={handleDebtCheck}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ width: 20, height: 20, accentColor: 'var(--danger)', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontWeight: 600, fontSize: 14, color: isDebtChecked ? 'var(--danger)' : 'inherit' }}>Tüm borcumu öde</span>
                                </label>
                            </div>
                        )}

                        {/* Akbank Tosla Info Box */}
                        <div style={{
                            marginTop: 'auto',
                            padding: '24px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            color: 'var(--text-secondary)',
                            fontSize: '14px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            flexWrap: 'nowrap'
                        }}>
                            <span style={{ whiteSpace: 'nowrap' }}><strong>TOSLA,</strong> bir</span>
                            <img
                                src="https://upload.wikimedia.org/wikipedia/commons/8/87/Akbank_logo.svg"
                                alt="Akbank"
                                style={{ height: '18px', opacity: 1, flexShrink: 0 }}
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.insertAdjacentHTML('afterend', '<strong style="color:#e31837; font-style:italic; font-family:Arial, sans-serif; letter-spacing:-0.5px">AKBANK</strong>');
                                }}
                            />
                            <span style={{ whiteSpace: 'nowrap' }}>ödeme yöntemidir.</span>
                        </div>
                    </div>
                </div>
            </div>
    );
}

